-- Add bundle_id to cart_items so bundle additions are tracked together
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES public.bundles(id) ON DELETE SET NULL;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS bundle_name TEXT;

-- Add bundle tracking to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES public.bundles(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS bundle_name TEXT;
