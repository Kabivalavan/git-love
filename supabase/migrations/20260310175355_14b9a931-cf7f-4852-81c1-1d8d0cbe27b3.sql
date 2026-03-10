
-- Activity/Audit logs table for tracking all admin actions
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view activity logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Authenticated users can insert logs (their own actions)
CREATE POLICY "Authenticated users can insert logs"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
