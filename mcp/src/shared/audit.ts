import { supabase } from './supabase.js';

export type Actor = 'claude' | 'user' | 'system' | 'scheduled';
export type AuditAction =
  | 'sync'
  | 'propose'
  | 'approve'
  | 'reject'
  | 'execute'
  | 'rollback'
  | 'fail'
  | 'connect'
  | 'disconnect';

export async function audit(params: {
  clientId: string | null;
  changeId?: string | null;
  actor: Actor;
  action: AuditAction;
  details?: Record<string, unknown>;
}) {
  const { error } = await supabase.from('audit_log').insert({
    client_id: params.clientId,
    change_id: params.changeId ?? null,
    actor: params.actor,
    action: params.action,
    details: params.details ?? {},
  });
  if (error) {
    console.error('[audit] failed to log', error, params);
  }
}
