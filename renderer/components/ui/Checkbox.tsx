type Props = {
  checked?: boolean
  onChange?: (next: boolean) => void
  size?: number
  className?: string
  label?: string
}

export default function Checkbox({
  checked = false,
  onChange,
  size = 15,
  className,
  label,
}: Props) {
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      style={{ width: size, height: size }}
      className={[
        'inline-flex items-center justify-center rounded-[2px] transition-colors shrink-0',
        checked
          ? 'bg-gray-secondary text-white'
          : 'bg-white-white border border-solid border-gray-secondary',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      {checked && (
        <svg
          width={Math.max(8, size * 0.65)}
          height={Math.max(8, size * 0.65)}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path d="M2 6.5L4.8 9L10 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )

  if (!label) return box
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      {box}
      <span className="text-[12px] font-sans text-black">{label}</span>
    </label>
  )
}
