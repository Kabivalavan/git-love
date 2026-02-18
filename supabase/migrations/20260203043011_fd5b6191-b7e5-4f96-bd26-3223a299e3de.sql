-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('products', 'products', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('banners', 'banners', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']),
  ('categories', 'categories', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('store', 'store', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/x-icon'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for products bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'products');

CREATE POLICY "Staff can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'products' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Staff can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'products' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

-- Storage policies for banners bucket
CREATE POLICY "Anyone can view banner images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'banners');

CREATE POLICY "Staff can manage banner images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'banners' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')))
WITH CHECK (bucket_id = 'banners' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

-- Storage policies for categories bucket
CREATE POLICY "Anyone can view category images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'categories');

CREATE POLICY "Staff can manage category images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'categories' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')))
WITH CHECK (bucket_id = 'categories' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));

-- Storage policies for store bucket (logo, favicon, etc)
CREATE POLICY "Anyone can view store images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'store');

CREATE POLICY "Admins can manage store images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'store' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'store' AND public.has_role(auth.uid(), 'admin'));