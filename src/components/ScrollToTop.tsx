import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Persist scroll positions per route so back-navigation restores position
const scrollPositions: Record<string, number> = {};

export function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathname = useRef<string | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const prev = prevPathname.current;

    // Save previous page's scroll position before leaving
    if (prev && prev !== pathname) {
      scrollPositions[prev] = window.scrollY;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      // On first load, just scroll to top
      window.scrollTo(0, 0);
      prevPathname.current = pathname;
      return;
    }

    // Restore saved scroll position (back navigation) or go to top
    const savedY = scrollPositions[pathname];
    if (savedY !== undefined && savedY > 0) {
      // Use rAF to wait for render
      const raf = requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: 'instant' });
      });
      prevPathname.current = pathname;
      return () => cancelAnimationFrame(raf);
    } else {
      window.scrollTo(0, 0);
    }

    prevPathname.current = pathname;
  }, [pathname]);

  return null;
}
