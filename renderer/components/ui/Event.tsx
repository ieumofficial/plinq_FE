export type EventType = 'meeting' | 'task' | 'deadline' | 'project'

export type EventColor = {
  bg: string
  bar: string
  text: string
}

export const EVENT_COLORS: Record<EventType, EventColor> = {
  meeting: { bg: '#E5DEEF', bar: '#5B3D8A', text: '#5B3D8A' },
  task: { bg: '#F2DEDE', bar: '#9B3838', text: '#9B3838' },
  deadline: { bg: '#F2DEDE', bar: '#9B3838', text: '#9B3838' },
  project: { bg: '#DDE7F4', bar: '#2D5A9E', text: '#2D5A9E' },
}

type Props = {
  title: string
  type?: EventType
  /** Override colors directly (otherwise derived from `type`). */
  color?: EventColor
  /** "small" → 12px chip for Day Small. "big" → 20px chip for Day Big. */
  size?: 'small' | 'big'
}

export default function Event({ title, type = 'meeting', color, size = 'small' }: Props) {
  const c = color ?? EVENT_COLORS[type]

  if (size === 'big') {
    return (
      <div
        className="flex items-stretch gap-[5px] pr-[5px] rounded-[2px] w-full max-w-[114px] overflow-hidden"
        style={{ backgroundColor: c.bg }}
      >
        <div className="w-[3px] rounded-l-[2px] shrink-0" style={{ backgroundColor: c.bar }} />
        <p
          className="font-sans text-[12px] font-semibold py-[3px] truncate"
          style={{ color: c.text }}
        >
          {title}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex items-stretch gap-[2px] px-[3px] py-[2px] rounded-[1px] min-w-[60px] w-full overflow-hidden"
      style={{ backgroundColor: c.bg }}
    >
      <div className="w-px shrink-0" style={{ backgroundColor: c.bar }} />
      <p
        className="font-sans text-[8px] font-medium tracking-[0.3px] leading-none truncate"
        style={{ color: c.text }}
      >
        {title}
      </p>
    </div>
  )
}
