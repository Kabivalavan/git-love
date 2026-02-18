
-- Create bundles table
CREATE TABLE public.bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  bundle_price NUMERIC NOT NULL,
  compare_price NUMERIC,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bundle_items table (products in a bundle)
CREATE TABLE public.bundle_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for bundles
CREATE POLICY "Anyone can view active bundles" ON public.bundles
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can manage bundles" ON public.bundles
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- RLS policies for bundle_items
CREATE POLICY "Anyone can view bundle items" ON public.bundle_items
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage bundle items" ON public.bundle_items
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Add updated_at trigger for bundles
CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON public.bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_bundle_items_bundle_id ON public.bundle_items(bundle_id);
CREATE INDEX idx_bundle_items_product_id ON public.bundle_items(product_id);
