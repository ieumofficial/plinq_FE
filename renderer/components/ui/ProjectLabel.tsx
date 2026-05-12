/**
 * Colored badge with a single uppercase letter — used to identify a project
 * (or organization) in lists, cards, and pickers.
 *
 * The DB stores `projects.color` as either a palette key ('blue', 'green',
 * 'amber', 'red', 'purple', 'turquoise') or a custom hex string ('#RRGGBB').
 * This component handles both: palette keys map to bg-light/text-main token
 * pairs; hex strings are applied inline.
 */

export type ProjectColorKey =
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'purple'
  | 'turquoise'

const PALETTE: Record<ProjectColorKey, { bg: string; fg: string }> = {
  blue: { bg: 'bg-blue-light', fg: 'text-blue-main' },
  green: { bg: 'bg-[#DCEBE0]', fg: 'text-green-main' },
  amber: { bg: 'bg-brown-light', fg: 'text-brown-med' },
  red: { bg: 'bg-red-light', fg: 'text-red-main' },
  purple: { bg: 'bg-purple-light', fg: 'text-purple-main' },
  turquoise: { bg: 'bg-turquoise-light', fg: 'text-turquoise-main' },
}

const SIZES = {
  sm: { box: 20, text: '12px', rounded: '3px' },
  md: { box: 28, text: '14px', rounded: '5px' },
} as const

type Size = keyof typeof SIZES

type Props = {
  /** Letter to render. Anything longer is truncated to one character + uppercased. */
  name: string
  /**
   * Color: a palette key ('blue', 'green', …) for tokenized colors, OR a hex
   * string starting with '#' for custom user-picked colors. Defaults to 'blue'.
   */
  color?: string | null
  size?: Size
  className?: string
}

function isHex(s: string | null | undefined): s is string {
  return !!s && s.startsWith('#')
}

/** Lighten a hex by mixing with white at the given ratio (0–1). */
function tint(hex: string, ratio: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => parseInt(c, 16))
  const blend = (c: number) => Math.round(c + (255 - c) * ratio)
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`
}

export default function ProjectLabel({
  name,
  color = 'blue',
  size = 'sm',
  className,
}: Props) {
  const initial = (name?.charAt(0) ?? '?').toUpperCase()
  const dim = SIZES[size]

  if (isHex(color)) {
    // Custom hex: tint the bg, use the raw hex for text.
    return (
      <span
        style={{
          width: dim.box,
          height: dim.box,
          backgroundColor: tint(color, 0.78),
          color,
          fontSize: dim.text,
          borderRadius: dim.rounded,
          fontFamily: 'Geist Mono, ui-monospace, monospace',
        }}
        className={`inline-flex items-center justify-center font-bold uppercase shrink-0 ${className ?? ''}`}
      >
        {initial}
      </span>
    )
  }

  const key: ProjectColorKey = color && color in PALETTE ? (color as ProjectColorKey) : 'blue'
  const c = PALETTE[key]
  return (
    <span
      style={{
        width: dim.box,
        height: dim.box,
        fontSize: dim.text,
        borderRadius: dim.rounded,
        fontFamily: 'Geist Mono, ui-monospace, monospace',
      }}
      className={`inline-flex items-center justify-center font-bold uppercase shrink-0 ${c.bg} ${c.fg} ${className ?? ''}`}
    >
      {initial}
    </span>
  )
}
