
CREATE OR REPLACE FUNCTION public.get_homepage_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'banners', COALESCE((
      SELECT jsonb_agg(b ORDER BY b.sort_order)
      FROM banners b
      WHERE b.is_active = true
        AND b.position = 'home_top'
        AND (b.start_date IS NULL OR b.start_date <= now())
        AND (b.end_date IS NULL OR b.end_date >= now())
    ), '[]'::jsonb),
    'middle_banners', COALESCE((
      SELECT jsonb_agg(b ORDER BY b.sort_order)
      FROM banners b
      WHERE b.is_active = true
        AND b.position = 'home_middle'
        AND (b.start_date IS NULL OR b.start_date <= now())
        AND (b.end_date IS NULL OR b.end_date >= now())
    ), '[]'::jsonb),
    'popup_banner', (
      SELECT to_jsonb(b)
      FROM banners b
      WHERE b.is_active = true
        AND b.position = 'popup'
        AND (b.start_date IS NULL OR b.start_date <= now())
        AND (b.end_date IS NULL OR b.end_date >= now())
      ORDER BY b.sort_order
      LIMIT 1
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.sort_order)
      FROM categories c
      WHERE c.is_active = true AND c.parent_id IS NULL
    ), '[]'::jsonb),
    'offers', COALESCE((
      SELECT jsonb_agg(o)
      FROM offers o
      WHERE o.is_active = true
        AND (o.start_date IS NULL OR o.start_date <= now())
        AND (o.end_date IS NULL OR o.end_date >= now())
    ), '[]'::jsonb),
    'store_info', (
      SELECT s.value FROM store_settings s WHERE s.key = 'store_info'
    ),
    'announcement', (
      SELECT s.value FROM store_settings s WHERE s.key = 'announcement'
    ),
    'storefront_display', (
      SELECT s.value FROM store_settings s WHERE s.key = 'storefront_display'
    ),
    'bestsellers', COALESCE((
      SELECT jsonb_agg(row_to_json(p_row))
      FROM (
        SELECT p.*, 
          (SELECT jsonb_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images,
          (SELECT row_to_json(c) FROM categories c WHERE c.id = p.category_id) as category
        FROM products p
        WHERE p.is_active = true AND p.is_bestseller = true
        ORDER BY p.sort_order
        LIMIT 8
      ) p_row
    ), '[]'::jsonb),
    'featured', COALESCE((
      SELECT jsonb_agg(row_to_json(p_row))
      FROM (
        SELECT p.*, 
          (SELECT jsonb_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images,
          (SELECT row_to_json(c) FROM categories c WHERE c.id = p.category_id) as category
        FROM products p
        WHERE p.is_active = true AND p.is_featured = true
        ORDER BY p.sort_order
        LIMIT 8
      ) p_row
    ), '[]'::jsonb),
    'new_arrivals', COALESCE((
      SELECT jsonb_agg(row_to_json(p_row))
      FROM (
        SELECT p.*, 
          (SELECT jsonb_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images,
          (SELECT row_to_json(c) FROM categories c WHERE c.id = p.category_id) as category
        FROM products p
        WHERE p.is_active = true
        ORDER BY p.created_at DESC
        LIMIT 8
      ) p_row
    ), '[]'::jsonb),
    'bundles', COALESCE((
      SELECT jsonb_agg(row_to_json(b_row))
      FROM (
        SELECT b.*,
          (SELECT jsonb_agg(row_to_json(bi_row) ORDER BY bi_row.sort_order)
           FROM (
             SELECT bi.*, 
               (SELECT row_to_json(bp) FROM (
                 SELECT p2.name, p2.price, 
                   (SELECT jsonb_agg(pi2 ORDER BY pi2.sort_order) FROM product_images pi2 WHERE pi2.product_id = p2.id) as images
                 FROM products p2 WHERE p2.id = bi.product_id
               ) bp) as product
             FROM bundle_items bi WHERE bi.bundle_id = b.id
           ) bi_row
          ) as items
        FROM bundles b
        WHERE b.is_active = true
        ORDER BY b.sort_order
        LIMIT 6
      ) b_row
    ), '[]'::jsonb),
    'review_stats', COALESCE((
      SELECT jsonb_object_agg(r.product_id, jsonb_build_object('avg_rating', r.avg_rating, 'review_count', r.review_count))
      FROM (
        SELECT rv.product_id, 
          ROUND(AVG(rv.rating)::numeric, 1) as avg_rating,
          COUNT(*) as review_count
        FROM reviews rv
        WHERE rv.is_approved = true
          AND rv.product_id IN (
            SELECT id FROM products WHERE is_active = true AND (is_bestseller = true OR is_featured = true)
            UNION
            SELECT id FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 8
          )
        GROUP BY rv.product_id
      ) r
    ), '{}'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$function$;
