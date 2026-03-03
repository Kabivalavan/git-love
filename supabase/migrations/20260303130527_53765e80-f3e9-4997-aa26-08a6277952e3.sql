
CREATE OR REPLACE FUNCTION public.get_homepage_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
