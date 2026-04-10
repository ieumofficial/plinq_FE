type Props = {
  className?: string
}

/**
 * The square logo placeholder used by the header — a bordered box
 * with an "X" inside, matching the Figma "01 Images / Placeholder".
 */
export default function Logo({ className }: Props) {
  return (
    <div
      className={
        'relative bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg overflow-hidden ' +
        (className ?? '')
      }
    >
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <line x1="0" y1="0" x2="100" y2="100" stroke="#afb1b6" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#afb1b6" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
