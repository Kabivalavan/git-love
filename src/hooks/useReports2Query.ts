import { useQuery } from '@tanstack/react-query';
import { fetchReports2Dataset, type Reports2QueryParams } from '@/api/reports2';

export function useReports2Query(params: Reports2QueryParams) {
  return useQuery({
    queryKey: ['reports2-dataset', params.fromDate, params.toDate],
    queryFn: () => fetchReports2Dataset(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}
