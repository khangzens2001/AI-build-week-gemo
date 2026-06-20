"use client";

import { PushPermissionProvider } from "@/components/push/PushPermissionProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

/**
 * Client-side providers: NextAuth session + React Query + push-permission drawer.
 * Wrapped once in the root layout so every client component can read auth state,
 * cached data, and call requestPushPermission().
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <PushPermissionProvider>{children}</PushPermissionProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
