// Adjust a Google Ads campaign's daily budget. Plan-only at propose time;
// execution dispatched via execute_change.

import { supabase } from '../shared/supabase.js';
import { audit } from '../shared/audit.js';

export type ProposeCampaignBudgetParams = {
  clientSlug: string;
  campaignId: string;
  campaignName?: string;
  newDailyNok: number;
  previousDailyNok?: number;
  rationale: string;
};

export async function proposeCampaignBudget(params: ProposeCampaignBudgetParams): Promise<{
  change_id: string;
  preview: string;
}> {
  const { clientSlug, campaignId, campaignName, newDailyNok, previousDailyNok, rationale } = params;

  if (newDailyNok <= 0) throw new Error('newDailyNok must be positive');

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('slug', clientSlug)
    .single();
  if (clientErr || !client) throw new Error(`client not found: ${clientSlug}`);

  const { data: conn } = await supabase
    .from('platform_connections')
    .select('id')
    .eq('client_id', client.id)
    .eq('platform', 'google_ads')
    .eq('active', true)
    .maybeSingle();

  const deltaPct =
    previousDailyNok && previousDailyNok > 0
      ? ((newDailyNok - previousDailyNok) / previousDailyNok) * 100
      : null;

  const preview = [
    `Adjust Google Ads campaign budget for ${client.name}`,
    `Campaign: ${campaignName ?? campaignId} (${campaignId})`,
    previousDailyNok
      ? `Daily budget: ${previousDailyNok.toLocaleString('nb-NO')} kr → ${newDailyNok.toLocaleString('nb-NO')} kr${
          deltaPct !== null ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)` : ''
        }`
      : `Daily budget: → ${newDailyNok.toLocaleString('nb-NO')} kr`,
    `Rationale: ${rationale}`,
  ].join('\n');

  const operationType = 'google_ads_set_campaign_budget';

  const { data: change, error: changeErr } = await supabase
    .from('changes')
    .insert({
      client_id: client.id,
      connection_id: conn?.id ?? null,
      operation_type: operationType,
      target_type: 'campaign',
      target_external_id: campaignId,
      plan: {
        campaign_id: campaignId,
        campaign_name: campaignName,
        new_daily_nok: newDailyNok,
        new_daily_micros: Math.round(newDailyNok * 1_000_000),
      },
      preview_text: preview,
      undo_data: previousDailyNok
        ? {
            previous_daily_nok: previousDailyNok,
            previous_daily_micros: Math.round(previousDailyNok * 1_000_000),
          }
        : {},
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
    details: { operation: operationType, campaign_id: campaignId, new_daily_nok: newDailyNok },
  });

  return { change_id: change.id, preview };
}
