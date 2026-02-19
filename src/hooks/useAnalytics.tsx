import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const VISITOR_KEY = 'analytics_visitor_id';
const SESSION_KEY = 'analytics_sid';
const SESSION_LAST_ACTIVE = 'analytics_last_active';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function getSessionId(): string {
  const lastActive = sessionStorage.getItem(SESSION_LAST_ACTIVE);
  const existingId = sessionStorage.getItem(SESSION_KEY);

  // If session exists and was active within timeout, reuse it
  if (existingId && lastActive && (Date.now() - parseInt(lastActive)) < SESSION_TIMEOUT) {
    sessionStorage.setItem(SESSION_LAST_ACTIVE, Date.now().toString());
    return existingId;
  }

  // Create new session
  const newId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, newId);
  sessionStorage.setItem(SESSION_LAST_ACTIVE, Date.now().toString());
  return newId;
}

function getDevice(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

// Track session in DB
let sessionTracked = false;
async function ensureSession(visitorId: string, sessionId: string) {
  if (sessionTracked) {
    // Just update last_active
    await supabase
      .from('analytics_sessions' as any)
      .update({ last_active_at: new Date().toISOString() } as any)
      .eq('session_id', sessionId);
    return;
  }
  sessionTracked = true;
  await supabase.from('analytics_sessions' as any).insert([{
    visitor_id: visitorId,
    session_id: sessionId,
    user_agent: navigator.userAgent,
    device: getDevice(),
    referrer: document.referrer || null,
  }] as any);
}

export function useAnalytics() {
  const location = useLocation();
  const lastPath = useRef('');
  const enterTime = useRef(Date.now());
  const visitorId = useRef(getVisitorId());
  const sessionId = useRef(getSessionId());

  // Ensure session on mount
  useEffect(() => {
    ensureSession(visitorId.current, sessionId.current);
  }, []);

  // Page view tracking + time on page
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
      trackEvent('page_view', {
        page_path: location.pathname,
        metadata: { referrer: document.referrer || null },
      });

      // Update session activity
      sessionStorage.setItem(SESSION_LAST_ACTIVE, Date.now().toString());
      ensureSession(visitorId.current, sessionId.current);
    }
  }, [location.pathname]);

  // Scroll depth tracking
  useEffect(() => {
    let tracked25 = false, tracked50 = false, tracked75 = false, tracked100 = false;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const percent = Math.round((scrollTop / docHeight) * 100);

      if (percent >= 25 && !tracked25) { tracked25 = true; trackEvent('scroll_depth', { metadata: { depth: 25 } }); }
      if (percent >= 50 && !tracked50) { tracked50 = true; trackEvent('scroll_depth', { metadata: { depth: 50 } }); }
      if (percent >= 75 && !tracked75) { tracked75 = true; trackEvent('scroll_depth', { metadata: { depth: 75 } }); }
      if (percent >= 100 && !tracked100) { tracked100 = true; trackEvent('scroll_depth', { metadata: { depth: 100 } }); }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  // Click tracking for data attributes
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const productCard = target.closest('[data-product-id]');
      if (productCard) {
        const productId = productCard.getAttribute('data-product-id');
        if (productId) trackEvent('product_click', { product_id: productId });
      }
      const addToCartBtn = target.closest('[data-action="add-to-cart"]');
      if (addToCartBtn) {
        const productId = addToCartBtn.getAttribute('data-product-id');
        if (productId) trackEvent('add_to_cart', { product_id: productId });
      }
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
    data?: {
      product_id?: string;
      category_id?: string;
      page_path?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    try {
      await supabase.from('analytics_events').insert([{
        event_type: eventType,
        page_path: data?.page_path || location.pathname,
        product_id: data?.product_id || null,
        category_id: data?.category_id || null,
        session_id: sessionId.current,
        visitor_id: visitorId.current,
        referrer: document.referrer || null,
        metadata: (data?.metadata || {}) as any,
      }]);
    } catch (e) {
      // Silent fail for analytics
    }
  }, [location.pathname]);

  return { trackEvent };
}
