-- =============================================
-- SINGLE-BRAND E-COMMERCE PLATFORM SCHEMA
-- =============================================

-- 1. USER ROLES SYSTEM
-- =============================================
create type public.app_role as enum ('admin', 'staff', 'customer');

create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role app_role not null default 'customer',
    created_at timestamp with time zone default now(),
    unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer function to check roles (prevents RLS recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Function to get user's highest role
create or replace function public.get_user_role(_user_id uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles
  where user_id = _user_id
  order by 
    case role 
      when 'admin' then 1 
      when 'staff' then 2 
      when 'customer' then 3 
    end
  limit 1
$$;

-- RLS for user_roles
create policy "Users can view their own roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Only admins can manage roles"
on public.user_roles for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 2. USER PROFILES
-- =============================================
create table public.profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null unique,
    full_name text,
    mobile_number text unique,
    email text,
    avatar_url text,
    is_blocked boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (user_id = auth.uid());

create policy "Admins can manage all profiles"
on public.profiles for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 3. CATEGORIES
-- =============================================
create table public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    description text,
    image_url text,
    parent_id uuid references public.categories(id) on delete set null,
    sort_order integer default 0,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.categories enable row level security;

create policy "Anyone can view active categories"
on public.categories for select
to anon, authenticated
using (is_active = true or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Admins can manage categories"
on public.categories for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 4. PRODUCTS
-- =============================================
create table public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    description text,
    short_description text,
    category_id uuid references public.categories(id) on delete set null,
    price numeric(10,2) not null,
    mrp numeric(10,2),
    cost_price numeric(10,2),
    sku text unique,
    barcode text,
    stock_quantity integer default 0,
    low_stock_threshold integer default 5,
    tax_rate numeric(5,2) default 0,
    shipping_weight numeric(10,2),
    is_active boolean default true,
    is_featured boolean default false,
    is_bestseller boolean default false,
    badge text,
    sort_order integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.products enable row level security;

create policy "Anyone can view active products"
on public.products for select
to anon, authenticated
using (is_active = true or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Staff can manage products"
on public.products for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 5. PRODUCT IMAGES
-- =============================================
create table public.product_images (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete cascade not null,
    image_url text not null,
    alt_text text,
    sort_order integer default 0,
    is_primary boolean default false,
    created_at timestamp with time zone default now()
);

alter table public.product_images enable row level security;

create policy "Anyone can view product images"
on public.product_images for select
to anon, authenticated
using (true);

create policy "Staff can manage product images"
on public.product_images for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 6. PRODUCT VARIANTS
-- =============================================
create table public.product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete cascade not null,
    name text not null,
    sku text,
    price numeric(10,2),
    mrp numeric(10,2),
    stock_quantity integer default 0,
    attributes jsonb default '{}',
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.product_variants enable row level security;

create policy "Anyone can view active variants"
on public.product_variants for select
to anon, authenticated
using (is_active = true or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Staff can manage variants"
on public.product_variants for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 7. BANNERS
-- =============================================
create type public.banner_position as enum ('home_top', 'home_middle', 'category', 'offer', 'popup');
create type public.banner_type as enum ('image', 'video');

create table public.banners (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    position banner_position not null,
    type banner_type default 'image',
    media_url text not null,
    redirect_url text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    is_active boolean default true,
    show_on_mobile boolean default true,
    show_on_desktop boolean default true,
    sort_order integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.banners enable row level security;

create policy "Anyone can view active banners"
on public.banners for select
to anon, authenticated
using (is_active = true and (start_date is null or start_date <= now()) and (end_date is null or end_date >= now()) 
       or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Staff can manage banners"
on public.banners for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 8. OFFERS
-- =============================================
create type public.offer_type as enum ('percentage', 'flat', 'buy_x_get_y');

create table public.offers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    type offer_type not null,
    value numeric(10,2) not null,
    buy_quantity integer,
    get_quantity integer,
    min_order_value numeric(10,2),
    max_discount numeric(10,2),
    category_id uuid references public.categories(id) on delete cascade,
    product_id uuid references public.products(id) on delete cascade,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    is_active boolean default true,
    auto_apply boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.offers enable row level security;

create policy "Anyone can view active offers"
on public.offers for select
to anon, authenticated
using (is_active = true and (start_date is null or start_date <= now()) and (end_date is null or end_date >= now())
       or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Staff can manage offers"
on public.offers for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 9. COUPONS
-- =============================================
create table public.coupons (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    description text,
    type offer_type not null,
    value numeric(10,2) not null,
    min_order_value numeric(10,2),
    max_discount numeric(10,2),
    usage_limit integer,
    used_count integer default 0,
    per_user_limit integer default 1,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.coupons enable row level security;

create policy "Anyone can view active coupons"
on public.coupons for select
to anon, authenticated
using (is_active = true and (start_date is null or start_date <= now()) and (end_date is null or end_date >= now())
       or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Staff can manage coupons"
on public.coupons for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 10. ADDRESSES
-- =============================================
create table public.addresses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    label text default 'Home',
    full_name text not null,
    mobile_number text not null,
    address_line1 text not null,
    address_line2 text,
    city text not null,
    state text not null,
    pincode text not null,
    landmark text,
    is_default boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.addresses enable row level security;

create policy "Users can manage their own addresses"
on public.addresses for all
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- 11. CART
-- =============================================
create table public.cart (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null unique,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.cart enable row level security;

create policy "Users can manage their own cart"
on public.cart for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 12. CART ITEMS
-- =============================================
create table public.cart_items (
    id uuid primary key default gen_random_uuid(),
    cart_id uuid references public.cart(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    variant_id uuid references public.product_variants(id) on delete set null,
    quantity integer not null default 1,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(cart_id, product_id, variant_id)
);

alter table public.cart_items enable row level security;

create policy "Users can manage their own cart items"
on public.cart_items for all
to authenticated
using (exists (select 1 from public.cart where cart.id = cart_items.cart_id and cart.user_id = auth.uid()))
with check (exists (select 1 from public.cart where cart.id = cart_items.cart_id and cart.user_id = auth.uid()));

-- 13. ORDERS
-- =============================================
create type public.order_status as enum ('new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partial');
create type public.payment_method as enum ('online', 'cod', 'wallet');

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    order_number text unique not null,
    user_id uuid references auth.users(id) on delete set null,
    status order_status default 'new',
    payment_status payment_status default 'pending',
    payment_method payment_method,
    subtotal numeric(10,2) not null,
    discount numeric(10,2) default 0,
    tax numeric(10,2) default 0,
    shipping_charge numeric(10,2) default 0,
    total numeric(10,2) not null,
    coupon_id uuid references public.coupons(id) on delete set null,
    coupon_code text,
    shipping_address jsonb not null,
    billing_address jsonb,
    notes text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.orders enable row level security;

create policy "Users can view their own orders"
on public.orders for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Users can create orders"
on public.orders for insert
to authenticated
with check (user_id = auth.uid());

create policy "Staff can manage orders"
on public.orders for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 14. ORDER ITEMS
-- =============================================
create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.orders(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete set null,
    variant_id uuid references public.product_variants(id) on delete set null,
    product_name text not null,
    variant_name text,
    sku text,
    price numeric(10,2) not null,
    quantity integer not null,
    total numeric(10,2) not null,
    created_at timestamp with time zone default now()
);

alter table public.order_items enable row level security;

create policy "Users can view their own order items"
on public.order_items for select
to authenticated
using (exists (select 1 from public.orders where orders.id = order_items.order_id and (orders.user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))));

create policy "Users can create order items"
on public.order_items for insert
to authenticated
with check (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));

create policy "Staff can manage order items"
on public.order_items for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 15. DELIVERIES
-- =============================================
create type public.delivery_status as enum ('pending', 'assigned', 'picked', 'in_transit', 'delivered', 'failed');

create table public.deliveries (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.orders(id) on delete cascade not null,
    status delivery_status default 'pending',
    partner_name text,
    tracking_number text,
    tracking_url text,
    estimated_date timestamp with time zone,
    delivered_at timestamp with time zone,
    delivery_charge numeric(10,2) default 0,
    is_cod boolean default false,
    cod_amount numeric(10,2),
    cod_collected boolean default false,
    notes text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.deliveries enable row level security;

create policy "Users can view their own deliveries"
on public.deliveries for select
to authenticated
using (exists (select 1 from public.orders where orders.id = deliveries.order_id and (orders.user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))));

create policy "Staff can manage deliveries"
on public.deliveries for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 16. PAYMENTS
-- =============================================
create table public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.orders(id) on delete cascade not null,
    amount numeric(10,2) not null,
    method payment_method not null,
    status payment_status default 'pending',
    transaction_id text,
    gateway_response jsonb,
    refund_amount numeric(10,2),
    refund_reason text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.payments enable row level security;

create policy "Users can view their own payments"
on public.payments for select
to authenticated
using (exists (select 1 from public.orders where orders.id = payments.order_id and (orders.user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))));

create policy "Staff can manage payments"
on public.payments for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 17. EXPENSES
-- =============================================
create type public.expense_category as enum ('ads', 'packaging', 'delivery', 'staff', 'rent', 'utilities', 'software', 'other');

create table public.expenses (
    id uuid primary key default gen_random_uuid(),
    category expense_category not null,
    description text not null,
    amount numeric(10,2) not null,
    date date not null,
    receipt_url text,
    notes text,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.expenses enable row level security;

create policy "Staff can manage expenses"
on public.expenses for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 18. REVIEWS
-- =============================================
create table public.reviews (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete set null,
    rating integer not null check (rating >= 1 and rating <= 5),
    title text,
    comment text,
    is_verified boolean default false,
    is_approved boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.reviews enable row level security;

create policy "Anyone can view approved reviews"
on public.reviews for select
to anon, authenticated
using (is_approved = true or user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Users can create reviews"
on public.reviews for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own reviews"
on public.reviews for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Staff can manage reviews"
on public.reviews for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- 19. WISHLIST
-- =============================================
create table public.wishlist (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    created_at timestamp with time zone default now(),
    unique(user_id, product_id)
);

alter table public.wishlist enable row level security;

create policy "Users can manage their own wishlist"
on public.wishlist for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 20. STORE SETTINGS
-- =============================================
create table public.store_settings (
    id uuid primary key default gen_random_uuid(),
    key text unique not null,
    value jsonb not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.store_settings enable row level security;

create policy "Anyone can view store settings"
on public.store_settings for select
to anon, authenticated
using (true);

create policy "Admins can manage store settings"
on public.store_settings for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 21. STOREFRONT CONFIG (Page Builder)
-- =============================================
create table public.storefront_config (
    id uuid primary key default gen_random_uuid(),
    page_name text not null,
    template_id text,
    sections jsonb default '[]',
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(page_name)
);

alter table public.storefront_config enable row level security;

create policy "Anyone can view storefront config"
on public.storefront_config for select
to anon, authenticated
using (true);

create policy "Admins can manage storefront config"
on public.storefront_config for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 22. COUPON USAGE TRACKING
-- =============================================
create table public.coupon_usage (
    id uuid primary key default gen_random_uuid(),
    coupon_id uuid references public.coupons(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    order_id uuid references public.orders(id) on delete set null,
    used_at timestamp with time zone default now(),
    unique(coupon_id, user_id, order_id)
);

alter table public.coupon_usage enable row level security;

create policy "Users can view their own coupon usage"
on public.coupon_usage for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create policy "Users can track their coupon usage"
on public.coupon_usage for insert
to authenticated
with check (user_id = auth.uid());

create policy "Staff can manage coupon usage"
on public.coupon_usage for all
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

-- HELPER FUNCTIONS
-- =============================================

-- Generate order number
create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  new_number text;
begin
  new_number := 'ORD' || to_char(now(), 'YYYYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');
  return new_number;
end;
$$;

-- Update timestamps trigger function
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers to all tables
create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger update_categories_updated_at before update on public.categories for each row execute function public.update_updated_at_column();
create trigger update_products_updated_at before update on public.products for each row execute function public.update_updated_at_column();
create trigger update_product_variants_updated_at before update on public.product_variants for each row execute function public.update_updated_at_column();
create trigger update_banners_updated_at before update on public.banners for each row execute function public.update_updated_at_column();
create trigger update_offers_updated_at before update on public.offers for each row execute function public.update_updated_at_column();
create trigger update_coupons_updated_at before update on public.coupons for each row execute function public.update_updated_at_column();
create trigger update_addresses_updated_at before update on public.addresses for each row execute function public.update_updated_at_column();
create trigger update_cart_updated_at before update on public.cart for each row execute function public.update_updated_at_column();
create trigger update_cart_items_updated_at before update on public.cart_items for each row execute function public.update_updated_at_column();
create trigger update_orders_updated_at before update on public.orders for each row execute function public.update_updated_at_column();
create trigger update_deliveries_updated_at before update on public.deliveries for each row execute function public.update_updated_at_column();
create trigger update_payments_updated_at before update on public.payments for each row execute function public.update_updated_at_column();
create trigger update_expenses_updated_at before update on public.expenses for each row execute function public.update_updated_at_column();
create trigger update_reviews_updated_at before update on public.reviews for each row execute function public.update_updated_at_column();
create trigger update_store_settings_updated_at before update on public.store_settings for each row execute function public.update_updated_at_column();
create trigger update_storefront_config_updated_at before update on public.storefront_config for each row execute function public.update_updated_at_column();

-- Insert default store settings
insert into public.store_settings (key, value) values
  ('store_info', '{"name": "My Store", "tagline": "Your one-stop shop", "logo_url": null, "favicon_url": null, "contact_email": null, "contact_phone": null, "address": null}'),
  ('theme', '{"primary_color": "#3B82F6", "secondary_color": "#10B981", "font_family": "Inter", "border_radius": "8px"}'),
  ('checkout', '{"cod_enabled": true, "min_order_value": 0, "free_shipping_threshold": 500, "default_shipping_charge": 50}'),
  ('social_links', '{"facebook": null, "instagram": null, "twitter": null, "youtube": null}');

-- Insert default storefront config for home page
insert into public.storefront_config (page_name, template_id, sections) values
  ('home', 'classic', '[
    {"id": "banner", "type": "banner_slider", "enabled": true, "order": 1},
    {"id": "offer_strip", "type": "offer_strip", "enabled": true, "order": 2},
    {"id": "categories", "type": "category_blocks", "enabled": true, "order": 3},
    {"id": "featured", "type": "featured_products", "enabled": true, "order": 4},
    {"id": "bestsellers", "type": "bestseller_products", "enabled": true, "order": 5}
  ]');