/**
 * In-app navigation history for the Header's back / forward buttons.
 *
 * `router.back()` and `window.history.forward()` follow the *browser*
 * history, which includes pre-app entries (login redirect, OAuth bounce,
 * external links) — those land the user on unexpected pages when used as a
 * generic "Back" affordance. This module tracks only routes the user has
 * actively visited inside the running app session, with a forward stack that
 * gets cleared the moment they push a new route.
 *
 * Subscribe to Next's router events once at the top of the tree
 * (`useTrackNavHistory()` in `_app.tsx`); read state inside the Header via
 * `useNavHistory()`.
 */
import { useEffect, useState } from 'react'
import Router from 'next/router'

type Snapshot = {
  back: string[]
  current: string | null
  forward: string[]
}

let stack: Snapshot = { back: [], current: null, forward: [] }
const listeners = new Set<(s: Snapshot) => void>()

function notify() {
  // Defensive copy so consumers can't mutate the live state.
  const snap: Snapshot = {
    back: stack.back.slice(),
    current: stack.current,
    forward: stack.forward.slice(),
  }
  listeners.forEach((cb) => cb(snap))
}

/** Called on every successful route change. Pushes the previous current onto
 *  the back stack and clears the forward stack — standard browser semantics. */
function recordVisit(path: string) {
  if (stack.current === path) return
  if (stack.current !== null) {
    stack.back.push(stack.current)
    if (stack.back.length > 100) stack.back.shift()
  }
  stack.current = path
  stack.forward = []
  notify()
}

/** Marks the next route change as a back/forward operation. The router event
 *  handler then knows to *skip* the standard push-and-clear-forward logic. */
let pendingDirection: 'back' | 'forward' | null = null

export function goBack(): void {
  if (stack.back.length === 0) return
  const target = stack.back.pop()!
  if (stack.current !== null) {
    stack.forward.unshift(stack.current)
    if (stack.forward.length > 100) stack.forward.pop()
  }
  stack.current = target
  pendingDirection = 'back'
  notify()
  Router.push(target).catch(() => {
    /* swallow — handled by the route subscription */
  })
}

export function goForward(): void {
  if (stack.forward.length === 0) return
  const target = stack.forward.shift()!
  if (stack.current !== null) {
    stack.back.push(stack.current)
    if (stack.back.length > 100) stack.back.shift()
  }
  stack.current = target
  pendingDirection = 'forward'
  notify()
  Router.push(target).catch(() => {})
}

/** Top-level subscription. Mount once in `_app.tsx`. */
export function useTrackNavHistory(): void {
  useEffect(() => {
    // Seed with the initial route so we don't lose the first visit.
    if (stack.current === null) {
      stack.current = Router.asPath
      notify()
    }
    const onRouteChange = (path: string) => {
      if (pendingDirection !== null) {
        // This change came from goBack/goForward; the stack is already in
        // sync. Just clear the flag.
        pendingDirection = null
        return
      }
      recordVisit(path)
    }
    Router.events.on('routeChangeComplete', onRouteChange)
    return () => {
      Router.events.off('routeChangeComplete', onRouteChange)
    }
  }, [])
}

/** Read current stack state. Re-renders the consumer whenever it changes. */
export function useNavHistory(): {
  canBack: boolean
  canForward: boolean
  back: () => void
  forward: () => void
} {
  const [snap, setSnap] = useState<Snapshot>(() => ({
    back: stack.back.slice(),
    current: stack.current,
    forward: stack.forward.slice(),
  }))
  useEffect(() => {
    const cb = (s: Snapshot) => setSnap(s)
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }, [])
  return {
    canBack: snap.back.length > 0,
    canForward: snap.forward.length > 0,
    back: goBack,
    forward: goForward,
  }
}
