type Props = {
  className?: string
}

/**
 * A bordered placeholder box with two diagonal lines forming an "X",
 * matching the Figma "03 Placeholder / Cross" component.
 */
export default function PlaceholderCross({ className }: Props) {
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
        <line x1="0" y1="0" x2="100" y2="100" stroke="#afb1b6" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#afb1b6" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
