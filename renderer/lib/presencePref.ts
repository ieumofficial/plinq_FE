import { useEffect, useState } from 'react'

export type Presence = 'available' | 'in_meeting' | 'unavailable'

const STORAGE_KEY = 'plinq.presence'

function read(): Presence {
  if (typeof window === 'undefined') return 'available'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === 'available' || raw === 'in_meeting' || raw === 'unavailable') return raw
  return 'available'
}

/** Client-side user presence — no backend yet, lives in localStorage so it
 *  persists across reloads and stays in sync across tabs. */
export function usePresence(): [Presence, (next: Presence) => void] {
  const [value, setValue] = useState<Presence>('available')

  useEffect(() => {
    setValue(read())
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setValue(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const set = (next: Presence) => {
    setValue(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  return [value, set]
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
