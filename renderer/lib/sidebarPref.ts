/**
 * Persistent user preference for the sidebar's collapsed state.
 *
 * The choice is stored in localStorage so it survives navigation and page
 * reloads. Additionally, `useSpaceTransition` auto-expands the main sidebar
 * when the user transitions out of a stacked space (Project / Organization,
 * which render a secondary panel) back into Personal space.
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

const listeners = new Set<(v: boolean) => void>()

function writeAndNotify(next: boolean) {
  try {
    window.localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    // ignore storage failures (private mode, quota)
  }
  listeners.forEach((cb) => cb(next))
}

export function useSidebarPref(): {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
} {
  const [collapsed, setCollapsedState] = useState<boolean>(readInitial)

  useEffect(() => {
    const onChange = (v: boolean) => setCollapsedState(v)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  return {
    collapsed,
    toggle: () => writeAndNotify(!collapsed),
    setCollapsed: (v: boolean) => writeAndNotify(v),
  }
}

// ─── Space transition tracking ───────────────────────────────────────────────

/**
 * Identifier for the current "space" the user is in. Use:
 *   - `'personal'` for Personal Space pages (no secondary panel)
 *   - `'project:<projectId>'` for Project Space pages
 *   - `'org:<orgId>'` for Organization Space pages
 *
 * Different project ids are distinct spaces, so navigating between them
 * triggers the secondary-panel slide-in motion. Navigating within the same
 * project (e.g. dashboard → kanban) keeps the same id and skips the motion.
 */
export type SpaceId = 'personal' | `project:${string}` | `org:${string}`

let lastSpaceId: SpaceId | null = null

/**
 * Last-known space id. Read during render by the secondary sidebar to decide
 * whether to play its slide-in animation: if the current id matches the last
 * one, the user is just navigating within the same space — skip animation.
 * Otherwise (null, different project, different org, or coming from personal)
 * play it.
 */
export function getLastSpaceId(): SpaceId | null {
  return lastSpaceId
}

/**
 * Track which space the AppShell represents. Auto-expands the main sidebar
 * when entering Personal space — either from a stacked space or from the
 * very first page load. The user's explicit toggle within Personal space is
 * preserved across Personal → Personal navigations.
 */
export function useSpaceTransition(id: SpaceId): void {
  useEffect(() => {
    if (id === 'personal' && lastSpaceId !== 'personal') {
      writeAndNotify(false)
    }
    lastSpaceId = id
  }, [id])
}
