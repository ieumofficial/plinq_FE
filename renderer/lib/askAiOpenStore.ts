import { useSyncExternalStore } from 'react'

// Module-level state lives above the 3 AppShells so it survives page
// navigation (each shell remounts per page; lifting state to a singleton
// keeps the AskAi panel open until the user explicitly collapses it).
// Persisted to localStorage so a reload doesn't surprise the user either.

const STORAGE_KEY = 'askAiOpen'

function readInitial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let value = readInitial()
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return value
}

function getServerSnapshot() {
  return false
}

function set(next: boolean) {
  if (next === value) return
  value = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }
  listeners.forEach((cb) => cb())
}

export function useAskAiOpen(): [boolean, (next: boolean) => void, () => void] {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [open, set, () => set(!value)]
}
