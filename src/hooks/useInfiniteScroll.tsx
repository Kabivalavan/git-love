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
  const [hasUserScrolled, setHasUserScrolled] = useState(!requireUserScroll);
  const callbackRef = useRef<(entries: IntersectionObserverEntry[]) => void>(() => {});
  const lastLoadRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

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

  // Setup/teardown observer when rootMargin changes
  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => callbackRef.current(entries),
      { rootMargin }
    );
    // If element is already attached, observe it
    if (elementRef.current) {
      observerRef.current.observe(elementRef.current);
    }
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [rootMargin]);

  // Callback ref: re-observe whenever the DOM element changes (mount/unmount/swap)
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    // Unobserve old element
    if (elementRef.current && observerRef.current) {
      observerRef.current.unobserve(elementRef.current);
    }
    elementRef.current = node;
    // Observe new element
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  return sentinelRef;
}
