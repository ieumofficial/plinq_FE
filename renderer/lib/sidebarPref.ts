/**
 * Persistent user preferences for the two sidebars' collapsed states.
 *
 * Choices are stored in localStorage so they survive navigation and reloads.
 * `useSpaceTransition` additionally auto-expands the main sidebar when the
 * user transitions out of a stacked space (Project / Organization, which
 * render a secondary panel) back into Personal space.
 */
import { useEffect, useState } from 'react'

const KEY = 'plinq.sidebar.collapsed'
const STACKED_KEY = 'plinq.stackedSidebar.collapsed'

function readInitial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function readStackedInitial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STACKED_KEY) === '1'
  } catch {
    return false
  }
}

const listeners = new Set<(v: boolean) => void>()
const stackedListeners = new Set<(v: boolean) => void>()

function writeAndNotify(next: boolean) {
  try {
    window.localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    // ignore storage failures (private mode, quota)
  }
  listeners.forEach((cb) => cb(next))
}

function writeStackedAndNotify(next: boolean) {
  try {
    window.localStorage.setItem(STACKED_KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
  stackedListeners.forEach((cb) => cb(next))
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

/** Persistent toggle for the secondary (stacked) sidebar shown in Project +
 *  Organization spaces. Independent from the main sidebar so users can
 *  collapse one without the other. */
export function useStackedSidebarPref(): {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
} {
  const [collapsed, setCollapsedState] = useState<boolean>(readStackedInitial)

  useEffect(() => {
    const onChange = (v: boolean) => setCollapsedState(v)
    stackedListeners.add(onChange)
    return () => {
      stackedListeners.delete(onChange)
    }
  }, [])

  return {
    collapsed,
    toggle: () => writeStackedAndNotify(!collapsed),
    setCollapsed: (v: boolean) => writeStackedAndNotify(v),
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
