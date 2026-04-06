
CREATE OR REPLACE FUNCTION public.get_homepage_critical()
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
    'store_info', (
      SELECT s.value FROM store_settings s WHERE s.key = 'store_info'
    ),
    'announcement', (
      SELECT s.value FROM store_settings s WHERE s.key = 'announcement'
    ),
    'storefront_display', (
      SELECT s.value FROM store_settings s WHERE s.key = 'storefront_display'
    ),
    'storefront_theme', (
      SELECT s.value FROM store_settings s WHERE s.key = 'storefront_theme'
    ),
    'social_links', (
      SELECT s.value FROM store_settings s WHERE s.key = 'social_links'
    ),
    'ai_assistant', (
      SELECT s.value FROM store_settings s WHERE s.key = 'ai_assistant'
    ),
    'conversion_optimization', (
      SELECT s.value FROM store_settings s WHERE s.key = 'conversion_optimization'
    )
  ) INTO result;

  RETURN result;
END;
$function$;
