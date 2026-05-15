import { useSyncExternalStore } from 'react'

// "Currently active organization" — the one the user last interacted with via
// either the header org switcher or by navigating into /o/[orgId]/*.
//
// Used by Personal Space pages (which don't have an :orgId in their URL) to
// scope cross-org queries down to the org the user is mentally in. Without
// this, multi-org users see project/task data from every org mashed together
// on /my/overview.
//
// Persisted to localStorage so the choice survives reloads. Module-level
// store via useSyncExternalStore so updates broadcast across the 3 AppShells
// + the personal dashboard without React Context plumbing.

const STORAGE_KEY = 'activeOrgId'

function readInitial(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let value: string | null = readInitial()
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return value
}

function getServerSnapshot(): string | null {
  return null
}

export function setActiveOrgId(next: string | null) {
  if (next === value) return
  value = next
  if (typeof window !== 'undefined') {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore (private mode, etc.)
    }
  }
  listeners.forEach((cb) => cb())
}

export function useActiveOrgId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
