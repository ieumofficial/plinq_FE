import { useState } from 'react'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  // Create one client per app instance.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache hits show instantly; refetch in background after 30s.
            staleTime: 30 * 1000,
            // Keep cached data for 5 minutes after the last component using it unmounts.
            gcTime: 5 * 60 * 1000,
            // Don't refetch on window focus (Electron app — usually not desired).
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
    </QueryClientProvider>
  )
}

export default MyApp
