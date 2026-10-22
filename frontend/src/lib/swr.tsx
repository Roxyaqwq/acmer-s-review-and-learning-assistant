'use client'

import { SWRConfig } from 'swr'
import type { SWRConfiguration } from 'swr'

// Shared SWR defaults: dedupe concurrent requests, avoid refetch spam on
// focus/reconnect, and keep the previous data while revalidating so lists do
// not flash empty during navigation.
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 2,
  keepPreviousData: true,
}

export function SwrProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>
}