import { useEffect, useState } from 'react'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '../styles/globals.css'
import { useTrackNavHistory } from '../lib/navHistory'
import ProjectPreviewProvider from '../components/ProjectPreviewProvider'
import { supabase } from '../lib/supabase'

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

  // Track in-app navigation history for the header's < > buttons.
  useTrackNavHistory()

  // Force a session refresh once per app boot. The cached JWT in localStorage
  // may have been signed by an old Supabase signing key (e.g., the project
  // rotated HS256 → ES256 since we last logged in). PostgREST then silently
  // treats every request as anonymous and RLS denies writes with 42501 even
  // though the token's `exp` is still in the future. A refresh hands us a
  // JWT signed by the *current* key. If there's no session, this is a no-op.
  useEffect(() => {
    // Only attempt refresh if there's actually a session in storage.
    // supabase-js's refreshSession() throws "Auth session missing!" when
    // called from a logged-out state — including the landing page on a
    // fresh install — and that surfaces in dev as a runtime overlay.
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) return
        await supabase.auth.refreshSession()
      } catch (e) {
        console.warn('[auth] boot-time refreshSession failed', e)
      }
    })()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ProjectPreviewProvider>
        <Component {...pageProps} />
      </ProjectPreviewProvider>
    </QueryClientProvider>
  )
}

export default MyApp
