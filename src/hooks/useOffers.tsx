import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Offer, Product } from '@/types/database';

interface ProductOffer {
  offer: Offer & { variant_ids?: string[] | null };
  discountedPrice: number;
  discountAmount: number;
  discountLabel: string;
}

export function useOffers() {
  const [offers, setOffers] = useState<(Offer & { variant_ids?: string[] | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => fetchOffers(), 800);
    return () => clearTimeout(timer);
  }, []);

  const fetchOffers = async () => {
    setIsLoading(true);
    const now = new Date().toISOString();
    
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`);
    
    setOffers((data || []) as unknown as (Offer & { variant_ids?: string[] | null })[]);
    setIsLoading(false);
  };

  const getProductOffer = useCallback((product: Product, variantId?: string | null): ProductOffer | null => {
    if (!product || offers.length === 0) return null;

    const now = new Date();
    const activeOffers = offers.filter(o => {
      if (o.end_date && new Date(o.end_date) < now) return false;
      if (o.start_date && new Date(o.start_date) > now) return false;
      return true;
    });

    // Find applicable offers (product-specific first, then category-specific)
    let productOffer = activeOffers.find(o => {
      if (o.product_id !== product.id) return false;
      // Check variant-specific targeting
      if (o.variant_ids && o.variant_ids.length > 0 && variantId) {
        return o.variant_ids.includes(variantId);
      }
      if (o.variant_ids && o.variant_ids.length > 0 && !variantId) {
        return false; // variant-specific offer but no variant provided
      }
      return true;
    });

    const categoryOffer = product.category_id 
      ? activeOffers.find(o => o.category_id === product.category_id && !o.product_id)
      : null;

    const applicableOffer = productOffer || categoryOffer;
    if (!applicableOffer) return null;

    const basePrice = product.price;
    let discountAmount = 0;
    let discountedPrice = basePrice;
    let discountLabel = '';

    if (applicableOffer.type === 'percentage') {
      discountAmount = (basePrice * applicableOffer.value) / 100;
      if (applicableOffer.max_discount && discountAmount > applicableOffer.max_discount) {
        discountAmount = applicableOffer.max_discount;
      }
      discountedPrice = basePrice - discountAmount;
      discountLabel = `${applicableOffer.value}% OFF`;
    } else if (applicableOffer.type === 'flat') {
      discountAmount = applicableOffer.value;
      discountedPrice = Math.max(0, basePrice - discountAmount);
      discountLabel = `₹${Math.round(applicableOffer.value)} OFF`;
    } else if (applicableOffer.type === 'buy_x_get_y') {
      discountLabel = `Buy ${applicableOffer.buy_quantity} Get ${applicableOffer.get_quantity}`;
      discountedPrice = basePrice;
      discountAmount = 0;
    }

    return {
      offer: applicableOffer,
      discountedPrice: Math.round(discountedPrice),
      discountAmount: Math.round(discountAmount),
      discountLabel,
    };
  }, [offers]);

  const getVariantOffer = useCallback((product: Product, variantId: string): ProductOffer | null => {
    return getProductOffer(product, variantId);
  }, [getProductOffer]);

  // Check if any variant of a product has an offer (for default variant selection)
  const getFirstVariantWithOffer = useCallback((product: Product, variantIds: string[]): string | null => {
    for (const vid of variantIds) {
      const offer = getProductOffer(product, vid);
      if (offer && offer.discountAmount > 0) return vid;
    }
    return null;
  }, [getProductOffer]);

  const calculateCartDiscount = useCallback((
    products: { product: Product; quantity: number }[]
  ): { totalDiscount: number; appliedOffers: { offer: Offer; discount: number }[] } => {
    const appliedOffers: { offer: Offer; discount: number }[] = [];
    let totalDiscount = 0;

    products.forEach(({ product, quantity }) => {
      const productOffer = getProductOffer(product);
      if (productOffer && productOffer.discountAmount > 0) {
        const discount = productOffer.discountAmount * quantity;
        totalDiscount += discount;
        
        const existingOffer = appliedOffers.find(ao => ao.offer.id === productOffer.offer.id);
        if (existingOffer) {
          existingOffer.discount += discount;
        } else {
          appliedOffers.push({ offer: productOffer.offer, discount });
        }
      }
    });

    return { totalDiscount, appliedOffers };
  }, [getProductOffer]);

  return {
    offers,
    isLoading,
    getProductOffer,
    getVariantOffer,
    getFirstVariantWithOffer,
    calculateCartDiscount,
    refetch: fetchOffers,
  };
}
