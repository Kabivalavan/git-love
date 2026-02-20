-- Add admin SELECT policies for cart and cart_items so admins can view customer carts
CREATE POLICY "Admins can view all carts"
  ON public.cart FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins can view all cart items"
  ON public.cart_items FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));