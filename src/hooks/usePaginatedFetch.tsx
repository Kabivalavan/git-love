import { useState, useCallback, useRef } from 'react';
import { useInfiniteScroll } from './useInfiniteScroll';

interface UsePaginatedFetchOptions<T> {
  pageSize?: number;
  fetchFn: (from: number, to: number) => Promise<{ data: T[]; count: number }>;
}

export function usePaginatedFetch<T>({
  pageSize = 30,
  fetchFn,
}: UsePaginatedFetchOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(0);

  const fetchInitial = useCallback(async () => {
    setIsLoading(true);
    pageRef.current = 0;
    try {
      const { data, count } = await fetchFn(0, pageSize - 1);
      setItems(data);
      setTotalCount(count);
      setHasMore(data.length >= pageSize && data.length < count);
      pageRef.current = 1;
    } catch {
      // handled by caller
    }
    setIsLoading(false);
  }, [fetchFn, pageSize]);

  const fetchMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const from = pageRef.current * pageSize;
    const to = from + pageSize - 1;
    try {
      const { data, count } = await fetchFn(from, to);
      setItems(prev => [...prev, ...data]);
      setTotalCount(count);
      setHasMore(from + data.length < count);
      pageRef.current += 1;
    } catch {
      // handled by caller
    }
    setIsLoadingMore(false);
  }, [fetchFn, pageSize, isLoadingMore, hasMore]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: fetchMore,
  });

  return {
    items,
    setItems,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    sentinelRef,
    fetchInitial,
    fetchMore,
  };
}
