
-- Analytics events table for real tracking
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  page_path text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  session_id text,
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (anonymous tracking)
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (true);

-- Only admins can read analytics
CREATE POLICY "Admins can read analytics"
ON public.analytics_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Index for common queries
CREATE INDEX idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_product ON public.analytics_events(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_analytics_events_page ON public.analytics_events(page_path);
