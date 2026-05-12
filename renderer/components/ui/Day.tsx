import { useLayoutEffect, useRef, useState } from 'react'
import Event, { type EventType, type EventColor } from './Event'

export type DayEvent = {
  id: string
  title: string
  type?: EventType
  color?: EventColor
}

type CommonProps = {
  /** 1-31 */
  date: number
  events?: DayEvent[]
  /** Today highlight (dark background). */
  isToday?: boolean
  /** Selected day — blue ring border. Independent from isToday. */
  isSelected?: boolean
  /** Day belongs to previous/next month (faded). */
  outOfBound?: boolean
  onClick?: () => void
}

type SmallProps = CommonProps & {
  size: 'small'
}

type BigProps = CommonProps & {
  size: 'big'
  /** Max events to show before "+N more" overflow chip. */
  maxEvents?: number
  /** When true, the cell uses `w-full h-full` instead of the default 132×144. */
  fillParent?: boolean
}

type Props = SmallProps | BigProps

const SMALL_MAX = 3
const BIG_MAX_DEFAULT = 4

export default function Day(props: Props) {
  const { date, events = [], isToday = false, isSelected = false, outOfBound = false, onClick } = props

  if (props.size === 'small') {
    const visible = events.slice(0, SMALL_MAX)
    const overflow = events.length - visible.length
    const compactHeader = events.length >= 2

    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex flex-col px-[5px] py-[3px] rounded-[5px] w-[76px] h-[76px] text-left transition-colors ${
          isToday ? 'bg-primary-dark' : 'bg-white-item'
        } ${isSelected ? 'ring-2 ring-[#4c979e] ring-inset' : ''} ${outOfBound ? 'opacity-30' : ''} ${compactHeader ? 'gap-[3px] items-start' : 'items-start'}`}
      >
        <span
          className={`tracking-[0.3px] font-medium ${
            compactHeader ? 'text-[14px]' : 'text-[14px]'
          } ${isToday ? 'text-white' : 'text-primary-dark'}`}
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {date}
        </span>
        <div className="flex flex-col gap-[2px] w-full">
          {visible.map((e) => (
            <Event key={e.id} title={e.title} type={e.type} color={e.color} size="small" />
          ))}
          {overflow > 0 && (
            <span
              className={`text-[7px] font-medium tracking-[0.3px] leading-none ${
                isToday ? 'text-white/70' : 'text-gray-secondary'
              }`}
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              +{overflow}
            </span>
          )}
        </div>
      </button>
    )
  }

  // Big
  const fill = props.fillParent ?? false
  const sizeClass = fill ? 'w-full h-full min-h-[80px] min-w-0' : 'w-[132px] h-[144px]'

  // Each event chip = 18px (text 12 + py-3 padding) + 2px gap = 20px row height.
  // The "+N more" line uses ~14px (text-12 + leading).
  const EVENT_ROW = 20
  const OVERFLOW_ROW = 14

  const eventsRef = useRef<HTMLDivElement>(null)
  // When fillParent, slice events based on measured container height.
  // When fixed-size, fall back to the static `maxEvents` prop / BIG_MAX_DEFAULT.
  const [measuredMax, setMeasuredMax] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!fill) return
    const el = eventsRef.current
    if (!el) return
    const update = () => {
      const h = el.clientHeight
      if (h <= 0) return
      // First, try fitting all events without overflow.
      const fitsAll = Math.floor(h / EVENT_ROW)
      if (fitsAll >= events.length) {
        setMeasuredMax(events.length)
        return
      }
      // Otherwise reserve space for the "+N" line and recompute.
      const fitsWithOverflow = Math.max(0, Math.floor((h - OVERFLOW_ROW) / EVENT_ROW))
      setMeasuredMax(fitsWithOverflow)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill, events.length])

  const max = fill
    ? (measuredMax ?? events.length)
    : (props.maxEvents ?? BIG_MAX_DEFAULT)
  const visible = events.slice(0, max)
  const overflow = events.length - visible.length

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-[5px] p-[9px] ${sizeClass} border-b border-r border-solid border-[#EDEEF0] text-left transition-colors overflow-hidden ${
        isToday ? 'bg-primary-dark' : ''
      } ${isSelected ? 'ring-2 ring-[#4c979e] ring-inset' : ''}`}
    >
      <div
        className={`flex flex-col items-start gap-[5px] w-full min-h-0 flex-1 ${
          outOfBound ? 'opacity-35' : ''
        }`}
      >
        <span
          className={`text-[14px] font-semibold shrink-0 ${
            isToday ? 'text-white' : 'text-primary-dark'
          }`}
        >
          {date}
        </span>
        <div
          ref={eventsRef}
          className="flex flex-col gap-[2px] w-full flex-1 min-h-0 overflow-hidden"
        >
          {visible.map((e) => (
            <Event key={e.id} title={e.title} type={e.type} color={e.color} size="big" />
          ))}
          {overflow > 0 && (
            <span
              className={`text-[12px] font-semibold shrink-0 ${
                isToday ? 'text-gray-extra-light' : 'text-primary-main'
              }`}
            >
              +{overflow}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
