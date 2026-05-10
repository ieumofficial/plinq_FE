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
}

type Props = SmallProps | BigProps

const SMALL_MAX = 3
const BIG_MAX_DEFAULT = 4

export default function Day(props: Props) {
  const { date, events = [], isToday = false, outOfBound = false, onClick } = props

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
        } ${outOfBound ? 'opacity-30' : ''} ${compactHeader ? 'gap-[3px] items-start' : 'items-start'}`}
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
  const max = props.maxEvents ?? BIG_MAX_DEFAULT
  const visible = events.slice(0, max)
  const overflow = events.length - visible.length

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-[5px] p-[9px] w-[132px] h-[144px] border-b border-r border-solid border-[#F4F6F8] text-left transition-colors ${
        isToday ? 'bg-primary-dark/10' : ''
      } ${outOfBound ? 'opacity-35' : ''}`}
    >
      {isToday ? (
        <span className="bg-primary-dark text-white rounded-full w-[22px] h-[22px] inline-flex items-center justify-center text-[14px] font-semibold shrink-0">
          {date}
        </span>
      ) : (
        <span className="text-primary-dark text-[14px] font-semibold">{date}</span>
      )}
      <div className="flex flex-col gap-[2px] w-full overflow-hidden">
        {visible.map((e) => (
          <Event key={e.id} title={e.title} type={e.type} color={e.color} size="big" />
        ))}
        {overflow > 0 && (
          <span className="text-primary-main text-[12px] font-semibold">+{overflow}</span>
        )}
      </div>
    </button>
  )
}
