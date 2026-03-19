
-- Add sort_order to product_variants
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Update get_product_page_data to use sort_order
CREATE OR REPLACE FUNCTION public.get_product_page_data(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_product_id uuid;
  v_category_id uuid;
BEGIN
  SELECT p.id, p.category_id INTO v_product_id, v_category_id
  FROM products p
  WHERE p.slug = p_slug AND p.is_active = true;

  IF v_product_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Product not found');
  END IF;

  SELECT jsonb_build_object(
    'product', (
      SELECT row_to_json(p_row)
      FROM (
        SELECT p.*,
          (SELECT jsonb_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = v_product_id) AS images,
          (SELECT row_to_json(c) FROM categories c WHERE c.id = p.category_id) AS category
        FROM products p WHERE p.id = v_product_id
      ) p_row
    ),
    'variants', COALESCE((
      SELECT jsonb_agg(v ORDER BY v.sort_order, v.name)
      FROM product_variants v
      WHERE v.product_id = v_product_id AND v.is_active = true
    ), '[]'::jsonb),
    'reviews', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.created_at DESC)
      FROM (
        SELECT r.* FROM reviews r
        WHERE r.product_id = v_product_id AND r.is_approved = true
        LIMIT 50
      ) r
    ), '[]'::jsonb),
    'review_summary', (
      SELECT jsonb_build_object(
        'avg_rating', COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0),
        'count', COUNT(*)
      )
      FROM reviews r
      WHERE r.product_id = v_product_id AND r.is_approved = true
    ),
    'related_products', COALESCE((
      SELECT jsonb_agg(row_to_json(rp_row))
      FROM (
        SELECT p2.*,
          (SELECT jsonb_agg(pi2 ORDER BY pi2.sort_order) FROM product_images pi2 WHERE pi2.product_id = p2.id) AS images,
          (SELECT row_to_json(c2) FROM categories c2 WHERE c2.id = p2.category_id) AS category
        FROM products p2
        WHERE p2.category_id = v_category_id
          AND p2.id != v_product_id
          AND p2.is_active = true
        LIMIT 4
      ) rp_row
    ), '[]'::jsonb),
    'coupons', COALESCE((
      SELECT jsonb_agg(c)
      FROM coupons c
      WHERE c.is_active = true
        AND c.show_on_storefront = true
        AND (c.start_date IS NULL OR c.start_date <= now())
        AND (c.end_date IS NULL OR c.end_date >= now())
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

-- Change stock hold expiry to 2 minutes
ALTER TABLE public.stock_holds ALTER COLUMN expires_at SET DEFAULT (now() + interval '2 minutes');
