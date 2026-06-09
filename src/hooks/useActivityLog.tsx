import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type EntityType = 'product' | 'order' | 'category' | 'banner' | 'coupon' | 'offer' | 'customer' | 'expense' | 'delivery' | 'bundle' | 'settings' | 'return';
type Action = 'create' | 'update' | 'delete' | 'status_change' | 'block' | 'unblock' | 'refund' | 'export';

interface LogParams {
  action: Action;
  entityType: EntityType;
  entityId?: string;
  details?: Record<string, unknown>;
  /** Optional before/after snapshots for diff capture. Only changed fields are stored. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

const EXCLUDED_DIFF_KEYS = new Set(['id', 'created_at', 'updated_at', 'user_id']);

/** Compute a compact diff of only the changed fields between two snapshots. */
function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (EXCLUDED_DIFF_KEYS.has(k)) continue;
    const a = before?.[k];
    const b = after?.[k];
    const aStr = typeof a === 'object' ? JSON.stringify(a) : String(a ?? '');
    const bStr = typeof b === 'object' ? JSON.stringify(b) : String(b ?? '');
    if (aStr !== bStr) {
      changes[k] = { from: a ?? null, to: b ?? null };
    }
  }
  return changes;
}

export function useActivityLog() {
  const { user } = useAuth();

  const log = useCallback(async ({ action, entityType, entityId, details, before, after }: LogParams) => {
    if (!user) return;
    try {
      const enrichedDetails: Record<string, unknown> = { ...(details || {}) };
      if (before && after) {
        const changes = computeDiff(before, after);
        if (Object.keys(changes).length > 0) {
          enrichedDetails.changes = changes;
        }
      }
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        details: enrichedDetails as any,
      });
    } catch {
      // Non-blocking — don't disrupt user flow
    }
  }, [user]);

  return { log };
}
