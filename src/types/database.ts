// Database types for the e-commerce platform

export type AppRole = 'admin' | 'staff' | 'customer';

export type BannerPosition = 'home_top' | 'home_middle' | 'category' | 'offer' | 'popup';
export type BannerType = 'image' | 'video';

export type OfferType = 'percentage' | 'flat' | 'buy_x_get_y';

export type OrderStatus = 'new' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
export type PaymentMethod = 'online' | 'cod' | 'wallet';

export type DeliveryStatus = 'pending' | 'assigned' | 'picked' | 'in_transit' | 'delivered' | 'failed';

export type ExpenseCategory = 'ads' | 'packaging' | 'delivery' | 'staff' | 'rent' | 'utilities' | 'software' | 'other';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  mobile_number: string | null;
  email: string | null;
  avatar_url: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  category_id: string | null;
  price: number;
  mrp: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  tax_rate: number;
  shipping_weight: number | null;
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  badge: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  images?: ProductImage[];
  variants?: ProductVariant[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number | null;
  mrp: number | null;
  stock_quantity: number;
  attributes: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: string;
  title: string;
  position: BannerPosition;
  type: BannerType;
  media_url: string;
  redirect_url: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  show_on_mobile: boolean;
  show_on_desktop: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  name: string;
  description: string | null;
  type: OfferType;
  value: number;
  buy_quantity: number | null;
  get_quantity: number | null;
  min_order_value: number | null;
  max_discount: number | null;
  category_id: string | null;
  product_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  auto_apply: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: OfferType;
  value: number;
  min_order_value: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  per_user_limit: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  mobile_number: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Shipping address stored as JSON in orders
export interface ShippingAddress {
  full_name: string;
  mobile_number: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  items?: CartItem[];
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
  variant?: ProductVariant;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount: number;
  tax: number;
  shipping_charge: number;
  total: number;
  coupon_id: string | null;
  coupon_code: string | null;
  shipping_address: ShippingAddress | Record<string, unknown>;
  billing_address: ShippingAddress | Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  delivery?: Delivery;
  payments?: Payment[];
  profile?: Profile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  price: number;
  quantity: number;
  total: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  status: DeliveryStatus;
  partner_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_date: string | null;
  delivered_at: string | null;
  delivery_charge: number;
  is_cod: boolean;
  cod_amount: number | null;
  cod_collected: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_id: string | null;
  gateway_response: Record<string, unknown> | null;
  refund_amount: number | null;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Wishlist {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
}

export interface StoreSettings {
  id: string;
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StorefrontConfig {
  id: string;
  page_name: string;
  template_id: string | null;
  sections: StorefrontSection[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorefrontSection {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  config?: Record<string, unknown>;
}

// Store info settings interface
export interface StoreInfo {
  name: string;
  tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
}

export interface ThemeSettings {
  primary_color: string;
  secondary_color: string;
  font_family: string;
  border_radius: string;
}

export interface CheckoutSettings {
  cod_enabled: boolean;
  min_order_value: number;
  free_shipping_threshold: number;
  default_shipping_charge: number;
}

export interface SocialLinks {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  youtube: string | null;
}
