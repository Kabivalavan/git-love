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

  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
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
