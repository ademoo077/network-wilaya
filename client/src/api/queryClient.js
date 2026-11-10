import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({ defaultOptions: {
  queries: { staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false,
    retry: (count, error) => count < 1 && error?.status >= 500 },
  mutations: { retry: false },
} });
