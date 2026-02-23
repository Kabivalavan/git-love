
-- Fix cart RLS: Drop restrictive policies and recreate as permissive

-- Cart table
DROP POLICY IF EXISTS "Admins can view all carts" ON public.cart;
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.cart;

CREATE POLICY "Admins can view all carts"
ON public.cart FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Users can manage their own cart"
ON public.cart FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Cart items table
DROP POLICY IF EXISTS "Admins can view all cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can manage their own cart items" ON public.cart_items;

CREATE POLICY "Admins can view all cart items"
ON public.cart_items FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Users can manage their own cart items"
ON public.cart_items FOR ALL
USING (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));
