
-- Conversion events tracking table
CREATE TABLE public.conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'exit_popup_shown', 'exit_popup_clicked', 'upsell_shown', 'upsell_clicked', 'cross_sell_shown', 'cross_sell_clicked', 'cart_optimizer_shown', 'cart_optimizer_clicked', 'ab_variant_shown'
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  source_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  visitor_id text,
  user_id uuid,
  session_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversion_events_type ON public.conversion_events(event_type);
CREATE INDEX idx_conversion_events_created ON public.conversion_events(created_at);
CREATE INDEX idx_conversion_events_product ON public.conversion_events(product_id);

-- RLS
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert conversion events"
ON public.conversion_events FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Admins can view conversion events"
ON public.conversion_events FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Cross-sell rules table (admin-defined product relationships)
CREATE TABLE public.cross_sell_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  target_product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  rule_type text NOT NULL DEFAULT 'cross_sell', -- 'cross_sell' or 'upsell'
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source_product_id, target_product_id, rule_type)
);

CREATE INDEX idx_cross_sell_source ON public.cross_sell_rules(source_product_id) WHERE is_active = true;

ALTER TABLE public.cross_sell_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active cross-sell rules"
ON public.cross_sell_rules FOR SELECT TO public
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage cross-sell rules"
ON public.cross_sell_rules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
