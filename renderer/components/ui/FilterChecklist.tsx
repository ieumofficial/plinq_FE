type Props = {
  label: string
  count?: number
  /** Color used for the checkbox indicator when checked. */
  color?: string
  checked?: boolean
  onChange?: (next: boolean) => void
  /** Extra classes appended to the row — e.g. `!w-full` to override the
   *  default 225px when used inside a narrower container. */
  className?: string
}

/**
 * Calendar-sidebar style checklist row: colored square + label + count.
 * Used to toggle visibility of categories on the calendar.
 */
export default function FilterChecklist({
  label,
  count,
  color = '#5B7FB6',
  checked = true,
  onChange,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      className={`flex items-center justify-between w-[225px] h-[27px] py-[5px] hover:bg-white-item/60 transition-colors rounded-[3px] px-[2px] ${className ?? ''}`}
    >
      <span className="flex items-center gap-[10px]">
        <span
          aria-hidden
          className="rounded-[2px] inline-flex items-center justify-center"
          style={{
            width: 15,
            height: 15,
            backgroundColor: checked ? color : '#EEF1F4',
          }}
        >
          {checked && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6.5L4.8 9L10 3.5"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span
          className={`text-[12px] font-semibold whitespace-nowrap ${
            checked ? 'text-black' : 'text-gray-secondary'
          }`}
        >
          {label}
        </span>
      </span>
      {count !== undefined && (
        <span
          className="text-[12px] font-normal text-gray-secondary tracking-[-0.3px]"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
