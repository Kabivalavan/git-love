
-- Expenses summary (accurate KPIs, not affected by frontend pagination)
CREATE OR REPLACE FUNCTION public.get_expenses_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_now date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_this_month_start date := date_trunc('month', v_now)::date;
  v_last_month_start date := (date_trunc('month', v_now) - interval '1 month')::date;
  v_last_month_end date := (date_trunc('month', v_now) - interval '1 day')::date;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH filtered AS (
    SELECT * FROM public.expenses e
    WHERE (p_from IS NULL OR e.date >= p_from)
      AND (p_to IS NULL OR e.date <= p_to)
      AND (p_category IS NULL OR p_category = 'all' OR e.category = p_category)
  ),
  this_month AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM public.expenses
    WHERE date >= v_this_month_start AND date <= v_now
  ),
  last_month AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM public.expenses
    WHERE date >= v_last_month_start AND date <= v_last_month_end
  ),
  cat_breakdown AS (
    SELECT category, COALESCE(SUM(amount), 0)::numeric AS total
    FROM public.expenses
    WHERE date >= v_this_month_start AND date <= v_now
    GROUP BY category
    ORDER BY total DESC
  )
  SELECT jsonb_build_object(
    'total_records', (SELECT COUNT(*) FROM filtered),
    'total_amount', (SELECT COALESCE(SUM(amount), 0)::numeric FROM filtered),
    'this_month_total', (SELECT total FROM this_month),
    'last_month_total', (SELECT total FROM last_month),
    'category_breakdown', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('category', category, 'total', total)) FROM cat_breakdown),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_expenses_summary(date, date, text) TO authenticated;

-- Activity log summary
CREATE OR REPLACE FUNCTION public.get_activity_log_summary(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_entity text DEFAULT NULL,
  p_action text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH filtered AS (
    SELECT * FROM public.activity_logs l
    WHERE (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to IS NULL OR l.created_at <= p_to)
      AND (p_entity IS NULL OR p_entity = 'all' OR l.entity_type = p_entity)
      AND (p_action IS NULL OR p_action = 'all' OR l.action = p_action)
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'today', (SELECT COUNT(*) FROM filtered WHERE created_at >= v_today_start),
    'creates', (SELECT COUNT(*) FROM filtered WHERE action = 'create'),
    'updates', (SELECT COUNT(*) FROM filtered WHERE action IN ('update', 'status_change')),
    'deletes', (SELECT COUNT(*) FROM filtered WHERE action = 'delete')
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_log_summary(timestamptz, timestamptz, text, text) TO authenticated;

-- Speed up activity log scroll
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_desc ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date_desc ON public.expenses (date DESC);
