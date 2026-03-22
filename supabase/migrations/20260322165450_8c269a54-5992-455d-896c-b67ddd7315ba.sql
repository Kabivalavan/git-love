-- Keep coupon counters and limits consistent on every coupon usage insert
CREATE OR REPLACE FUNCTION public.process_coupon_usage_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_user_usage INTEGER;
BEGIN
  SELECT
    c.id,
    c.is_active,
    c.start_date,
    c.end_date,
    c.usage_limit,
    c.per_user_limit,
    COALESCE(c.used_count, 0) AS used_count
  INTO v_coupon
  FROM public.coupons c
  WHERE c.id = NEW.coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found';
  END IF;

  IF v_coupon.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Coupon is inactive';
  END IF;

  IF v_coupon.start_date IS NOT NULL AND v_coupon.start_date > now() THEN
    RAISE EXCEPTION 'Coupon is not active yet';
  END IF;

  IF v_coupon.end_date IS NOT NULL AND v_coupon.end_date < now() THEN
    UPDATE public.coupons SET is_active = false WHERE id = v_coupon.id;
    RAISE EXCEPTION 'Coupon has expired';
  END IF;

  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
    UPDATE public.coupons SET is_active = false WHERE id = v_coupon.id;
    RAISE EXCEPTION 'Coupon usage limit reached';
  END IF;

  IF v_coupon.per_user_limit IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_user_usage
    FROM public.coupon_usage cu
    WHERE cu.coupon_id = NEW.coupon_id
      AND cu.user_id = NEW.user_id;

    IF v_user_usage >= v_coupon.per_user_limit THEN
      RAISE EXCEPTION 'Per-user coupon usage limit reached';
    END IF;
  END IF;

  UPDATE public.coupons
  SET
    used_count = v_coupon.used_count + 1,
    is_active = CASE
      WHEN usage_limit IS NOT NULL AND (v_coupon.used_count + 1) >= usage_limit THEN false
      ELSE is_active
    END
  WHERE id = v_coupon.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_coupon_usage_insert ON public.coupon_usage;
CREATE TRIGGER process_coupon_usage_insert
BEFORE INSERT ON public.coupon_usage
FOR EACH ROW
EXECUTE FUNCTION public.process_coupon_usage_insert();

-- Backfill counters for existing data so admin usage display is immediately correct
WITH usage_counts AS (
  SELECT coupon_id, COUNT(*)::integer AS usage_count
  FROM public.coupon_usage
  GROUP BY coupon_id
)
UPDATE public.coupons c
SET
  used_count = COALESCE(u.usage_count, 0),
  is_active = CASE
    WHEN c.usage_limit IS NOT NULL AND COALESCE(u.usage_count, 0) >= c.usage_limit THEN false
    ELSE c.is_active
  END
FROM usage_counts u
WHERE c.id = u.coupon_id;

UPDATE public.coupons c
SET used_count = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.coupon_usage cu WHERE cu.coupon_id = c.id
);