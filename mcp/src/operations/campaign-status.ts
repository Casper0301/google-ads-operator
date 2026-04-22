// Pause or resume a Google Ads campaign. Plan-only at propose time;
// execution is dispatched via execute_change.

import { supabase } from '../shared/supabase.js';
import { audit } from '../shared/audit.js';

export type CampaignStatusAction = 'pause' | 'resume';

export type ProposeCampaignStatusParams = {
  clientSlug: string;
  campaignId: string;
  campaignName?: string;
  action: CampaignStatusAction;
  rationale: string;
};

export async function proposeCampaignStatus(params: ProposeCampaignStatusParams): Promise<{
  change_id: string;
  preview: string;
}> {
  const { clientSlug, campaignId, campaignName, action, rationale } = params;

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

  const verb = action === 'pause' ? 'Pause' : 'Resume';
  const previousStatus = action === 'pause' ? 'ENABLED' : 'PAUSED';
  const newStatus = action === 'pause' ? 'PAUSED' : 'ENABLED';

  const preview = [
    `${verb} Google Ads campaign for ${client.name}`,
    `Campaign: ${campaignName ?? campaignId} (${campaignId})`,
    `Status: ${previousStatus} → ${newStatus}`,
    `Rationale: ${rationale}`,
  ].join('\n');

  const operationType = 'google_ads_set_campaign_status';

  const { data: change, error: changeErr } = await supabase
    .from('changes')
    .insert({
      client_id: client.id,
      connection_id: conn?.id ?? null,
      operation_type: operationType,
      target_type: 'campaign',
      target_external_id: campaignId,
      plan: { campaign_id: campaignId, campaign_name: campaignName, action, new_status: newStatus },
      preview_text: preview,
      undo_data: { previous_status: previousStatus },
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
    details: { operation: operationType, campaign_id: campaignId, action },
  });

  return { change_id: change.id, preview };
}
