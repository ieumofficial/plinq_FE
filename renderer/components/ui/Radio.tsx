/**
 * 12×12 radio dot. Selected state shows a small filled circle inside a ring.
 * Used inside Option rows and other single-select pickers.
 *
 * Figma "Radio" frame (id 1172:14812).
 */

type Props = {
  selected?: boolean
  onChange?: (next: boolean) => void
  className?: string
}

export default function Radio({ selected = false, onChange, className }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onChange?.(!selected)}
      className={`relative size-[12px] rounded-full border border-solid transition-colors shrink-0 inline-flex items-center justify-center ${
        selected ? 'border-primary-main bg-white-white' : 'border-gray-border bg-white-white'
      } ${className ?? ''}`}
    >
      {selected && (
        <span className="block size-[6px] rounded-full bg-primary-main" />
      )}
    </button>
  )
}
