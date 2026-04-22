import { supabase } from '../../shared/supabase.js';
import { audit } from '../../shared/audit.js';
import { executeChange } from '../../operations/executor.js';
import { proposeRollback } from '../../operations/rollback.js';
import type { ToolDefinition } from './types.js';
import { ok, fail } from './types.js';

export function registerChangeTools(): ToolDefinition[] {
  return [
    {
      name: 'list_pending_changes',
      description: "List all changes awaiting approval, newest first.",
      inputSchema: {
        type: 'object',
        properties: {
          client_slug: { type: 'string', description: 'Optional filter by client slug' },
        },
      },
      handler: async (args) => {
        let query = supabase
          .from('changes')
          .select(
            'id, operation_type, target_type, target_external_id, preview_text, rationale, created_at, clients!inner(slug, name)'
          )
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false });
        if (args.client_slug) {
          query = query.eq('clients.slug', args.client_slug as string);
        }
        const { data, error } = await query;
        if (error) return fail(`list_pending_changes failed: ${error.message}`);
        return ok(data);
      },
    },
    {
      name: 'get_change',
      description:
        'Get full details of a specific change, including the full plan JSON and undo data.',
      inputSchema: {
        type: 'object',
        properties: {
          change_id: { type: 'string' },
        },
        required: ['change_id'],
      },
      handler: async (args) => {
        const { data, error } = await supabase
          .from('changes')
          .select('*')
          .eq('id', args.change_id as string)
          .single();
        if (error) return fail(`get_change failed: ${error.message}`);
        return ok(data);
      },
    },
    {
      name: 'approve_change',
      description:
        'Approve a pending change. Marks it ready for execution but does NOT run the API call yet — execution is triggered by a subsequent execute_change step. Requires human confirmation in chat before calling.',
      inputSchema: {
        type: 'object',
        properties: {
          change_id: { type: 'string' },
          approved_by: { type: 'string', description: 'Name of approver' },
        },
        required: ['change_id'],
      },
      handler: async (args) => {
        const changeId = args.change_id as string;
        const approvedBy = (args.approved_by as string) ?? 'user';

        const { data: change, error: fetchErr } = await supabase
          .from('changes')
          .select('id, status, client_id')
          .eq('id', changeId)
          .single();
        if (fetchErr) return fail(`approve_change: not found: ${fetchErr.message}`);
        if (change.status !== 'pending_approval') {
          return fail(
            `approve_change: change is in status "${change.status}", not pending_approval`
          );
        }

        const { error: updateErr } = await supabase
          .from('changes')
          .update({
            status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
          })
          .eq('id', changeId);
        if (updateErr) return fail(`approve_change update failed: ${updateErr.message}`);

        await audit({
          clientId: change.client_id,
          changeId,
          actor: 'user',
          action: 'approve',
          details: { approved_by: approvedBy },
        });

        return ok({
          change_id: changeId,
          status: 'approved',
          next: 'call execute_change to run it',
        });
      },
    },
    {
      name: 'reject_change',
      description: 'Reject a pending change without executing.',
      inputSchema: {
        type: 'object',
        properties: {
          change_id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['change_id'],
      },
      handler: async (args) => {
        const changeId = args.change_id as string;
        const { data: change, error: fetchErr } = await supabase
          .from('changes')
          .select('id, status, client_id')
          .eq('id', changeId)
          .single();
        if (fetchErr) return fail(`reject_change: ${fetchErr.message}`);

        const { error: updateErr } = await supabase
          .from('changes')
          .update({ status: 'failed', error: `rejected: ${args.reason ?? 'no reason given'}` })
          .eq('id', changeId);
        if (updateErr) return fail(`reject_change update failed: ${updateErr.message}`);

        await audit({
          clientId: change.client_id,
          changeId,
          actor: 'user',
          action: 'reject',
          details: { reason: args.reason },
        });

        return ok({ change_id: changeId, status: 'rejected' });
      },
    },
    {
      name: 'execute_change',
      description:
        'Execute an approved change against the Google Ads API. Must be in status "approved". Dispatches based on operation_type (set campaign status, set campaign budget, add negative keywords, and their rollback variants). Writes result + undo data back to the change row.',
      inputSchema: {
        type: 'object',
        properties: {
          change_id: { type: 'string' },
        },
        required: ['change_id'],
      },
      handler: async (args) => {
        try {
          const result = await executeChange(args.change_id as string);
          return ok({ change_id: args.change_id, status: 'completed', ...result });
        } catch (e) {
          return fail(`execute failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    },
    {
      name: 'propose_rollback',
      description:
        'Create a pending rollback change for a previously-completed change. The rollback follows the normal approve → execute flow. Works for status/budget ops and negative keyword additions (removes the criteria by stored resource_name).',
      inputSchema: {
        type: 'object',
        properties: {
          change_id: { type: 'string', description: 'The completed change to reverse' },
        },
        required: ['change_id'],
      },
      handler: async (args) => {
        try {
          const result = await proposeRollback(args.change_id as string);
          return ok({ ...result, status: 'pending_approval' });
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      },
    },
  ];
}
