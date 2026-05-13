export type EventType = 'meeting' | 'task' | 'deadline' | 'project'

export type EventColor = {
  bg: string
  bar: string
  text: string
}

export const EVENT_COLORS: Record<EventType, EventColor> = {
  meeting: { bg: '#DDE7F4', bar: '#2D5A9E', text: '#2D5A9E' }, // blue
  task: { bg: '#F4E6CD', bar: '#B68A48', text: '#8A5A1E' }, // amber
  deadline: { bg: '#F2DEDE', bar: '#9B3838', text: '#9B3838' }, // red
  project: { bg: '#F2DEDE', bar: '#9B3838', text: '#9B3838' }, // red (Project Due)
}

type Props = {
  title: string
  type?: EventType
  /** Override colors directly (otherwise derived from `type`). */
  color?: EventColor
  /** "small" → 12px chip for Day Small. "big" → 20px chip for Day Big.
   *  "fluid" → same as small but scales with the nearest `@container/calgrid`. */
  size?: 'small' | 'big' | 'fluid'
}

export default function Event({ title, type = 'meeting', color, size = 'small' }: Props) {
  const c = color ?? EVENT_COLORS[type]

  if (size === 'big') {
    return (
      <div
        className="flex items-stretch gap-[5px] pr-[5px] rounded-[2px] w-full overflow-hidden shrink-0"
        style={{ backgroundColor: c.bg }}
      >
        <div className="w-[3px] rounded-l-[2px] shrink-0" style={{ backgroundColor: c.bar }} />
        <p
          className="font-sans text-[12px] font-semibold py-[3px] truncate min-w-0"
          style={{ color: c.text }}
        >
          {title}
        </p>
      </div>
    )
  }

  const isFluid = size === 'fluid'
  return (
    <div
      className={`flex items-stretch rounded-[1px] w-full overflow-hidden ${
        isFluid
          ? 'gap-[2px] px-[3px] py-[2px] min-w-0 @[420px]/calgrid:gap-[3px] @[420px]/calgrid:px-[4px] @[420px]/calgrid:py-[3px] @[560px]/calgrid:gap-[4px] @[560px]/calgrid:px-[5px] @[560px]/calgrid:py-[4px] @[700px]/calgrid:gap-[5px] @[700px]/calgrid:px-[6px] @[700px]/calgrid:py-[5px] @[900px]/calgrid:px-[7px] @[900px]/calgrid:py-[6px]'
          : 'gap-[2px] px-[3px] py-[2px] min-w-[60px]'
      }`}
      style={{ backgroundColor: c.bg }}
    >
      <div className="w-px shrink-0" style={{ backgroundColor: c.bar }} />
      <p
        className={`font-sans font-medium tracking-[0.3px] leading-none truncate ${
          isFluid
            ? 'text-[8px] @[420px]/calgrid:text-[10px] @[560px]/calgrid:text-[12px] @[700px]/calgrid:text-[14px] @[900px]/calgrid:text-[16px]'
            : 'text-[8px]'
        }`}
        style={{ color: c.text }}
      >
        {title}
      </p>
    </div>
  )
}
