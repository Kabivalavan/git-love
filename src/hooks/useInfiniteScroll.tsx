import { useEffect, useRef, useCallback, useState } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
  rootMargin?: string;
  requireUserScroll?: boolean;
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '200px',
  requireUserScroll = true,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [hasUserScrolled, setHasUserScrolled] = useState(!requireUserScroll);
  const callbackRef = useRef<(entries: IntersectionObserverEntry[]) => void>(() => {});
  const lastLoadRef = useRef(0);

  useEffect(() => {
    if (!requireUserScroll || hasUserScrolled) return;

    const markScrolled = () => setHasUserScrolled(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) {
        markScrolled();
      }
    };

    window.addEventListener('scroll', markScrolled, true);
    window.addEventListener('wheel', markScrolled, { passive: true });
    window.addEventListener('touchmove', markScrolled, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', markScrolled, true);
      window.removeEventListener('wheel', markScrolled);
      window.removeEventListener('touchmove', markScrolled);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [requireUserScroll, hasUserScrolled]);

  // Keep callback ref updated without re-creating observer
  callbackRef.current = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      const now = Date.now();
      if (target.isIntersecting && hasMore && !isLoading && hasUserScrolled && now - lastLoadRef.current > 800) {
        lastLoadRef.current = now;
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore, hasUserScrolled]
  );

  // Observer created only once (or when rootMargin changes), uses stable ref
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => callbackRef.current(entries),
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return sentinelRef;
}
