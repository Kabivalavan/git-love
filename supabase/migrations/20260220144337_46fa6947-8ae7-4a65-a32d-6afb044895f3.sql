
-- Add in_hold column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS in_hold integer NOT NULL DEFAULT 0;

-- Add in_hold column to product_variants table  
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS in_hold integer NOT NULL DEFAULT 0;

-- Create stock_holds table to track temporary holds during checkout (3-min window)
CREATE TABLE IF NOT EXISTS public.stock_holds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '3 minutes'),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on stock_holds
ALTER TABLE public.stock_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own holds" ON public.stock_holds
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all holds" ON public.stock_holds
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Function to place items on hold (called at checkout start)
CREATE OR REPLACE FUNCTION public.place_stock_hold(
  p_user_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- Clean expired holds first
  DELETE FROM public.stock_holds WHERE expires_at < now();
  
  -- Remove existing holds for this user (refresh)
  DELETE FROM public.stock_holds WHERE user_id = p_user_id AND order_id IS NULL;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    p_id := (item->>'product_id')::uuid;
    v_id := CASE WHEN item->>'variant_id' IS NOT NULL AND item->>'variant_id' != 'null' 
                 THEN (item->>'variant_id')::uuid ELSE NULL END;
    qty := (item->>'quantity')::integer;

    -- Check available stock (stock - in_hold)
    IF v_id IS NOT NULL THEN
      SELECT GREATEST(0, stock_quantity - in_hold) INTO avail
      FROM public.product_variants WHERE id = v_id;
    ELSE
      SELECT GREATEST(0, stock_quantity - in_hold) INTO avail
      FROM public.products WHERE id = p_id;
    END IF;

    IF avail < qty THEN
      errors := errors || jsonb_build_object('product_id', p_id, 'message', 'Insufficient stock');
    ELSE
      -- Place hold
      INSERT INTO public.stock_holds (user_id, product_id, variant_id, quantity)
      VALUES (p_user_id, p_id, v_id, qty);

      -- Increment in_hold on product
      UPDATE public.products SET in_hold = in_hold + qty WHERE id = p_id;

      -- Increment in_hold on variant if applicable
      IF v_id IS NOT NULL THEN
        UPDATE public.product_variants SET in_hold = in_hold + qty WHERE id = v_id;
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(errors) > 0 THEN
    -- Roll back holds we just placed for this user
    PERFORM public.release_stock_hold(p_user_id, NULL);
    result := jsonb_build_object('success', false, 'errors', errors);
  END IF;

  RETURN result;
END;
$$;

-- Function to release holds for a user (called on cancel/expiry/success)
CREATE OR REPLACE FUNCTION public.release_stock_hold(
  p_user_id uuid,
  p_order_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hold_rec RECORD;
BEGIN
  FOR hold_rec IN 
    SELECT * FROM public.stock_holds 
    WHERE user_id = p_user_id 
      AND (p_order_id IS NULL OR order_id = p_order_id OR order_id IS NULL)
  LOOP
    -- Decrement in_hold on product
    UPDATE public.products 
    SET in_hold = GREATEST(0, in_hold - hold_rec.quantity) 
    WHERE id = hold_rec.product_id;

    -- Decrement in_hold on variant if applicable
    IF hold_rec.variant_id IS NOT NULL THEN
      UPDATE public.product_variants 
      SET in_hold = GREATEST(0, in_hold - hold_rec.quantity) 
      WHERE id = hold_rec.variant_id;
    END IF;
  END LOOP;

  -- Delete the holds
  DELETE FROM public.stock_holds 
  WHERE user_id = p_user_id 
    AND (p_order_id IS NULL OR order_id = p_order_id OR order_id IS NULL);
END;
$$;

-- Function to finalize hold to actual stock deduction (called on shipped/delivered)
CREATE OR REPLACE FUNCTION public.finalize_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_rec RECORD;
BEGIN
  -- Check if already finalized (idempotent)
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id AND status IN ('shipped', 'delivered') 
             AND NOT EXISTS (SELECT 1 FROM public.stock_holds WHERE order_id = p_order_id)) THEN
    RETURN;
  END IF;

  -- Deduct actual stock and release in_hold for each order item
  FOR item_rec IN 
    SELECT oi.product_id, oi.variant_id, oi.quantity 
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Reduce actual stock_quantity
    UPDATE public.products 
    SET stock_quantity = GREATEST(0, stock_quantity - item_rec.quantity),
        in_hold = GREATEST(0, in_hold - item_rec.quantity)
    WHERE id = item_rec.product_id;

    IF item_rec.variant_id IS NOT NULL THEN
      UPDATE public.product_variants 
      SET stock_quantity = GREATEST(0, stock_quantity - item_rec.quantity),
          in_hold = GREATEST(0, in_hold - item_rec.quantity)
      WHERE id = item_rec.variant_id;
    END IF;
  END LOOP;

  -- Mark holds as finalized (linked to order) — cleanup
  DELETE FROM public.stock_holds WHERE order_id = p_order_id;
END;
$$;

-- Function to cleanup expired holds automatically
CREATE OR REPLACE FUNCTION public.cleanup_expired_holds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hold_rec RECORD;
BEGIN
  FOR hold_rec IN 
    SELECT * FROM public.stock_holds WHERE expires_at < now()
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

  DELETE FROM public.stock_holds WHERE expires_at < now();
END;
$$;
