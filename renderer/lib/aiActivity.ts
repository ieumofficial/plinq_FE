/**
 * Tiny global signal for "is the AI doing something right now?".
 *
 * Multiple components stream AI events: the global Ask AI panel, the New
 * Task modal's AI assist, the chat composer's AI threads, etc. Anywhere
 * a stream is in flight, that component calls `markAiBusy(true)` for the
 * duration. The header's sparkle icon subscribes via `useAiBusy()` and
 * animates only while at least one source is active.
 *
 * Counted (not boolean) so concurrent activities all release cleanly.
 */
import { useEffect, useState } from 'react'

let count = 0
const listeners = new Set<(busy: boolean) => void>()

function notify() {
  const busy = count > 0
  listeners.forEach((cb) => cb(busy))
}

export function markAiBusy(busy: boolean): void {
  if (busy) count += 1
  else if (count > 0) count -= 1
  notify()
}

/** Subscribe to the global AI-busy flag. True iff one or more AI streams
 *  are currently in flight. */
export function useAiBusy(): boolean {
  const [busy, setBusy] = useState<boolean>(count > 0)
  useEffect(() => {
    const cb = (next: boolean) => setBusy(next)
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }, [])
  return busy
}
