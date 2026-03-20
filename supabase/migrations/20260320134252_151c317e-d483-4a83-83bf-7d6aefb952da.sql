
-- Return status enum
CREATE TYPE public.return_status AS ENUM (
  'requested', 'approved', 'rejected', 'in_transit', 'received', 'refunded', 'completed'
);

-- Refund status enum
CREATE TYPE public.refund_status AS ENUM (
  'pending', 'processing', 'success', 'failed'
);

-- Returns table
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.return_status NOT NULL DEFAULT 'requested',
  reason text NOT NULL,
  reason_details text,
  images jsonb DEFAULT '[]'::jsonb,
  admin_notes text,
  reject_reason text,
  pickup_partner text,
  pickup_tracking text,
  return_address jsonb,
  item_condition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Return items table
CREATE TABLE public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id),
  product_id uuid REFERENCES public.products(id),
  variant_id uuid REFERENCES public.product_variants(id),
  product_name text NOT NULL,
  variant_name text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Refunds table
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number text NOT NULL,
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  mode text NOT NULL DEFAULT 'original', -- 'original' or 'wallet'
  status public.refund_status NOT NULL DEFAULT 'pending',
  transaction_id text,
  notes text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- RLS for returns
CREATE POLICY "Users can view their own returns" ON public.returns
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Users can create returns" ON public.returns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can manage returns" ON public.returns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- RLS for return_items
CREATE POLICY "Users can view their own return items" ON public.return_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.returns r WHERE r.id = return_items.return_id AND (r.user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))));

CREATE POLICY "Users can create return items" ON public.return_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.returns r WHERE r.id = return_items.return_id AND r.user_id = auth.uid()));

CREATE POLICY "Staff can manage return items" ON public.return_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- RLS for refunds
CREATE POLICY "Users can view their own refunds" ON public.refunds
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can manage refunds" ON public.refunds
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Storage bucket for return images
INSERT INTO storage.buckets (id, name, public) VALUES ('returns', 'returns', true);

-- Storage policies for returns bucket
CREATE POLICY "Anyone can view return images" ON storage.objects
  FOR SELECT USING (bucket_id = 'returns');

CREATE POLICY "Authenticated users can upload return images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'returns');

-- Updated_at trigger
CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate return number function
CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number text;
BEGIN
  new_number := 'RET' || to_char(now(), 'YYYYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');
  RETURN new_number;
END;
$$;

-- Generate refund number function
CREATE OR REPLACE FUNCTION public.generate_refund_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number text;
BEGIN
  new_number := 'RF' || to_char(now(), 'YYYYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');
  RETURN new_number;
END;
$$;
