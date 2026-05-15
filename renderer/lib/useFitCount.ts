/**
 * Returns how many items fit inside the ref'd container without clipping.
 *
 *   const [ref, count, freePx] = useFitCount({ itemHeight: 78, gap: 8 })
 *   <div ref={ref} className="flex flex-col gap-[8px] overflow-hidden min-h-0 flex-1">
 *     {items.slice(0, count).map(...)}
 *   </div>
 *
 * `itemHeight` is a hint used until the first child renders; once at least one
 * child is mounted the hook switches to the child's real measured height, so
 * the count always matches what the browser actually paints — no estimation
 * error from font / padding / wrap differences.
 *
 * `freePx` is the unused height left after the visible items: container.height
 * minus items + gaps. Callers can use it to decide whether a small trailing
 * element (e.g. a "+N more" line) can be tacked on without dropping one of
 * the items. Re-measures on container resize, first-child resize, and child
 * list mutation.
 *
 * The returned `ref` is a *callback ref*, not a RefObject. This matters when
 * the container is rendered conditionally (e.g. behind a loading guard): a
 * once-on-mount layout effect would run while the element is still null and
 * never re-attach when it later mounts, leaving the count stuck at the
 * initial value until an unrelated re-render. A callback ref runs every time
 * the node attaches/detaches, so measurement happens whenever the list
 * actually appears.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function useFitCount<T extends HTMLElement = HTMLDivElement>(opts: {
  itemHeight: number
  gap?: number
  /** Floor — even when we can't actually fit this many we still render them.
   *  Use `min: 1` to keep at least one row visible so the section doesn't
   *  collapse into just a header on small viewports. */
  min?: number
  /** Cap regardless of how much room we have. */
  max?: number
}) {
  const { itemHeight, gap = 0, min = 0, max } = opts
  // Start at `min` (>=1) so the first paint shows a row; the callback ref
  // measures synchronously on attach and grows it before the browser paints.
  const [state, setState] = useState<{ count: number; free: number }>({
    count: Math.max(min, 1),
    free: 0,
  })

  // Latest opts, so the stable callback ref always measures with current
  // values without needing to be re-created (which would thrash attach).
  const optsRef = useRef({ itemHeight, gap, min, max })
  optsRef.current = { itemHeight, gap, min, max }

  const elRef = useRef<T | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const measure = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const { itemHeight, gap, min, max } = optsRef.current
    const h = el.clientHeight
    if (h <= 0) return
    const firstChild = el.firstElementChild as HTMLElement | null
    const realItemH = firstChild?.getBoundingClientRect().height ?? itemHeight
    const actual = realItemH > 0 ? realItemH : itemHeight
    const fit = Math.floor((h + gap) / (actual + gap))
    const capped = max !== undefined ? Math.min(fit, max) : fit
    const count = Math.max(min, capped)
    const used = count > 0 ? count * actual + (count - 1) * gap : 0
    const free = Math.max(0, h - used)
    setState((prev) =>
      prev.count === count && prev.free === free ? prev : { count, free }
    )
  }, [])

  const setRef = useCallback(
    (el: T | null) => {
      // Tear down observers from a previous node (detach or swap).
      cleanupRef.current?.()
      cleanupRef.current = null
      elRef.current = el
      if (!el) return

      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      const firstChild = el.firstElementChild
      if (firstChild) ro.observe(firstChild)
      const mo = new MutationObserver(() => {
        ro.disconnect()
        ro.observe(el)
        const newFirst = el.firstElementChild
        if (newFirst) ro.observe(newFirst)
        measure()
      })
      mo.observe(el, { childList: true })
      cleanupRef.current = () => {
        ro.disconnect()
        mo.disconnect()
      }
    },
    [measure]
  )

  // Re-measure if the sizing opts change while a node is attached.
  useLayoutEffect(() => {
    measure()
  }, [itemHeight, gap, min, max, measure])

  return [setRef, state.count, state.free] as const
}
