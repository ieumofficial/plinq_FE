/**
 * Per-project pinned doc state. Stored in localStorage for now so it survives
 * navigation/reload without needing a backend column. When we want pins to be
 * shared across devices/users, move to a `knowledge_documents.pinned_at`
 * column + RPC and swap this hook out.
 */
import { useCallback, useEffect, useState } from 'react'

const KEY_PREFIX = 'plinq.pin.docs.'

function read(projectId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + projectId)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function write(projectId: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(
      KEY_PREFIX + projectId,
      JSON.stringify(Array.from(ids))
    )
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

// Listeners per project key so multiple hook instances stay in sync.
const listeners = new Map<string, Set<(s: Set<string>) => void>>()

export function usePinnedDocs(projectId: string): {
  pinned: Set<string>
  isPinned: (docId: string) => boolean
  toggle: (docId: string) => void
} {
  const [pinned, setPinned] = useState<Set<string>>(() => read(projectId))

  useEffect(() => {
    setPinned(read(projectId))
    let set = listeners.get(projectId)
    if (!set) {
      set = new Set()
      listeners.set(projectId, set)
    }
    const cb = (s: Set<string>) => setPinned(s)
    set.add(cb)
    return () => {
      set!.delete(cb)
    }
  }, [projectId])

  const toggle = useCallback(
    (docId: string) => {
      const next = new Set(read(projectId))
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      write(projectId, next)
      const set = listeners.get(projectId)
      if (set) set.forEach((cb) => cb(next))
    },
    [projectId]
  )

  const isPinned = useCallback((docId: string) => pinned.has(docId), [pinned])

  return { pinned, isPinned, toggle }
}
