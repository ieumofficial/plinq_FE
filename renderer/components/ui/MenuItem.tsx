import Icon, { type IconName } from './Icon'

type Props = {
  icon: IconName
  label: string
  /** Optional count chip on the right (e.g. unread or task count). */
  count?: number
  selected?: boolean
  /** Icon-only mode (used in narrow rail / stacked sidebar). */
  stacked?: boolean
  /** Compact variant — smaller vertical padding. */
  thin?: boolean
  onClick?: () => void
}

export default function MenuItem({
  icon,
  label,
  count,
  selected = false,
  stacked = false,
  thin = false,
  onClick,
}: Props) {
  const padding = thin ? 'px-[10px] py-[7px]' : 'p-[10px]'
  const width = stacked ? '' : 'w-[175px] justify-between'
  const surface = selected
    ? 'bg-white-white border border-solid border-gray-border text-black'
    : 'text-primary-main hover:bg-white-white/60'

  return (
    <button
      type="button"
      onClick={onClick}
      title={stacked ? label : undefined}
      aria-current={selected ? 'page' : undefined}
      className={`flex items-center rounded-[5px] transition-colors shrink-0 ${padding} ${width} ${surface}`}
    >
      <span className={`flex items-center ${stacked ? '' : 'gap-[10px]'}`}>
        <Icon name={icon} size={15} />
        {!stacked && (
          <span
            className={`text-[12px] whitespace-nowrap ${
              selected ? 'font-semibold' : 'font-normal'
            }`}
          >
            {label}
          </span>
        )}
      </span>
      {!stacked && (
        <span
          className={`text-[12px] font-medium tracking-[-0.27px] text-gray-secondary ${
            count === undefined ? 'opacity-0' : ''
          }`}
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {count ?? 0}
        </span>
      )}
    </button>
  )
}
