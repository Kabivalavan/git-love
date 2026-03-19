
ALTER TABLE public.bundle_items
  ADD COLUMN allow_variant_selection boolean NOT NULL DEFAULT false,
  ADD COLUMN default_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
