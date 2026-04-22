// Rollback a completed change by creating a reverse change that undoes it.
// The reverse change goes through the normal plan/approve/execute pipeline.

import { supabase } from '../shared/supabase.js';
import { audit } from '../shared/audit.js';

export async function proposeRollback(changeId: string): Promise<{
  change_id: string;
  preview: string;
}> {
  const { data: original, error } = await supabase
    .from('changes')
    .select('*, clients!inner(slug, name)')
    .eq('id', changeId)
    .single();
  if (error || !original) throw new Error(`change not found: ${changeId}`);

  if (original.status !== 'completed') {
    throw new Error(
      `only completed changes can be rolled back; ${changeId} is ${original.status}`
    );
  }

  const undo = (original.undo_data ?? {}) as Record<string, unknown>;
  const clientName = (original.clients as unknown as { name: string }).name;

  const preview = [
    `Rollback ${original.operation_type} for ${clientName}`,
    `Original change: ${changeId}`,
    `Executed at: ${original.executed_at ?? '(unknown)'}`,
    `Undo data: ${JSON.stringify(undo, null, 2)}`,
  ].join('\n');

  const { data: reverse, error: insErr } = await supabase
    .from('changes')
    .insert({
      client_id: original.client_id,
      connection_id: original.connection_id,
      operation_type: `rollback_${original.operation_type}`,
      target_type: original.target_type,
      target_external_id: original.target_external_id,
      plan: { rolling_back: changeId, undo_data: undo, original_plan: original.plan },
      preview_text: preview,
      undo_data: { original_change_id: changeId },
      status: 'pending_approval',
      initiated_by: 'api',
      rationale: `rollback of change ${changeId}`,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insErr || !reverse) throw new Error(`rollback propose failed: ${insErr?.message}`);

  await audit({
    clientId: original.client_id,
    changeId: reverse.id,
    actor: 'claude',
    action: 'propose',
    details: { operation: 'rollback', original_change_id: changeId },
  });

  // Mark the original as being rolled back (but not yet completed)
  await supabase
    .from('changes')
    .update({ status: 'rolled_back' })
    .eq('id', changeId);

  return { change_id: reverse.id, preview };
}
