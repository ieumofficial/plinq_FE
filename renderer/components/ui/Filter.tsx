type Props = {
  label: string
  count?: number
  selected?: boolean
  onClick?: () => void
}

/**
 * A small text-only filter chip used in toolbars (e.g., "All · 12").
 * Selected state shows a subtle white pill with shadow.
 */
export default function Filter({ label, count, selected = false, onClick }: Props) {
  const text = count !== undefined ? `${label} · ${count}` : label
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`px-[8px] py-[5px] rounded-[5px] text-[12px] font-sans whitespace-nowrap transition-colors ${
        selected
          ? 'bg-white-item text-black shadow-[0px_2.6px_1.3px_rgba(22,36,46,0.03)]'
          : 'text-black hover:bg-white-item/70'
      }`}
    >
      {text}
    </button>
  )
}
