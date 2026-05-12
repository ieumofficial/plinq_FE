/**
 * Persistent user preference for the sidebar's collapsed state.
 *
 * The choice is stored in localStorage so it survives navigation and page
 * reloads. All app shells (Personal / Project / Organization / Messages)
 * consume the same hook so the rail never auto-collapses based on context —
 * it only changes when the user clicks "Toggle sidebar".
 */
import { useEffect, useState } from 'react'

const KEY = 'plinq.sidebar.collapsed'

function readInitial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let listeners = new Set<(v: boolean) => void>()

export function useSidebarPref(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState<boolean>(readInitial)

  useEffect(() => {
    const onChange = (v: boolean) => setCollapsed(v)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  const toggle = () => {
    const next = !collapsed
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // ignore storage failures (private mode, quota)
    }
    listeners.forEach((cb) => cb(next))
  }

  return { collapsed, toggle }
}
