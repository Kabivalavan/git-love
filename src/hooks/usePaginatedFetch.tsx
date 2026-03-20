import { useState, useCallback, useRef } from 'react';
import { useInfiniteScroll } from './useInfiniteScroll';

interface UsePaginatedFetchOptions<T> {
  pageSize?: number;
  fetchFn: (from: number, to: number) => Promise<{ data: T[]; count: number }>;
}

function dedupeById<T>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = (item as { id?: string })?.id;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function usePaginatedFetch<T>({
  pageSize = 30,
  fetchFn,
}: UsePaginatedFetchOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(0);
  const isFetchingRef = useRef(false);

  const fetchInitial = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    pageRef.current = 0;
    setHasMore(false);
    try {
      const { data, count } = await fetchFn(0, pageSize - 1);
      const uniqueData = dedupeById(data);
      setItems(uniqueData);
      setTotalCount(count);
      setHasMore(uniqueData.length < count);
      pageRef.current = 1;
    } catch {
      // handled by caller
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [fetchFn, pageSize]);

  const fetchMore = useCallback(async () => {
    if (isFetchingRef.current || isLoading || isLoadingMore || !hasMore) return;
    isFetchingRef.current = true;
    setIsLoadingMore(true);
    const from = pageRef.current * pageSize;
    const to = from + pageSize - 1;
    try {
      const { data, count } = await fetchFn(from, to);
      setItems(prev => dedupeById([...prev, ...data]));
      setTotalCount(count);
      setHasMore(from + data.length < count);
      pageRef.current += 1;
    } catch {
      // handled by caller
    } finally {
      isFetchingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchFn, pageSize, isLoading, isLoadingMore, hasMore]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading: isLoading || isLoadingMore,
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
