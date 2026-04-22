import { GoogleAdsApi, type Customer, enums } from 'google-ads-api';
import { env } from '../shared/env.js';
import { supabase } from '../shared/supabase.js';
import { decryptToken } from '../shared/crypto.js';
import type {
  NegativeKeywordCandidate,
  NegativeKeywordScope,
} from '../operations/negative-keywords.js';

let cachedApi: GoogleAdsApi | null = null;

function getApi(): GoogleAdsApi {
  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN || !env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_CLIENT_SECRET) {
    throw new Error(
      'Google Ads env missing: set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET'
    );
  }
  if (!cachedApi) {
    cachedApi = new GoogleAdsApi({
      developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    });
  }
  return cachedApi;
}

export async function getGoogleAdsClient(params: {
  customerId: string;
  loginCustomerId?: string;
}): Promise<AdOpsGoogleAdsClient> {
  const { data, error } = await supabase
    .from('platform_connections')
    .select('refresh_token_encrypted')
    .eq('account_external_id', params.customerId)
    .eq('platform', 'google_ads')
    .eq('active', true)
    .single();
  if (error || !data?.refresh_token_encrypted) {
    throw new Error(`no active Google Ads connection for customer ${params.customerId}`);
  }
  const refreshToken = decryptToken(data.refresh_token_encrypted);

  const customer = getApi().Customer({
    customer_id: params.customerId,
    login_customer_id: params.loginCustomerId,
    refresh_token: refreshToken,
  });
  return new AdOpsGoogleAdsClient(customer, params.customerId);
}

export type SearchTermRow = {
  search_term: string;
  status: string;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  clicks: number;
  cost_nok: number;
  conversions: number;
  impressions: number;
};

export class AdOpsGoogleAdsClient {
  constructor(private customer: Customer, private customerId: string) {}

  async getSearchTermsReport(days: number): Promise<SearchTermRow[]> {
    const until = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const query = `
      SELECT
        search_term_view.search_term,
        search_term_view.status,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.impressions
      FROM search_term_view
      WHERE segments.date BETWEEN '${since}' AND '${until}'
      ORDER BY metrics.cost_micros DESC
      LIMIT 500
    `;
    const rows = (await this.customer.query(query)) as Array<Record<string, unknown>>;
    return rows.map((r) => {
      const stv = r.search_term_view as { search_term?: string; status?: string } | undefined;
      const campaign = r.campaign as { id?: string | number; name?: string } | undefined;
      const adGroup = r.ad_group as { id?: string | number; name?: string } | undefined;
      const metrics = r.metrics as
        | { clicks?: string | number; cost_micros?: string | number; conversions?: string | number; impressions?: string | number }
        | undefined;
      return {
        search_term: stv?.search_term ?? '',
        status: String(stv?.status ?? ''),
        campaign_id: String(campaign?.id ?? ''),
        campaign_name: campaign?.name ?? '',
        ad_group_id: String(adGroup?.id ?? ''),
        ad_group_name: adGroup?.name ?? '',
        clicks: Number(metrics?.clicks ?? 0),
        cost_nok: Number(metrics?.cost_micros ?? 0) / 1_000_000,
        conversions: Number(metrics?.conversions ?? 0),
        impressions: Number(metrics?.impressions ?? 0),
      };
    });
  }

  async addNegativeKeywords(
    scope: NegativeKeywordScope,
    candidates: NegativeKeywordCandidate[]
  ): Promise<string[]> {
    if (scope.type === 'campaign') {
      const operations = candidates.map((c) => ({
        campaign: `customers/${this.customerId}/campaigns/${scope.campaign_id}`,
        negative: true,
        keyword: {
          text: c.text,
          match_type: enums.KeywordMatchType[c.match_type],
        },
      }));
      const response = await this.customer.campaignCriteria.create(operations);
      return (response.results ?? []).map((r) => r.resource_name).filter((n): n is string => Boolean(n));
    }

    const operations = candidates.map((c) => ({
      shared_set: `customers/${this.customerId}/sharedSets/${scope.shared_set_id}`,
      keyword: {
        text: c.text,
        match_type: enums.KeywordMatchType[c.match_type],
      },
    }));
    const response = await this.customer.sharedCriteria.create(operations);
    return (response.results ?? []).map((r) => r.resource_name).filter((n): n is string => Boolean(n));
  }

  async setCampaignStatus(
    campaignId: string,
    status: 'ENABLED' | 'PAUSED'
  ): Promise<string> {
    const response = await this.customer.campaigns.update([
      {
        resource_name: `customers/${this.customerId}/campaigns/${campaignId}`,
        status: enums.CampaignStatus[status],
      },
    ]);
    const resourceName = (response.results ?? [])[0]?.resource_name;
    if (!resourceName) throw new Error('setCampaignStatus: no resource_name returned');
    return resourceName;
  }

  async getCampaignBudget(campaignId: string): Promise<{
    budget_resource: string;
    amount_micros: number;
    period: string;
  }> {
    const query = `
      SELECT
        campaign.id,
        campaign.campaign_budget,
        campaign_budget.amount_micros,
        campaign_budget.period
      FROM campaign
      WHERE campaign.id = ${campaignId}
      LIMIT 1
    `;
    const rows = (await this.customer.query(query)) as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) throw new Error(`campaign ${campaignId} not found`);
    const campaign = row.campaign as { campaign_budget?: string };
    const budget = row.campaign_budget as { amount_micros?: string | number; period?: string };
    if (!campaign?.campaign_budget) {
      throw new Error(`campaign ${campaignId} has no linked budget (likely a shared budget)`);
    }
    return {
      budget_resource: campaign.campaign_budget,
      amount_micros: Number(budget?.amount_micros ?? 0),
      period: String(budget?.period ?? 'DAILY'),
    };
  }

  async setCampaignBudget(
    campaignId: string,
    dailyBudgetNok: number
  ): Promise<{ budget_resource: string; amount_micros: number }> {
    const micros = Math.round(dailyBudgetNok * 1_000_000);
    const { budget_resource } = await this.getCampaignBudget(campaignId);
    await this.customer.campaignBudgets.update([
      {
        resource_name: budget_resource,
        amount_micros: micros,
      },
    ]);
    return { budget_resource, amount_micros: micros };
  }

  async removeNegativeKeywords(resourceNames: string[]): Promise<{
    campaign_criteria_removed: number;
    shared_criteria_removed: number;
  }> {
    const campaignCrits = resourceNames.filter((n) => n.includes('/campaignCriteria/'));
    const sharedCrits = resourceNames.filter((n) => n.includes('/sharedCriteria/'));

    if (campaignCrits.length > 0) await this.customer.campaignCriteria.remove(campaignCrits);
    if (sharedCrits.length > 0) await this.customer.sharedCriteria.remove(sharedCrits);

    return {
      campaign_criteria_removed: campaignCrits.length,
      shared_criteria_removed: sharedCrits.length,
    };
  }
}
