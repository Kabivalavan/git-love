
-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Performance indexes for high-concurrency storefront
CREATE INDEX IF NOT EXISTS idx_products_active_sort ON public.products(is_active, sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_active_category ON public.products(category_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_active_featured ON public.products(is_featured, is_active) WHERE is_active = true AND is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_active_bestseller ON public.products(is_bestseller, is_active) WHERE is_active = true AND is_bestseller = true;
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_created ON public.products(created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_name_search ON public.products USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id, is_primary, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_reviews_product_approved ON public.reviews(product_id, rating) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_categories_active_parent ON public.categories(parent_id, sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_active ON public.offers(is_active, product_id, category_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_banners_active_position ON public.banners(position, sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coupons_storefront ON public.coupons(is_active, show_on_storefront) WHERE is_active = true AND show_on_storefront = true;
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON public.wishlist(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_time ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type, created_at DESC);
