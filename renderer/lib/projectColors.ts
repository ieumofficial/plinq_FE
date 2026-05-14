/** Maps the 6 palette keys stored in `projects.color` to their main hex.
 *  Custom user-picked colors come through as already-hex strings. */
const PROJECT_COLOR_HEX: Record<string, string> = {
  blue: '#2D5A9E',
  green: '#2F6B45',
  amber: '#B68A48',
  red: '#9B3838',
  purple: '#5B3D8A',
  turquoise: '#558589',
}

/** Resolve a project's stored color (palette key or hex) to a usable hex.
 *  Returns the brand blue when the input is empty/unknown. */
export function resolveProjectColor(color: string | null | undefined): string {
  if (!color) return PROJECT_COLOR_HEX.blue
  if (color.startsWith('#')) return color
  return PROJECT_COLOR_HEX[color] ?? PROJECT_COLOR_HEX.blue
}
