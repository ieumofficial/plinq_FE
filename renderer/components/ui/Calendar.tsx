import { useMemo } from 'react'
import Day, { type DayEvent } from './Day'
import Icon from './Icon'

export type CalendarEvent = DayEvent & {
  /** YYYY-MM-DD */
  date: string
}

type Props = {
  view: 'dashboard' | 'monthly'
  /** Any date within the displayed month. */
  month: Date
  events: CalendarEvent[]
  /** Optional today override (defaults to new Date()). */
  today?: Date
  onDayClick?: (date: Date) => void
  onPrevMonth?: () => void
  onNextMonth?: () => void
  /** Monthly view only — clicking jumps month back to today. */
  onToday?: () => void
  /** Monthly view only — shows a "+ New" button on the right when provided. */
  onCreateNew?: () => void
  /** Dashboard view only — clicking the "OPEN ›" button (e.g. navigate to /calendar). */
  onOpen?: () => void
}

const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Number of weeks (5 or 6) the given month occupies starting from Sunday.
 * E.g. May 2026 starts Friday with 31 days → 6 rows; June 2026 starts Monday
 * with 30 days → 5 rows.
 */
function weeksInMonth(month: Date): number {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Math.ceil((first.getDay() + daysInMonth) / 7)
}

/** Returns a `weeks * 7` cell grid starting from the Sunday before the 1st. */
function getMonthGrid(month: Date, weeks: number): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const startOffset = first.getDay() // 0=Sun
  const start = new Date(first)
  start.setDate(first.getDate() - startOffset)
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export default function Calendar({
  view,
  month,
  events,
  today: todayProp,
  onDayClick,
  onPrevMonth,
  onNextMonth,
  onToday,
  onCreateNew,
  onOpen,
}: Props) {
  const today = todayProp ?? new Date()

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>()
    for (const e of events) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [events])

  const isMonthly = view === 'monthly'
  // Dashboard variant always renders a 6-week grid so the layout stays a fixed
  // size; out-of-bound cells render as transparent placeholders. Monthly view
  // sizes the row count to the actual number of weeks (5 or 6) so each row
  // can stretch to fill the available height.
  const weeks = useMemo(
    () => (isMonthly ? weeksInMonth(month) : 6),
    [month, isMonthly]
  )
  const grid = useMemo(() => getMonthGrid(month, weeks), [month, weeks])
  const monthIndex = month.getMonth()

  const cellSize = isMonthly ? 'big' : 'small'
  const weekdays = isMonthly ? WEEKDAYS_FULL : WEEKDAYS_SHORT

  return (
    <div className={`flex flex-col gap-[12px] ${isMonthly ? 'h-full' : ''}`}>
      {/* Toolbar — only for monthly view */}
      {isMonthly && (
        <div className="flex items-center justify-between">
          <h2 className="text-black text-[32px] font-semibold leading-tight">
            {MONTH_NAMES[monthIndex]}{' '}
            <em
              className="italic text-gray-secondary font-normal"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {month.getFullYear()}
            </em>
          </h2>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={onPrevMonth}
              className="text-primary-main p-[7px] rounded-[5px] border border-solid border-gray-border-light bg-white-white hover:bg-white-main"
              aria-label="Previous month"
            >
              <Icon name="ArrowLeft" size={15} />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="px-[15px] py-[7px] rounded-[5px] border border-solid border-gray-border-light bg-white-white hover:bg-white-main text-black text-[12px]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              className="text-primary-main p-[7px] rounded-[5px] border border-solid border-gray-border-light bg-white-white hover:bg-white-main"
              aria-label="Next month"
            >
              <Icon name="ArrowRight" size={15} />
            </button>
            {onCreateNew && (
              <button
                type="button"
                onClick={onCreateNew}
                className="bg-primary-main text-white-main px-[15px] py-[7px] rounded-[5px] inline-flex items-center gap-[5px] text-[12px] hover:bg-primary-dark"
              >
                <Icon name="Add" size={15} />
                New
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dashboard header: eyebrow + title + legend + Open */}
      {!isMonthly && (
        <div className="flex items-start justify-between w-full">
          <div className="flex flex-col gap-[5px]">
            <p className="text-purple-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Calendar · {MONTH_NAMES[monthIndex]} {month.getFullYear()}
            </p>
            <p className="text-primary-dark text-[20px] font-semibold leading-none">
              This month
            </p>
          </div>
          <div className="flex items-center gap-[10px]">
            <span className="flex items-center gap-[5px]">
              <span className="w-[6px] h-[6px] rounded-full bg-purple-main" />
              <span className="text-gray-main text-[10px] leading-[1.5]">Meeting</span>
            </span>
            <span className="flex items-center gap-[5px]">
              <span className="w-[6px] h-[6px] rounded-full bg-red-main" />
              <span className="text-gray-main text-[10px] leading-[1.5]">Action</span>
            </span>
            <button
              type="button"
              onClick={onOpen}
              className="flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] hover:bg-white-item"
            >
              <span className="text-black text-[10px] uppercase leading-none">open</span>
              <Icon name="ArrowRight" size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Weekday header */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: isMonthly
            ? 'repeat(7, minmax(0, 1fr))'
            : 'repeat(7, 76px)',
          gap: isMonthly ? 0 : 4,
        }}
      >
        {weekdays.map((w, i) => (
          <div
            key={i}
            className="text-gray-secondary text-[10px] font-medium uppercase tracking-[1.5px] text-center py-1"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className={`grid ${
          isMonthly ? 'flex-1 min-h-0 border-t border-l border-solid border-[#EDEEF0]' : ''
        }`}
        style={{
          gridTemplateColumns: isMonthly
            ? 'repeat(7, minmax(0, 1fr))'
            : 'repeat(7, 76px)',
          gridTemplateRows: isMonthly
            ? `repeat(${weeks}, minmax(0, 1fr))`
            : undefined,
          gap: isMonthly ? 0 : 4,
        }}
      >
        {grid.map((d) => {
          const dEvents = eventsByDate.get(ymd(d)) ?? []
          const outOfBound = d.getMonth() !== monthIndex
          const isToday = isSameDate(d, today)

          // Dashboard: render an invisible placeholder for out-of-bound cells
          // (matches Figma "Status=Transparent" with opacity-0).
          if (cellSize === 'small' && outOfBound) {
            return (
              <div
                key={d.toISOString()}
                style={{ width: 76, height: 76 }}
                aria-hidden
              />
            )
          }

          if (cellSize === 'big') {
            return (
              <Day
                key={d.toISOString()}
                size="big"
                date={d.getDate()}
                events={dEvents}
                isToday={isToday}
                outOfBound={outOfBound}
                fillParent
                onClick={() => onDayClick?.(d)}
              />
            )
          }

          return (
            <Day
              key={d.toISOString()}
              size="small"
              date={d.getDate()}
              events={dEvents}
              isToday={isToday}
              outOfBound={outOfBound}
              onClick={() => onDayClick?.(d)}
            />
          )
        })}
      </div>
    </div>
  )
}
