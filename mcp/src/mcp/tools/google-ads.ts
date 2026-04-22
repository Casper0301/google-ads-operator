import { supabase } from '../../shared/supabase.js';
import { getGoogleAdsClient } from '../../platforms/google-ads.js';
import {
  proposeNegativeKeywords,
  type NegativeKeywordCandidate,
  type NegativeKeywordScope,
} from '../../operations/negative-keywords.js';
import { proposeCampaignStatus } from '../../operations/campaign-status.js';
import { proposeCampaignBudget } from '../../operations/campaign-budget.js';
import type { ToolDefinition } from './types.js';
import { ok, fail } from './types.js';

const NEXT_STEP = (changeId: string) =>
  `Review the preview with the user. After confirmation, call approve_change with change_id="${changeId}" then execute_change.`;

async function resolveConnection(clientSlug: string): Promise<{
  connectionId: string;
  customerId: string;
  mccId: string | null;
}> {
  const { data, error } = await supabase
    .from('platform_connections')
    .select('id, account_external_id, mcc_id, clients!inner(slug)')
    .eq('platform', 'google_ads')
    .eq('active', true)
    .eq('clients.slug', clientSlug)
    .single();
  if (error || !data) throw new Error(`no Google Ads connection for client "${clientSlug}"`);
  return {
    connectionId: data.id,
    customerId: data.account_external_id,
    mccId: data.mcc_id,
  };
}

export function registerGoogleAdsTools(): ToolDefinition[] {
  return [
    // ── Reads ─────────────────────────────────────────────────────────────

    {
      name: 'google_ads_search_terms_report',
      description:
        'Pull search terms report for a client\'s Google Ads account. Returns search queries that triggered ads with clicks, cost, and conversions. Read-only.',
      inputSchema: {
        type: 'object',
        properties: {
          client_slug: { type: 'string' },
          days: { type: 'number', description: 'Lookback window in days (default 7, max 90)' },
        },
        required: ['client_slug'],
      },
      handler: async (args) => {
        try {
          const clientSlug = args.client_slug as string;
          const days = Math.min(Math.max((args.days as number) ?? 7, 1), 90);
          const conn = await resolveConnection(clientSlug);
          const client = await getGoogleAdsClient({
            customerId: conn.customerId,
            loginCustomerId: conn.mccId ?? undefined,
          });
          const rows = await client.getSearchTermsReport(days);
          return ok({
            client_slug: clientSlug,
            days,
            row_count: rows.length,
            total_cost_nok: rows.reduce((s, r) => s + r.cost_nok, 0),
            total_clicks: rows.reduce((s, r) => s + r.clicks, 0),
            total_conversions: rows.reduce((s, r) => s + r.conversions, 0),
            rows,
          });
        } catch (e) {
          return fail(`search terms report failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    },

    // ── Writes (propose only) ─────────────────────────────────────────────

    {
      name: 'google_ads_propose_negative_keywords',
      description:
        'Propose adding negative keywords to a campaign or shared set. Requires approval before execution.',
      inputSchema: {
        type: 'object',
        properties: {
          client_slug: { type: 'string' },
          scope: {
            type: 'object',
            description: 'Either { type: "campaign", campaign_id } or { type: "shared_set", shared_set_id }',
            properties: {
              type: { type: 'string', enum: ['campaign', 'shared_set'] },
              campaign_id: { type: 'string' },
              shared_set_id: { type: 'string' },
            },
            required: ['type'],
          },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                match_type: { type: 'string', enum: ['BROAD', 'PHRASE', 'EXACT'] },
                rationale: { type: 'string' },
              },
              required: ['text', 'match_type'],
            },
          },
          rationale: { type: 'string' },
        },
        required: ['client_slug', 'scope', 'candidates', 'rationale'],
      },
      handler: async (args) => {
        try {
          const clientSlug = args.client_slug as string;
          const scope = args.scope as NegativeKeywordScope;
          const candidates = args.candidates as NegativeKeywordCandidate[];
          const rationale = args.rationale as string;
          if (candidates.length === 0) return fail('no candidates provided');

          const conn = await resolveConnection(clientSlug);
          const { change_id, preview } = await proposeNegativeKeywords({
            clientSlug,
            connectionId: conn.connectionId,
            scope,
            candidates,
            rationale,
          });
          return ok({ change_id, status: 'pending_approval', preview, next: NEXT_STEP(change_id) });
        } catch (e) {
          return fail(`propose failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    },

    {
      name: 'google_ads_propose_pause_campaign',
      description: 'Propose pausing a Google Ads campaign. Requires approval before execution.',
      inputSchema: {
        type: 'object',
        properties: {
          client_slug: { type: 'string' },
          campaign_id: { type: 'string' },
          campaign_name: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['client_slug', 'campaign_id', 'rationale'],
      },
      handler: async (args) => {
        try {
          const { change_id, preview } = await proposeCampaignStatus({
            clientSlug: args.client_slug as string,
            campaignId: args.campaign_id as string,
            campaignName: args.campaign_name as string | undefined,
            action: 'pause',
            rationale: args.rationale as string,
          });
          return ok({ change_id, status: 'pending_approval', preview, next: NEXT_STEP(change_id) });
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      },
    },

    {
      name: 'google_ads_propose_resume_campaign',
      description:
        'Propose resuming a paused Google Ads campaign. Requires approval before execution.',
      inputSchema: {
        type: 'object',
        properties: {
          client_slug: { type: 'string' },
          campaign_id: { type: 'string' },
          campaign_name: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['client_slug', 'campaign_id', 'rationale'],
      },
      handler: async (args) => {
        try {
          const { change_id, preview } = await proposeCampaignStatus({
            clientSlug: args.client_slug as string,
            campaignId: args.campaign_id as string,
            campaignName: args.campaign_name as string | undefined,
            action: 'resume',
            rationale: args.rationale as string,
          });
          return ok({ change_id, status: 'pending_approval', preview, next: NEXT_STEP(change_id) });
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      },
    },

    {
      name: 'google_ads_propose_campaign_budget',
      description:
        'Propose changing a Google Ads campaign\'s daily budget (NOK). Note: modifies the linked budget resource, so shared budgets affect other campaigns using them. Requires approval before execution.',
      inputSchema: {
        type: 'object',
        properties: {
          client_slug: { type: 'string' },
          campaign_id: { type: 'string' },
          campaign_name: { type: 'string' },
          new_daily_nok: { type: 'number' },
          previous_daily_nok: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['client_slug', 'campaign_id', 'new_daily_nok', 'rationale'],
      },
      handler: async (args) => {
        try {
          const { change_id, preview } = await proposeCampaignBudget({
            clientSlug: args.client_slug as string,
            campaignId: args.campaign_id as string,
            campaignName: args.campaign_name as string | undefined,
            newDailyNok: args.new_daily_nok as number,
            previousDailyNok: args.previous_daily_nok as number | undefined,
            rationale: args.rationale as string,
          });
          return ok({ change_id, status: 'pending_approval', preview, next: NEXT_STEP(change_id) });
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      },
    },
  ];
}
