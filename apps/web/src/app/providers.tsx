import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { isApiError } from '../api/client';
import { ToastProvider } from '../components/ui/Toast';
import { TooltipProvider } from '@/components/shadcn/tooltip';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Retry transient failures only (network, 5xx, 429), never auth/validation errors.
        retry: (count, error) => {
          if (
            isApiError(error) &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429
          )
            return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
