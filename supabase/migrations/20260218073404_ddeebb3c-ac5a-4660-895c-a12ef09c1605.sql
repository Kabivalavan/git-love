
-- Add variant_required column to products
ALTER TABLE public.products ADD COLUMN variant_required boolean DEFAULT false;

COMMENT ON COLUMN public.products.variant_required IS 'If true, customer must select a variant before adding to cart';
