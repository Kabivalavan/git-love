import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function getSessionId() {
  let sid = sessionStorage.getItem('analytics_sid');
  if (!sid) {
    sid = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('analytics_sid', sid);
  }
  return sid;
}

export function useAnalytics() {
  const location = useLocation();
  const lastPath = useRef('');
  const enterTime = useRef(Date.now());

  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      // Track time spent on previous page
      if (lastPath.current) {
        const timeSpent = Math.round((Date.now() - enterTime.current) / 1000);
        if (timeSpent > 1) {
          trackEvent('time_on_page', { page_path: lastPath.current, metadata: { seconds: timeSpent } });
        }
      }
      lastPath.current = location.pathname;
      enterTime.current = Date.now();
      trackEvent('page_view', { page_path: location.pathname });
    }
  }, [location.pathname]);

  // Track scroll depth
  useEffect(() => {
    let maxScroll = 0;
    let tracked25 = false, tracked50 = false, tracked75 = false, tracked100 = false;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const percent = Math.round((scrollTop / docHeight) * 100);
      if (percent > maxScroll) maxScroll = percent;

      if (percent >= 25 && !tracked25) { tracked25 = true; trackEvent('scroll_depth', { metadata: { depth: 25 } }); }
      if (percent >= 50 && !tracked50) { tracked50 = true; trackEvent('scroll_depth', { metadata: { depth: 50 } }); }
      if (percent >= 75 && !tracked75) { tracked75 = true; trackEvent('scroll_depth', { metadata: { depth: 75 } }); }
      if (percent >= 100 && !tracked100) { tracked100 = true; trackEvent('scroll_depth', { metadata: { depth: 100 } }); }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  // Track clicks on product-related elements
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const productCard = target.closest('[data-product-id]');
      if (productCard) {
        const productId = productCard.getAttribute('data-product-id');
        if (productId) {
          trackEvent('product_click', { product_id: productId });
        }
      }
      // Track add to cart clicks
      const addToCartBtn = target.closest('[data-action="add-to-cart"]');
      if (addToCartBtn) {
        const productId = addToCartBtn.getAttribute('data-product-id');
        if (productId) trackEvent('add_to_cart_click', { product_id: productId });
      }
      // Track wishlist clicks
      const wishlistBtn = target.closest('[data-action="add-to-wishlist"]');
      if (wishlistBtn) {
        const productId = wishlistBtn.getAttribute('data-product-id');
        if (productId) trackEvent('wishlist_click', { product_id: productId });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const trackEvent = useCallback(async (
    eventType: string,
    data?: { product_id?: string; category_id?: string; page_path?: string; metadata?: Record<string, unknown> }
  ) => {
    try {
      await supabase.from('analytics_events').insert([{
        event_type: eventType,
        page_path: data?.page_path || location.pathname,
        product_id: data?.product_id || null,
        category_id: data?.category_id || null,
        session_id: getSessionId(),
        metadata: (data?.metadata || {}) as any,
      }]);
    } catch (e) {
      // Silent fail for analytics
    }
  }, [location.pathname]);

  return { trackEvent };
}
