import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Offer, Product } from '@/types/database';

interface ProductOffer {
  offer: Offer;
  discountedPrice: number;
  discountAmount: number;
  discountLabel: string;
}

export function useOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOffers();
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
    
    setOffers((data || []) as unknown as Offer[]);
    setIsLoading(false);
  };

  const getProductOffer = useCallback((product: Product): ProductOffer | null => {
    if (!product || offers.length === 0) return null;

    // Find applicable offers (product-specific first, then category-specific)
    const productOffer = offers.find(o => o.product_id === product.id);
    const categoryOffer = product.category_id 
      ? offers.find(o => o.category_id === product.category_id && !o.product_id)
      : null;

    const applicableOffer = productOffer || categoryOffer;
    if (!applicableOffer) return null;

    const basePrice = product.price;
    let discountAmount = 0;
    let discountedPrice = basePrice;
    let discountLabel = '';

    if (applicableOffer.type === 'percentage') {
      discountAmount = (basePrice * applicableOffer.value) / 100;
      // Apply max_discount cap if set
      if (applicableOffer.max_discount && discountAmount > applicableOffer.max_discount) {
        discountAmount = applicableOffer.max_discount;
      }
      discountedPrice = basePrice - discountAmount;
      discountLabel = `${applicableOffer.value}% OFF`;
    } else if (applicableOffer.type === 'flat') {
      discountAmount = applicableOffer.value;
      discountedPrice = Math.max(0, basePrice - discountAmount);
      discountLabel = `₹${applicableOffer.value} OFF`;
    } else if (applicableOffer.type === 'buy_x_get_y') {
      // For buy X get Y, show as a badge but don't change price display
      discountLabel = `Buy ${applicableOffer.buy_quantity} Get ${applicableOffer.get_quantity}`;
      discountedPrice = basePrice;
      discountAmount = 0;
    }

    return {
      offer: applicableOffer,
      discountedPrice: Math.round(discountedPrice * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountLabel,
    };
  }, [offers]);

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
    calculateCartDiscount,
    refetch: fetchOffers,
  };
}
