import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type EntityType = 'product' | 'order' | 'category' | 'banner' | 'coupon' | 'offer' | 'customer' | 'expense' | 'delivery' | 'bundle' | 'settings';
type Action = 'create' | 'update' | 'delete' | 'status_change' | 'block' | 'unblock' | 'refund' | 'export';

interface LogParams {
  action: Action;
  entityType: EntityType;
  entityId?: string;
  details?: Record<string, unknown>;
}

export function useActivityLog() {
  const { user } = useAuth();

  const log = useCallback(async ({ action, entityType, entityId, details }: LogParams) => {
    if (!user) return;
    try {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        details: (details || {}) as any,
      });
    } catch {
      // Non-blocking — don't disrupt user flow
    }
  }, [user]);

  return { log };
}
