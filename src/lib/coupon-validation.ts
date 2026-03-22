import { supabase } from '@/integrations/supabase/client';
import type { Coupon } from '@/types/database';

type ValidateCouponParams = {
  couponCode?: string;
  couponId?: string;
  userId: string;
  subtotal: number;
};

type ValidateCouponResult = {
  coupon: Coupon | null;
  error: string | null;
};

export async function validateCouponForUser({
  couponCode,
  couponId,
  userId,
  subtotal,
}: ValidateCouponParams): Promise<ValidateCouponResult> {
  if (!couponCode && !couponId) {
    return { coupon: null, error: 'Coupon reference is missing' };
  }

  const query = supabase
    .from('coupons')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  const { data: couponRow, error: couponError } = couponCode
    ? await query.eq('code', couponCode.toUpperCase()).maybeSingle()
    : await query.eq('id', couponId as string).maybeSingle();

  if (couponError || !couponRow) {
    return { coupon: null, error: 'This coupon code is not valid' };
  }

  const coupon = couponRow as unknown as Coupon;
  const now = new Date();

  if (coupon.start_date && new Date(coupon.start_date) > now) {
    return { coupon: null, error: 'This coupon is not active yet' };
  }

  if (coupon.end_date && new Date(coupon.end_date) < now) {
    return { coupon: null, error: 'This coupon has expired' };
  }

  if (coupon.min_order_value && subtotal < coupon.min_order_value) {
    return {
      coupon: null,
      error: `Minimum order value is ₹${Math.round(coupon.min_order_value)}`,
    };
  }

  const usageLimit = coupon.usage_limit ?? null;
  const usedCount = coupon.used_count ?? 0;
  if (usageLimit !== null && usedCount >= usageLimit) {
    return { coupon: null, error: 'Coupon usage limit reached' };
  }

  const { count: userUsageCount, error: usageError } = await supabase
    .from('coupon_usage')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId);

  if (usageError) {
    return { coupon: null, error: 'Unable to validate coupon usage right now' };
  }

  const perUserLimit = coupon.per_user_limit ?? null;
  if (perUserLimit !== null && (userUsageCount ?? 0) >= perUserLimit) {
    return { coupon: null, error: 'You have reached the usage limit for this coupon' };
  }

  return { coupon, error: null };
}
