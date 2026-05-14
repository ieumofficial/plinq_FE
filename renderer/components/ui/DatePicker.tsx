/**
 * Calendar-style date picker popover. Matches Figma 1223:12229 (Date variant
 *  of "Select dropdown"). Renders the month grid with weekday header, prev/next
 *  month arrows, Clear and Today footer actions.
 *
 *  Clicking the "Mmm YYYY" header swaps the body into a year + month picker
 *  (Figma 1223:12332 — Date variant, year expanded).
 *
 *  Usage: render conditionally near the input that opens it; pass `anchorRect`
 *  so the popover floats above modal overflow via `position: fixed`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  /** Trigger element's bounding rect. Null = closed. */
  anchorRect: DOMRect | null
  /** Current selection as YYYY-MM-DD or null. */
  value: string | null
  onChange: (next: string | null) => void
  onClose: () => void
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

// Inline SVG arrows — Figma uses thin up/down arrows in the header rather
// than rotated chevrons. The caret on the month-year label uses a small
// down-only chevron.
function ArrowUp({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 11V2.5M3.5 5.5L6.5 2.5L9.5 5.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function ArrowDown({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 2V10.5M3.5 7.5L6.5 10.5L9.5 7.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function CaretDown({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none" aria-hidden>
      <path
        d="M2 4L5.5 7.5L9 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export default function DatePicker({
  anchorRect,
  value,
  onChange,
  onClose,
}: Props) {
  const today = useMemo(() => new Date(), [])
  const selected = useMemo(() => parseYmd(value), [value])
  // The month we're currently displaying — defaults to the selected month or
  // the current month if nothing is selected yet.
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(selected ?? today)
  )
  // Body mode: 'date' shows the month grid; 'yearMonth' shows a year list +
  // month grid for jumping further than ± 1 month at a time.
  const [mode, setMode] = useState<'date' | 'yearMonth'>('date')
  // Window of 3 visible years in yearMonth mode. Starts one year before the
  // current view so today's year is centered.
  const [yearWinStart, setYearWinStart] = useState<number>(
    () => (selected ?? today).getFullYear() - 1
  )

  // Reset view month whenever a new value is set externally (e.g. clear /
  // outside change).
  useEffect(() => {
    setViewMonth(startOfMonth(selected ?? today))
    setYearWinStart((selected ?? today).getFullYear() - 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScrollOrResize() {
      // Anchor rect is now stale — close instead of trying to reposition.
      onClose()
    }
    // Defer one tick so the click that opened us doesn't immediately close.
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick)
    }, 0)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [onClose])

  // Build the visible 6-row × 7-col grid. We always render exactly 42 cells
  // so the popover height doesn't jump month to month.
  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth)
    const firstDow = first.getDay() // 0 = Sun
    const startDate = new Date(first)
    startDate.setDate(first.getDate() - firstDow)
    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      days.push(d)
    }
    return days
  }, [viewMonth])

  if (!anchorRect || typeof window === 'undefined') return null

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    width: 230,
    zIndex: 100,
  }

  const headerLabel = `${MONTHS_SHORT[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`
  const visibleYears = [yearWinStart, yearWinStart + 1, yearWinStart + 2]

  return (
    <div
      ref={ref}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className="bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[15px] flex flex-col gap-[15px]"
    >
      {/* Header — month/year label (clickable to expand year mode) + arrows.
          In yearMonth mode the arrows scroll the year window by 3 instead of
          moving the calendar by one month. */}
      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          onClick={() => {
            if (mode === 'date') {
              setYearWinStart(viewMonth.getFullYear() - 1)
              setMode('yearMonth')
            } else {
              setMode('date')
            }
          }}
          className="flex items-center gap-[3px] text-black text-[12px] leading-none hover:text-primary-main"
        >
          <span>{headerLabel}</span>
          <CaretDown size={11} />
        </button>
        <div className="flex items-center gap-[5px] text-gray-main">
          <button
            type="button"
            onClick={() => {
              if (mode === 'date') {
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
                )
              } else {
                setYearWinStart((s) => s - 3)
              }
            }}
            className="hover:text-black w-[15px] h-[15px] inline-flex items-center justify-center"
            aria-label={mode === 'date' ? 'Previous month' : 'Earlier years'}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (mode === 'date') {
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
                )
              } else {
                setYearWinStart((s) => s + 3)
              }
            }}
            className="hover:text-black w-[15px] h-[15px] inline-flex items-center justify-center"
            aria-label={mode === 'date' ? 'Next month' : 'Later years'}
          >
            <ArrowDown size={13} />
          </button>
        </div>
      </div>

      {mode === 'date' ? (
        <>
          {/* Weekday header */}
          <div className="flex flex-col gap-[5px]">
            <div className="grid grid-cols-7 gap-[2px] text-gray-main text-[10px] leading-[1.5] text-center">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-[2px]">
              {grid.map((d) => {
                const isThisMonth = d.getMonth() === viewMonth.getMonth()
                const isToday = sameDay(d, today)
                const isSel = selected ? sameDay(d, selected) : false
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => {
                      onChange(ymd(d))
                      onClose()
                    }}
                    className={`h-[23px] inline-flex items-center justify-center rounded-[5px] text-[10px] leading-[1.5] transition-colors ${
                      isSel
                        ? 'bg-primary-light text-primary-main font-semibold'
                        : isToday
                          ? 'text-primary-main font-semibold hover:bg-white-item'
                          : isThisMonth
                            ? 'text-primary-main hover:bg-white-item'
                            : 'text-gray-secondary hover:bg-white-item'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer — Clear / Today */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange(null)
                onClose()
              }}
              className="bg-primary-main text-white-main rounded-[5px] px-[10px] py-[5px] text-[12px] hover:bg-primary-dark transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(ymd(today))
                onClose()
              }}
              className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[5px] text-gray-main text-[12px] hover:bg-white-item transition-colors"
            >
              Today
            </button>
          </div>
        </>
      ) : (
        // ─── Year + month picker (Figma 1223:12332) ────────────────────────
        <div className="flex flex-col gap-[10px]">
          {/* Year rows — each with a separator beneath. Click selects the
              year for the month grid below. */}
          <div className="flex flex-col gap-[5px] w-full">
            {visibleYears.map((y) => {
              const active = y === viewMonth.getFullYear()
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() =>
                    setViewMonth(new Date(y, viewMonth.getMonth(), 1))
                  }
                  className="flex flex-col gap-[5px] w-full"
                >
                  <span
                    className={`text-[10px] leading-[1.5] text-left w-full ${
                      active ? 'text-black font-semibold' : 'text-black'
                    }`}
                  >
                    {y}
                  </span>
                  <span className="h-px w-full bg-gray-border-light" />
                </button>
              )
            })}
          </div>
          {/* Month grid — 4 cols × 3 rows. Clicking sets viewMonth to that
              year+month and returns to the day grid. */}
          <div className="grid grid-cols-4 gap-y-[10px]">
            {MONTHS_SHORT.map((label, m) => {
              const active =
                m === viewMonth.getMonth() &&
                visibleYears.includes(viewMonth.getFullYear())
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setViewMonth(new Date(viewMonth.getFullYear(), m, 1))
                    setMode('date')
                  }}
                  className={`h-[23px] w-full flex items-center justify-center rounded-[5px] text-[12px] transition-colors ${
                    active
                      ? 'bg-primary-light text-primary-main font-semibold'
                      : 'text-primary-main hover:bg-white-item'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
