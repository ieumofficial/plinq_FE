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
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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

/** Returns a 6-week grid (42 cells) centered on the given month. */
function getMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const startOffset = first.getDay() // 0=Sun
  const start = new Date(first)
  start.setDate(first.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
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

  const grid = useMemo(() => getMonthGrid(month), [month])
  const monthIndex = month.getMonth()

  const cellSize = view === 'dashboard' ? 'small' : 'big'
  const dayWidth = view === 'dashboard' ? 76 : 132
  const gridGap = view === 'dashboard' ? 4 : 0
  const weekdayWidth = dayWidth

  return (
    <div className="flex flex-col gap-[12px]">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-black text-[16px] font-semibold">
          {MONTH_NAMES[monthIndex]} {month.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            className="text-primary-main p-1 rounded hover:bg-gray-extra-light"
            aria-label="Previous month"
          >
            <Icon name="ArrowLeft" size={15} />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="text-primary-main p-1 rounded hover:bg-gray-extra-light"
            aria-label="Next month"
          >
            <Icon name="ArrowRight" size={15} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(7, ${dayWidth}px)`,
          gap: gridGap,
        }}
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-gray-secondary text-[10px] font-medium uppercase tracking-[1.5px] text-center py-1"
            style={{ width: weekdayWidth }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className={`grid ${view === 'monthly' ? 'border-t border-l border-solid border-[#F4F6F8]' : ''}`}
        style={{
          gridTemplateColumns: `repeat(7, ${dayWidth}px)`,
          gap: gridGap,
        }}
      >
        {grid.map((d) => {
          const dEvents = eventsByDate.get(ymd(d)) ?? []
          const outOfBound = d.getMonth() !== monthIndex
          const isToday = isSameDate(d, today)
          if (cellSize === 'small') {
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
          }
          return (
            <Day
              key={d.toISOString()}
              size="big"
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
