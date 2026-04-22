import { supabase } from '../../shared/supabase.js';
import type { ToolDefinition } from './types.js';
import { ok, fail } from './types.js';

export function registerClientTools(): ToolDefinition[] {
  return [
    {
      name: 'list_clients',
      description: 'List all active clients with their tier, retainer, and connected platforms. Read-only.',
      inputSchema: {
        type: 'object',
        properties: {
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive clients (default false)',
          },
        },
      },
      handler: async (args) => {
        const includeInactive = args.include_inactive === true;
        let query = supabase
          .from('clients')
          .select('id, slug, name, industry, tier, monthly_retainer_nok, active, platform_connections(platform, account_external_id, account_name, active)')
          .order('name');
        if (!includeInactive) query = query.eq('active', true);
        const { data, error } = await query;
        if (error) return fail(`list_clients failed: ${error.message}`);
        return ok(data);
      },
    },
    {
      name: 'get_client',
      description: 'Get full details for a single client by slug, including all platform connections and active campaigns.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Client slug (e.g. "stjordal-autosalg")' },
        },
        required: ['slug'],
      },
      handler: async (args) => {
        const slug = args.slug as string;
        const { data, error } = await supabase
          .from('clients')
          .select('*, platform_connections(*, campaigns(id, external_id, name, status, campaign_type, budget_micros))')
          .eq('slug', slug)
          .single();
        if (error) return fail(`get_client failed: ${error.message}`);
        return ok(data);
      },
    },
  ];
}
