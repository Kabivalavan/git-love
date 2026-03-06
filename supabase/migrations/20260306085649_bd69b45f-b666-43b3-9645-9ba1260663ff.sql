
CREATE TABLE public.ai_assistant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  visitor_id text,
  session_id text NOT NULL,
  surface text NOT NULL DEFAULT 'home',
  pathname text,
  product_slug text,
  questions jsonb DEFAULT '[]'::jsonb,
  answers jsonb DEFAULT '{}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  recommendation_count integer DEFAULT 0,
  clicked_product_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_assistant_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert AI sessions"
  ON public.ai_assistant_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view AI sessions"
  ON public.ai_assistant_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Anyone can update their own AI sessions"
  ON public.ai_assistant_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ai_sessions_user ON public.ai_assistant_sessions(user_id);
CREATE INDEX idx_ai_sessions_created ON public.ai_assistant_sessions(created_at);
CREATE INDEX idx_ai_sessions_visitor ON public.ai_assistant_sessions(visitor_id);
