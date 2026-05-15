import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Presence = 'available' | 'in_meeting' | 'unavailable'

/**
 * Server-backed user presence stored on `users.status`.
 *
 * Picking 'Available' clears the manual lock so Phase 2's LiveKit auto-flip
 * (in_meeting on join, available on leave) can take over again. Picking
 * 'In meeting' or 'Unavailable' sets the manual lock so the auto-flip won't
 * override the user's choice.
 */
export function usePresence(): [Presence, (next: Presence) => void] {
  const qc = useQueryClient()

  const { data: presence = 'available' } = useQuery<Presence>({
    queryKey: ['myStatus'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const me = userData.user
      if (!me) return 'available'
      const { data } = await supabase
        .from('users')
        .select('status')
        .eq('id', me.id)
        .maybeSingle()
      const v = (data as { status?: Presence } | null)?.status
      return v === 'in_meeting' || v === 'unavailable' || v === 'available' ? v : 'available'
    },
    // BE auto-flips on LiveKit join/leave webhooks; poll often enough that
    // the sidebar dot follows within a few seconds of joining a room.
    staleTime: 3_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })

  const mut = useMutation({
    mutationFn: async (next: Presence) => {
      const { data: userData } = await supabase.auth.getUser()
      const me = userData.user
      if (!me) return
      const { error } = await supabase
        .from('users')
        .update({
          status: next,
          // 'available' = release the manual lock and let LiveKit auto-flip
          // resume. 'in_meeting' / 'unavailable' = explicit user choice.
          status_is_manual: next !== 'available',
        })
        .eq('id', me.id)
      if (error) throw new Error(error.message)
    },
    onMutate: async (next) => {
      // Optimistic — the dot in the sidebar should switch instantly even
      // before the round-trip lands.
      qc.setQueryData<Presence>(['myStatus'], next)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['myStatus'] })
    },
  })

  return [presence, (next) => mut.mutate(next)]
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  available: 'Available',
  in_meeting: 'In meeting',
  unavailable: 'Unavailable',
}

export const PRESENCE_DOT: Record<Presence, string> = {
  available: '#2F6B45',
  in_meeting: '#B68A48',
  unavailable: '#9B3838',
}
