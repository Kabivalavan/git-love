
-- Create analytics_sessions table
CREATE TABLE public.analytics_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  user_agent text,
  device text,
  referrer text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_active_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_analytics_sessions_visitor ON public.analytics_sessions(visitor_id);
CREATE INDEX idx_analytics_sessions_session ON public.analytics_sessions(session_id);
CREATE INDEX idx_analytics_sessions_created ON public.analytics_sessions(created_at);

-- Enable RLS
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert sessions (anonymous tracking)
CREATE POLICY "Anyone can insert analytics sessions"
ON public.analytics_sessions FOR INSERT
WITH CHECK (true);

-- Anyone can update their own session (last_active_at)
CREATE POLICY "Anyone can update analytics sessions"
ON public.analytics_sessions FOR UPDATE
USING (true)
WITH CHECK (true);

-- Admins can read sessions
CREATE POLICY "Admins can read analytics sessions"
ON public.analytics_sessions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Add visitor_id and referrer columns to analytics_events
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS visitor_id text;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS referrer text;

-- Add index on visitor_id for analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON public.analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);

-- Enable realtime for analytics_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_sessions;
