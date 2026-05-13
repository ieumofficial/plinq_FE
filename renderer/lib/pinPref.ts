/**
 * Per-project pinned doc state. Stored in localStorage for now so it survives
 * navigation/reload without needing a backend column. When we want pins to be
 * shared across devices/users, move to a `knowledge_documents.pinned_at`
 * column + RPC and swap this hook out.
 *
 * Also exports a parallel `usePinnedProjects` keyed by orgId for the Org
 * Dashboard's pinned-project chip.
 */
import { useCallback, useEffect, useState } from 'react'

const KEY_PREFIX = 'plinq.pin.docs.'
const PROJECT_KEY_PREFIX = 'plinq.pin.projects.'

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

// ─── Projects ───────────────────────────────────────────────────────────────

function readProjects(orgId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(PROJECT_KEY_PREFIX + orgId)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeProjects(orgId: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(
      PROJECT_KEY_PREFIX + orgId,
      JSON.stringify(Array.from(ids))
    )
  } catch {
    // ignore
  }
}

const projectListeners = new Map<string, Set<(s: Set<string>) => void>>()

export function usePinnedProjects(orgId: string): {
  pinned: Set<string>
  isPinned: (projectId: string) => boolean
  toggle: (projectId: string) => void
} {
  const [pinned, setPinned] = useState<Set<string>>(() => readProjects(orgId))

  useEffect(() => {
    setPinned(readProjects(orgId))
    let set = projectListeners.get(orgId)
    if (!set) {
      set = new Set()
      projectListeners.set(orgId, set)
    }
    const cb = (s: Set<string>) => setPinned(s)
    set.add(cb)
    return () => {
      set!.delete(cb)
    }
  }, [orgId])

  const toggle = useCallback(
    (projectId: string) => {
      const next = new Set(readProjects(orgId))
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      writeProjects(orgId, next)
      const set = projectListeners.get(orgId)
      if (set) set.forEach((cb) => cb(next))
    },
    [orgId]
  )

  const isPinned = useCallback((projectId: string) => pinned.has(projectId), [pinned])

  return { pinned, isPinned, toggle }
}
