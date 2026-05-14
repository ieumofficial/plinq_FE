/**
 * Two-column time picker (hour + minute) shown as a floating popover anchored
 * to a trigger element via `position: fixed`. Value is "HH:MM" 24-hour.
 *
 * Inspired by Figma 1223:12701 (Select dropdown, Time variant). The Figma
 * shows a 3-column wheel; this is a simpler 2-column scrollable list that
 * matches the rest of the app's dropdown idiom and is keyboard-friendlier.
 */
import { useEffect, useMemo, useRef } from 'react'

type Props = {
  /** Trigger element's bounding rect. Null = closed. */
  anchorRect: DOMRect | null
  /** Current value as HH:MM (24-hour), or null. */
  value: string | null
  /** Minute step. Defaults to 5 — every 5 minutes, common for meetings. */
  minuteStep?: number
  onChange: (next: string) => void
  onClose: () => void
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseHM(v: string | null): { h: number; m: number } {
  if (!v) return { h: 9, m: 0 }
  const [hs, ms] = v.split(':')
  const h = Math.min(23, Math.max(0, parseInt(hs ?? '9', 10) || 0))
  const m = Math.min(59, Math.max(0, parseInt(ms ?? '0', 10) || 0))
  return { h, m }
}

export default function TimePicker({
  anchorRect,
  value,
  minuteStep = 5,
  onChange,
  onClose,
}: Props) {
  const { h, m } = useMemo(() => parseHM(value), [value])
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(
    () => Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep),
    [minuteStep]
  )

  const ref = useRef<HTMLDivElement>(null)
  const hoursColRef = useRef<HTMLDivElement>(null)
  const minutesColRef = useRef<HTMLDivElement>(null)

  // Outside click / Esc / scroll / resize — same idiom as DatePicker, but
  // the scroll handler has to ignore scrolls *inside* the picker. Without
  // that guard, the hour/minute columns auto-scrolling to center the active
  // value (below) fires the capture-phase listener and closes us immediately.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScroll(e: Event) {
      if (ref.current && ref.current.contains(e.target as Node)) return
      onClose()
    }
    function onResize() {
      onClose()
    }
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick)
    }, 0)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [onClose])

  // Scroll the active hour/minute into view on open so the user lands near
  // their current selection rather than at 00:00.
  useEffect(() => {
    if (!anchorRect) return
    const scrollToActive = (col: HTMLDivElement | null) => {
      if (!col) return
      const active = col.querySelector<HTMLButtonElement>('[data-active="true"]')
      if (!active) return
      active.scrollIntoView({ block: 'center' })
    }
    // One tick after mount so heights are settled.
    requestAnimationFrame(() => {
      scrollToActive(hoursColRef.current)
      scrollToActive(minutesColRef.current)
    })
  }, [anchorRect])

  if (!anchorRect || typeof window === 'undefined') return null

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    width: 130,
    zIndex: 100,
  }

  return (
    <div
      ref={ref}
      style={style}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[8px] flex gap-[5px]"
    >
      {/* Hours column */}
      <div
        ref={hoursColRef}
        className="flex-1 max-h-[180px] overflow-y-auto flex flex-col gap-[2px]"
      >
        {hours.map((hh) => {
          const active = hh === h
          return (
            <button
              key={hh}
              type="button"
              data-active={active}
              onClick={() => onChange(`${pad2(hh)}:${pad2(m)}`)}
              className={`shrink-0 h-[24px] inline-flex items-center justify-center rounded-[5px] text-[12px] transition-colors ${
                active
                  ? 'bg-primary-light text-primary-main font-semibold'
                  : 'text-primary-main hover:bg-white-item'
              }`}
            >
              {pad2(hh)}
            </button>
          )
        })}
      </div>
      <span className="w-px self-stretch bg-gray-border-light" />
      {/* Minutes column */}
      <div
        ref={minutesColRef}
        className="flex-1 max-h-[180px] overflow-y-auto flex flex-col gap-[2px]"
      >
        {minutes.map((mm) => {
          const active = mm === m
          return (
            <button
              key={mm}
              type="button"
              data-active={active}
              onClick={() => onChange(`${pad2(h)}:${pad2(mm)}`)}
              className={`shrink-0 h-[24px] inline-flex items-center justify-center rounded-[5px] text-[12px] transition-colors ${
                active
                  ? 'bg-primary-light text-primary-main font-semibold'
                  : 'text-primary-main hover:bg-white-item'
              }`}
            >
              {pad2(mm)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
