/**
 * Centralized React Query hooks for Admin pages.
 * 
 * Every admin page should use these hooks instead of calling supabase directly.
 * Benefits: shared cache, deduplication, stale-while-revalidate, invalidation-based realtime.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchAllStoreSettings,
  upsertStoreSetting,
  fetchAdminProducts,
  fetchAdminCategories,
  fetchDashboardData,
  fetchLiveViewerStats,
  fetchAdminCustomers,
  fetchAdminCoupons,
  fetchAdminOffers,
  fetchAdminExpenses,
  fetchAdminBanners,
  deleteProduct,
  saveProduct,
  saveCategory,
  deleteCategory,
} from '@/api/admin';
import type { Product } from '@/types/database';

// ─── Query Keys (single source of truth) ───
export const ADMIN_KEYS = {
  storeSettings: ['admin-store-settings'] as const,
  products: ['admin-products'] as const,
  categories: ['admin-categories'] as const,
  dashboard: ['admin-dashboard'] as const,
  liveViewers: ['admin-live-viewers'] as const,
  customers: ['admin-customers'] as const,
  coupons: ['admin-coupons'] as const,
  offers: ['admin-offers'] as const,
  expenses: ['admin-expenses'] as const,
  banners: ['admin-banners'] as const,
};

// ─── Store Settings (shared across Settings, Orders, Customers, etc.) ───
export function useAdminStoreSettings() {
  return useQuery({
    queryKey: ADMIN_KEYS.storeSettings,
    queryFn: fetchAllStoreSettings,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSaveStoreSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: Record<string, unknown> }) =>
      upsertStoreSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.storeSettings });
      // Also invalidate storefront caches
      queryClient.invalidateQueries({ queryKey: ['global-store-data'] });
      queryClient.invalidateQueries({ queryKey: ['checkout-settings'] });
    },
  });
}

// ─── Products ───
export function useAdminProducts() {
  return useQuery({
    queryKey: ADMIN_KEYS.products,
    queryFn: fetchAdminProducts,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Product) => deleteProduct(product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.products });
      queryClient.invalidateQueries({ queryKey: ['global-store-data'] });
    },
  });
}

export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      productData,
      imageUrls,
      variantRecords,
      existingProductId,
    }: {
      productData: any;
      imageUrls: string[];
      variantRecords: any[];
      existingProductId?: string;
    }) => saveProduct(productData, imageUrls, variantRecords, existingProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.products });
      queryClient.invalidateQueries({ queryKey: ['global-store-data'] });
    },
  });
}

// ─── Categories ───
export function useAdminCategories() {
  return useQuery({
    queryKey: ADMIN_KEYS.categories,
    queryFn: fetchAdminCategories,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, existingId }: { data: any; existingId?: string }) =>
      saveCategory(data, existingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.categories });
      queryClient.invalidateQueries({ queryKey: ['global-store-data'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.categories });
      queryClient.invalidateQueries({ queryKey: ['global-store-data'] });
    },
  });
}

// ─── Dashboard ───
export function useAdminDashboard() {
  return useQuery({
    queryKey: ADMIN_KEYS.dashboard,
    queryFn: fetchDashboardData,
    staleTime: 60 * 1000, // 1 min for dashboard
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useAdminLiveViewers() {
  return useQuery({
    queryKey: ADMIN_KEYS.liveViewers,
    queryFn: fetchLiveViewerStats,
    staleTime: 10 * 1000, // 10s stale for live data
    gcTime: 60 * 1000,
    refetchInterval: 15000, // auto-refresh every 15s
    refetchOnWindowFocus: false,
  });
}

// ─── Customers ───
export function useAdminCustomers() {
  return useQuery({
    queryKey: ADMIN_KEYS.customers,
    queryFn: fetchAdminCustomers,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Coupons ───
export function useAdminCoupons() {
  return useQuery({
    queryKey: ADMIN_KEYS.coupons,
    queryFn: fetchAdminCoupons,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Offers ───
export function useAdminOffers() {
  return useQuery({
    queryKey: ADMIN_KEYS.offers,
    queryFn: fetchAdminOffers,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Expenses ───
export function useAdminExpenses() {
  return useQuery({
    queryKey: ADMIN_KEYS.expenses,
    queryFn: fetchAdminExpenses,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Banners ───
export function useAdminBanners() {
  return useQuery({
    queryKey: ADMIN_KEYS.banners,
    queryFn: fetchAdminBanners,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Realtime invalidation hook ───
// Use this instead of direct fetchProducts() in realtime callbacks
export function useAdminRealtimeInvalidation(
  tables: string[],
  queryKeys: string[][]
) {
  const queryClient = useQueryClient();
  const tablesKey = tables.join(',');

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleInvalidation = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }, 200);
    };

    const channel = supabase.channel(`admin-realtime-${tablesKey}`);
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleInvalidation
      );
    });
    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, tablesKey]);
}

// Helper to get a specific setting from the cached store settings
export function useStoreSettingValue<T>(key: string, defaultValue: T): T {
  const { data } = useAdminStoreSettings();
  if (!data) return defaultValue;
  const setting = data.find((s) => s.key === key);
  return setting ? (setting.value as unknown as T) : defaultValue;
}
