// Unified executor — dispatches approved changes to the Google Ads API.
// All write operations go through here after the user approves them in chat.
//
// Rollback model: `proposeRollback` creates a new change with operation_type
// `rollback_<original>`. The executor handles those by applying the inverse
// action using `undo_data` captured on the original change.

import { supabase } from '../shared/supabase.js';
import { audit } from '../shared/audit.js';
import { getGoogleAdsClient } from '../platforms/google-ads.js';
import { executeNegativeKeywords } from './negative-keywords.js';

type ChangeRow = {
  id: string;
  status: string;
  operation_type: string;
  client_id: string;
  connection_id: string | null;
  target_external_id: string;
  plan: Record<string, unknown>;
  undo_data: Record<string, unknown>;
  platform_connections?: {
    id: string;
    client_id: string;
    account_external_id: string;
    mcc_id: string | null;
    platform: string;
  } | null;
  clients?: { id: string; slug: string; name: string };
};

type ExecResult = Record<string, unknown> & { success: boolean };

async function loadChange(changeId: string): Promise<ChangeRow> {
  const { data, error } = await supabase
    .from('changes')
    .select(
      '*, platform_connections(id, client_id, account_external_id, mcc_id, platform), clients(id, slug, name)'
    )
    .eq('id', changeId)
    .single();
  if (error || !data) throw new Error(`change not found: ${changeId}`);
  return data as unknown as ChangeRow;
}

async function resolveGoogleConn(
  change: ChangeRow
): Promise<{ customerId: string; mccId: string | null }> {
  if (change.platform_connections?.platform === 'google_ads') {
    return {
      customerId: change.platform_connections.account_external_id,
      mccId: change.platform_connections.mcc_id,
    };
  }
  const { data, error } = await supabase
    .from('platform_connections')
    .select('account_external_id, mcc_id')
    .eq('client_id', change.client_id)
    .eq('platform', 'google_ads')
    .eq('active', true)
    .single();
  if (error || !data) throw new Error('no active Google Ads connection for client');
  return { customerId: data.account_external_id, mccId: data.mcc_id };
}

async function markCompleted(
  changeId: string,
  result: Record<string, unknown>,
  undoMerge: Record<string, unknown> = {}
): Promise<void> {
  const { data: existing } = await supabase
    .from('changes')
    .select('undo_data')
    .eq('id', changeId)
    .single();
  const mergedUndo = { ...((existing?.undo_data as Record<string, unknown>) ?? {}), ...undoMerge };

  await supabase
    .from('changes')
    .update({
      status: 'completed',
      executed_at: new Date().toISOString(),
      result,
      undo_data: mergedUndo,
    })
    .eq('id', changeId);
}

async function markFailed(changeId: string, err: unknown): Promise<never> {
  const msg = err instanceof Error ? err.message : String(err);
  await supabase.from('changes').update({ status: 'failed', error: msg }).eq('id', changeId);
  throw err instanceof Error ? err : new Error(msg);
}

// ── Dispatch ────────────────────────────────────────────────────────────────

export async function executeChange(changeId: string): Promise<ExecResult> {
  const change = await loadChange(changeId);
  if (change.status !== 'approved') {
    throw new Error(`change status is "${change.status}", expected "approved"`);
  }

  await supabase.from('changes').update({ status: 'executing' }).eq('id', changeId);

  try {
    const opType = change.operation_type;

    if (opType === 'add_negative_keywords') {
      const res = await executeNegativeKeywords(changeId);
      return { success: res.success, added: res.added, resource_names: res.resource_names };
    }

    if (opType === 'rollback_add_negative_keywords') {
      return await execRollbackNegativeKeywords(change);
    }

    if (opType === 'google_ads_set_campaign_status') return await execGoogleCampaignStatus(change);
    if (opType === 'google_ads_set_campaign_budget') return await execGoogleCampaignBudget(change);

    if (opType.startsWith('rollback_')) {
      return await execRollbackStatusOrBudget(change);
    }

    throw new Error(`execute: unknown operation_type "${opType}"`);
  } catch (e) {
    return await markFailed(changeId, e);
  }
}

// ── Google Ads executors ────────────────────────────────────────────────────

async function execGoogleCampaignStatus(change: ChangeRow): Promise<ExecResult> {
  const { customerId, mccId } = await resolveGoogleConn(change);
  const client = await getGoogleAdsClient({ customerId, loginCustomerId: mccId ?? undefined });

  const plan = change.plan as { campaign_id: string; new_status: 'ENABLED' | 'PAUSED' };
  const resourceName = await client.setCampaignStatus(plan.campaign_id, plan.new_status);

  const result = { success: true, resource_name: resourceName, new_status: plan.new_status };
  await markCompleted(change.id, result);
  await audit({
    clientId: change.client_id,
    changeId: change.id,
    actor: 'system',
    action: 'execute',
    details: { operation: 'google_ads_set_campaign_status', new_status: plan.new_status },
  });
  return result;
}

async function execGoogleCampaignBudget(change: ChangeRow): Promise<ExecResult> {
  const { customerId, mccId } = await resolveGoogleConn(change);
  const client = await getGoogleAdsClient({ customerId, loginCustomerId: mccId ?? undefined });

  const plan = change.plan as { campaign_id: string; new_daily_micros: number };
  const nok = plan.new_daily_micros / 1_000_000;
  const { budget_resource, amount_micros } = await client.setCampaignBudget(plan.campaign_id, nok);

  const result = { success: true, budget_resource, amount_micros };
  await markCompleted(change.id, result, { budget_resource });
  await audit({
    clientId: change.client_id,
    changeId: change.id,
    actor: 'system',
    action: 'execute',
    details: { operation: 'google_ads_set_campaign_budget', new_daily_nok: nok },
  });
  return result;
}

// ── Rollback executors ──────────────────────────────────────────────────────

async function execRollbackStatusOrBudget(change: ChangeRow): Promise<ExecResult> {
  const rollback = change.plan as {
    original_plan: Record<string, unknown>;
    undo_data: Record<string, unknown>;
  };
  const originalOp = change.operation_type.replace(/^rollback_/, '');

  const synthetic: ChangeRow = {
    ...change,
    operation_type: originalOp,
    plan: synthesizeInversePlan(originalOp, rollback.original_plan, rollback.undo_data),
  };

  switch (originalOp) {
    case 'google_ads_set_campaign_status':
      return await execGoogleCampaignStatus(synthetic);
    case 'google_ads_set_campaign_budget':
      return await execGoogleCampaignBudget(synthetic);
    default:
      throw new Error(`rollback not implemented for "${originalOp}"`);
  }
}

function synthesizeInversePlan(
  originalOp: string,
  originalPlan: Record<string, unknown>,
  undoData: Record<string, unknown>
): Record<string, unknown> {
  if (originalOp.endsWith('_status')) {
    return { ...originalPlan, new_status: undoData.previous_status };
  }
  if (originalOp.endsWith('_budget')) {
    return {
      ...originalPlan,
      new_daily_nok: undoData.previous_daily_nok,
      new_daily_micros: undoData.previous_daily_micros,
    };
  }
  return originalPlan;
}

async function execRollbackNegativeKeywords(change: ChangeRow): Promise<ExecResult> {
  const plan = change.plan as {
    undo_data?: { criterion_resource_names?: string[] };
  };
  const names = plan.undo_data?.criterion_resource_names ?? [];
  if (names.length === 0) {
    const result = { success: true, removed: 0, note: 'no criterion resource names to remove' };
    await markCompleted(change.id, result);
    return result;
  }

  const { customerId, mccId } = await resolveGoogleConn(change);
  const client = await getGoogleAdsClient({ customerId, loginCustomerId: mccId ?? undefined });
  const { campaign_criteria_removed, shared_criteria_removed } =
    await client.removeNegativeKeywords(names);

  const result = {
    success: true,
    removed: campaign_criteria_removed + shared_criteria_removed,
    campaign_criteria: campaign_criteria_removed,
    shared_criteria: shared_criteria_removed,
  };
  await markCompleted(change.id, result);
  await audit({
    clientId: change.client_id,
    changeId: change.id,
    actor: 'system',
    action: 'execute',
    details: { operation: 'rollback_add_negative_keywords', removed: result.removed },
  });
  return result;
}
