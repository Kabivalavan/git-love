-- Fix hold release semantics and prevent in_hold double counting
CREATE OR REPLACE FUNCTION public.release_stock_hold(p_user_id uuid, p_order_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hold_rec RECORD;
BEGIN
  FOR hold_rec IN
    SELECT *
    FROM public.stock_holds
    WHERE user_id = p_user_id
      AND (
        (p_order_id IS NULL AND order_id IS NULL)
        OR (p_order_id IS NOT NULL AND order_id = p_order_id)
      )
  LOOP
    UPDATE public.products
    SET in_hold = GREATEST(0, in_hold - hold_rec.quantity)
    WHERE id = hold_rec.product_id;

    IF hold_rec.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET in_hold = GREATEST(0, in_hold - hold_rec.quantity)
      WHERE id = hold_rec.variant_id;
    END IF;
  END LOOP;

  DELETE FROM public.stock_holds
  WHERE user_id = p_user_id
    AND (
      (p_order_id IS NULL AND order_id IS NULL)
      OR (p_order_id IS NOT NULL AND order_id = p_order_id)
    );
END;
$$;

-- Ensure place_stock_hold fully refreshes existing checkout holds
CREATE OR REPLACE FUNCTION public.place_stock_hold(p_user_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  p_id uuid;
  v_id uuid;
  qty integer;
  avail integer;
  result jsonb := '{"success": true, "errors": []}'::jsonb;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Clean expired holds and decrement in_hold counters correctly
  PERFORM public.cleanup_expired_holds();

  -- Refresh only this user's active checkout holds (order_id IS NULL)
  PERFORM public.release_stock_hold(p_user_id, NULL);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    p_id := (item->>'product_id')::uuid;
    v_id := CASE
      WHEN item->>'variant_id' IS NOT NULL AND item->>'variant_id' != 'null'
      THEN (item->>'variant_id')::uuid
      ELSE NULL
    END;
    qty := (item->>'quantity')::integer;

    IF v_id IS NOT NULL THEN
      SELECT GREATEST(0, stock_quantity - in_hold) INTO avail
      FROM public.product_variants
      WHERE id = v_id;
    ELSE
      SELECT GREATEST(0, stock_quantity - in_hold) INTO avail
      FROM public.products
      WHERE id = p_id;
    END IF;

    IF avail < qty THEN
      errors := errors || jsonb_build_object(
        'product_id', p_id,
        'message', 'Insufficient stock',
        'available', COALESCE(avail, 0),
        'requested', qty
      );
    ELSE
      INSERT INTO public.stock_holds (user_id, product_id, variant_id, quantity, expires_at)
      VALUES (p_user_id, p_id, v_id, qty, now() + interval '2 minutes');

      UPDATE public.products
      SET in_hold = in_hold + qty
      WHERE id = p_id;

      IF v_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET in_hold = in_hold + qty
        WHERE id = v_id;
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(errors) > 0 THEN
    PERFORM public.release_stock_hold(p_user_id, NULL);
    result := jsonb_build_object('success', false, 'errors', errors);
  END IF;

  RETURN result;
END;
$$;