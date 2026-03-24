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

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isLoading && hasUserScrolled) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore, hasUserScrolled]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin,
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver, rootMargin]);

  return sentinelRef;
}
