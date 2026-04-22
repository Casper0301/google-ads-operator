// Add negative keywords to a Google Ads campaign or shared set.
// Follows the plan → preview → confirm → execute pattern.
//
// Plan step: propose() — writes a pending change, no API side effect
// Execute step: execute() — called after approval, makes the real API call

import { supabase } from '../shared/supabase.js';
import { audit } from '../shared/audit.js';
import { getGoogleAdsClient } from '../platforms/google-ads.js';

export type NegativeKeywordCandidate = {
  text: string;
  match_type: 'BROAD' | 'PHRASE' | 'EXACT';
  rationale?: string;
};

export type NegativeKeywordScope =
  | { type: 'campaign'; campaign_id: string }
  | { type: 'shared_set'; shared_set_id: string };

export type ProposeParams = {
  clientSlug: string;
  connectionId: string;
  scope: NegativeKeywordScope;
  candidates: NegativeKeywordCandidate[];
  rationale: string;
};

export async function proposeNegativeKeywords(params: ProposeParams): Promise<{
  change_id: string;
  preview: string;
}> {
  const { clientSlug, connectionId, scope, candidates, rationale } = params;

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('slug', clientSlug)
    .single();
  if (clientErr || !client) throw new Error(`client not found: ${clientSlug}`);

  const previewLines = [
    `Add ${candidates.length} negative keywords for ${client.name}`,
    `Scope: ${scope.type} ${scope.type === 'campaign' ? scope.campaign_id : scope.shared_set_id}`,
    `Rationale: ${rationale}`,
    '',
    ...candidates.map((c) => `  - [${c.match_type}] "${c.text}"${c.rationale ? ` — ${c.rationale}` : ''}`),
  ];
  const preview = previewLines.join('\n');

  const { data: change, error: changeErr } = await supabase
    .from('changes')
    .insert({
      client_id: client.id,
      connection_id: connectionId,
      operation_type: 'add_negative_keywords',
      target_type: scope.type,
      target_external_id: scope.type === 'campaign' ? scope.campaign_id : scope.shared_set_id,
      plan: { scope, candidates },
      preview_text: preview,
      undo_data: { criterion_resource_names: [] }, // populated after execute
      status: 'pending_approval',
      initiated_by: 'claude',
      rationale,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (changeErr || !change) throw new Error(`propose failed: ${changeErr?.message}`);

  await audit({
    clientId: client.id,
    changeId: change.id,
    actor: 'claude',
    action: 'propose',
    details: { operation: 'add_negative_keywords', count: candidates.length },
  });

  return { change_id: change.id, preview };
}

export async function executeNegativeKeywords(changeId: string): Promise<{
  success: boolean;
  added: number;
  resource_names: string[];
}> {
  const { data: change, error: fetchErr } = await supabase
    .from('changes')
    .select('*, platform_connections!inner(id, client_id, account_external_id, mcc_id)')
    .eq('id', changeId)
    .single();
  if (fetchErr || !change) throw new Error(`change not found: ${changeId}`);
  if (change.status !== 'approved') {
    throw new Error(`change status is ${change.status}, expected approved`);
  }

  await supabase.from('changes').update({ status: 'executing' }).eq('id', changeId);

  try {
    const plan = change.plan as { scope: NegativeKeywordScope; candidates: NegativeKeywordCandidate[] };
    const connection = change.platform_connections as {
      id: string;
      client_id: string;
      account_external_id: string;
      mcc_id: string | null;
    };

    const customer = await getGoogleAdsClient({
      customerId: connection.account_external_id,
      loginCustomerId: connection.mcc_id ?? undefined,
    });

    // TODO (Phase 1 exit): wire actual google-ads-api mutate call here.
    // Structure:
    //   - For scope=campaign: CampaignCriterionService.mutateCampaignCriteria with negative=true
    //   - For scope=shared_set: SharedCriterionService.mutateSharedCriteria
    // Capture returned resource_names into undo_data.criterion_resource_names
    const resourceNames: string[] = await customer.addNegativeKeywords(plan.scope, plan.candidates);

    await supabase
      .from('changes')
      .update({
        status: 'completed',
        executed_at: new Date().toISOString(),
        result: { added: resourceNames.length, resource_names: resourceNames },
        undo_data: { criterion_resource_names: resourceNames },
      })
      .eq('id', changeId);

    await audit({
      clientId: connection.client_id,
      changeId,
      actor: 'system',
      action: 'execute',
      details: { operation: 'add_negative_keywords', added: resourceNames.length },
    });

    return { success: true, added: resourceNames.length, resource_names: resourceNames };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('changes')
      .update({ status: 'failed', error: msg })
      .eq('id', changeId);
    await audit({
      clientId: (change.platform_connections as { client_id: string }).client_id,
      changeId,
      actor: 'system',
      action: 'fail',
      details: { operation: 'add_negative_keywords', error: msg },
    });
    throw e;
  }
}
