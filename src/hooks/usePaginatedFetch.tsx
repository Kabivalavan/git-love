import { useState, useCallback, useRef } from 'react';
import { useInfiniteScroll } from './useInfiniteScroll';

interface UsePaginatedFetchOptions<T> {
  pageSize?: number;
  fetchFn: (from: number, to: number) => Promise<{ data: T[]; count: number }>;
  cacheKey?: string;
  cacheTimeMs?: number;
  requireUserScroll?: boolean;
}

type CachedPage<T> = {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  page: number;
  updatedAt: number;
};

const paginatedCache = new Map<string, CachedPage<unknown>>();
const inFlightInitialRequests = new Map<string, Promise<{ data: unknown[]; count: number }>>();

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
  cacheKey,
  cacheTimeMs = 2 * 60 * 1000,
  requireUserScroll = true,
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
    let initialRequest: Promise<{ data: T[]; count: number }> | null = null;

    try {
      if (cacheKey) {
        const cached = paginatedCache.get(cacheKey) as CachedPage<T> | undefined;
        if (cached && Date.now() - cached.updatedAt < cacheTimeMs) {
          setItems(cached.items);
          setTotalCount(cached.totalCount);
          setHasMore(cached.hasMore);
          pageRef.current = cached.page;
          return;
        }
      }

      const loadInitial = async () => fetchFn(0, pageSize - 1);
      let request: Promise<{ data: T[]; count: number }>;

      if (cacheKey) {
        const inFlight = inFlightInitialRequests.get(cacheKey) as Promise<{ data: T[]; count: number }> | undefined;
        if (inFlight) {
          request = inFlight;
        } else {
          request = loadInitial();
          inFlightInitialRequests.set(cacheKey, request as Promise<{ data: unknown[]; count: number }>);
        }
      } else {
        request = loadInitial();
      }

      initialRequest = request;

      const { data, count } = await request;
      const uniqueData = dedupeById(data);
      const nextHasMore = uniqueData.length < count;

      setItems(uniqueData);
      setTotalCount(count);
      setHasMore(nextHasMore);
      pageRef.current = 1;

      if (cacheKey) {
        paginatedCache.set(cacheKey, {
          items: uniqueData,
          totalCount: count,
          hasMore: nextHasMore,
          page: 1,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // handled by caller
    } finally {
      if (cacheKey && initialRequest && inFlightInitialRequests.get(cacheKey) === initialRequest) {
        inFlightInitialRequests.delete(cacheKey);
      }
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [fetchFn, pageSize, cacheKey, cacheTimeMs]);

  const fetchMore = useCallback(async () => {
    if (isFetchingRef.current || isLoading || isLoadingMore || !hasMore) return;
    isFetchingRef.current = true;
    setIsLoadingMore(true);

    const from = pageRef.current * pageSize;
    const to = from + pageSize - 1;

    try {
      const { data, count } = await fetchFn(from, to);
      let merged: T[] = [];
      setItems((prev) => {
        merged = dedupeById([...prev, ...data]);
        return merged;
      });

      const nextHasMore = merged.length < count;
      const nextPage = pageRef.current + 1;

      setTotalCount(count);
      setHasMore(nextHasMore);
      pageRef.current = nextPage;

      if (cacheKey) {
        paginatedCache.set(cacheKey, {
          items: merged,
          totalCount: count,
          hasMore: nextHasMore,
          page: nextPage,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // handled by caller
    } finally {
      isFetchingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchFn, pageSize, isLoading, isLoadingMore, hasMore, cacheKey]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading: isLoading || isLoadingMore,
    onLoadMore: fetchMore,
    requireUserScroll,
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
