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
 */
import { useLayoutEffect, useRef, useState } from 'react'

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
  const ref = useRef<T>(null)
  // Start at `min` so the first render only commits one row — once it's
  // mounted we can measure its real height and grow the count from there.
  const [state, setState] = useState<{ count: number; free: number }>({
    count: Math.max(min, 1),
    free: 0,
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const h = el.clientHeight
      if (h <= 0) return
      const firstChild = el.firstElementChild as HTMLElement | null
      const realItemH =
        firstChild?.getBoundingClientRect().height ?? itemHeight
      const actual = realItemH > 0 ? realItemH : itemHeight
      const fit = Math.floor((h + gap) / (actual + gap))
      const capped = max !== undefined ? Math.min(fit, max) : fit
      const count = Math.max(min, capped)
      // Used height after laying out `count` items with gaps between them.
      const used = count > 0 ? count * actual + (count - 1) * gap : 0
      const free = Math.max(0, h - used)
      setState((prev) =>
        prev.count === count && prev.free === free ? prev : { count, free }
      )
    }

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
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [itemHeight, gap, min, max])

  return [ref, state.count, state.free] as const
}
