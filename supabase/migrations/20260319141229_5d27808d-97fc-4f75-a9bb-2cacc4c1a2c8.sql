
-- Add cost_price and tax_rate to product_variants
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT NULL;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;

-- Add variant_ids jsonb to offers for variant-specific targeting
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS variant_ids jsonb DEFAULT NULL;
