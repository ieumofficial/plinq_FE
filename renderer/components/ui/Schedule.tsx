import Icon, { type IconName } from './Icon'
import UserGroup, { type Member } from './UserGroup'
import Button from './Button'

export type ScheduleType = 'planning' | 'check_in' | 'review' | 'retrospective'

type FullProps = {
  size?: 'full'
  title: string
  /** Time range, e.g. "9:00 — 9:30 AM". Geist Mono. */
  time: string
  isCurrent?: boolean
  /** Meeting type — drives the colored rail on the left. */
  type?: ScheduleType
  location?: string
  locationIcon?: IconName
  attendees?: Member[]
  attendeesLabel?: string
  onJoin?: () => void
}

type MiniProps = {
  size: 'mini'
  title: string
  /** Single time, e.g. "9:00 AM". */
  time: string
  isCurrent?: boolean
  /** Single letter avatar, e.g. "A" for Apollo. */
  initial: string
}

type Props = FullProps | MiniProps

export default function Schedule(props: Props) {
  if (props.size === 'mini') {
    const { isCurrent, time, title, initial } = props
    const bg = isCurrent ? 'bg-[#E6ECEF]' : 'bg-white-item'
    const avatarBg = isCurrent ? 'bg-red-light' : 'bg-blue-light'
    const avatarText = isCurrent ? 'text-red-main' : 'text-blue-main'
    return (
      <div className={`flex items-center gap-[10px] p-[10px] rounded-[5px] w-[225px] ${bg}`}>
        <div
          className={`w-[28px] h-[28px] rounded-[2px] flex items-center justify-center shrink-0 ${avatarBg}`}
        >
          <span
            className={`font-mono text-[12px] font-semibold ${avatarText}`}
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {initial}
          </span>
        </div>
        <div className="flex flex-col gap-[2px] min-w-0">
          <span
            className="text-[10px] font-semibold tracking-[1px] text-gray-main"
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {time}
          </span>
          <span className="font-sans text-[14px] font-semibold text-black truncate">{title}</span>
        </div>
      </div>
    )
  }

  // Full
  const {
    isCurrent,
    time,
    title,
    type = 'planning',
    location,
    locationIcon = 'Meeting',
    attendees,
    attendeesLabel,
    onJoin,
  } = props
  const bg = isCurrent ? 'bg-[#E6ECEF]' : 'bg-white-item'
  const railColor: Record<ScheduleType, string> = {
    planning: 'bg-blue-main',
    check_in: 'bg-green-main',
    review: 'bg-brown-med',
    retrospective: 'bg-purple-main',
  }
  return (
    <div className={`flex items-center justify-between gap-3 p-[10px] rounded-[5px] w-full ${bg}`}>
      <div className="flex items-stretch gap-[20px] min-w-0 flex-1">
        <div className={`w-[4px] rounded-[1px] shrink-0 ${railColor[type]}`} />
        <div className="flex flex-col gap-[10px] min-w-0 flex-1">
          <div className="flex flex-col gap-[3px]">
            <div
              className="flex items-center gap-[15px] text-[10px] font-semibold tracking-[1px]"
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              <span className="text-black">{time}</span>
              {isCurrent && <span className="text-red-med">● LIVE</span>}
            </div>
            <p className="font-sans text-[14px] font-semibold text-black truncate">{title}</p>
          </div>
          <div className="flex items-center gap-[15px] text-[10px] text-gray-main">
            {location && (
              <span className="inline-flex items-center gap-[5px]">
                <Icon name={locationIcon} size={11} />
                {location}
              </span>
            )}
            {location && attendees && attendees.length > 0 && (
              <span className="w-px h-[14px] bg-gray-border-light" />
            )}
            {attendees && attendees.length > 0 && (
              <span className="inline-flex items-center gap-[10px] min-w-0">
                <UserGroup members={attendees} size={15} />
                {attendeesLabel && (
                  <span className="text-gray-secondary truncate">{attendeesLabel}</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      {isCurrent && onJoin && (
        <Button size="compact" onClick={onJoin}>
          Join
        </Button>
      )}
    </div>
  )
}
