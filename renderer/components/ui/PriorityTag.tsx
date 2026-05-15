/**
 * Pill that renders a task priority. Matches Figma "Priority Tag" frame
 * (id 862:365). Highest/High share red; Low/Lowest share blue; Medium uses
 * brown-med — these pairings are intentional in the design.
 */

import Icon, { type IconName } from './Icon'

export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'

const STYLES: Record<
  Priority,
  { bg: string; text: string; icon: IconName; label: string }
> = {
  highest: { bg: 'bg-red-light', text: 'text-red-main', icon: 'Highest', label: 'Highest' },
  high: { bg: 'bg-red-light', text: 'text-red-main', icon: 'High', label: 'High' },
  medium: { bg: 'bg-brown-light', text: 'text-brown-med', icon: 'Medium', label: 'Medium' },
  low: { bg: 'bg-blue-light', text: 'text-blue-main', icon: 'Low', label: 'Low' },
  lowest: { bg: 'bg-blue-light', text: 'text-blue-main', icon: 'Lowest', label: 'Lowest' },
}

/** Map any incoming value (incl. the legacy DB enum 'urgent', or a value
 *  from a not-yet-migrated row) onto a guaranteed-valid key so this never
 *  crashes on STYLES[priority]. */
function normalizePriority(p: string | null | undefined): Priority {
  if (p === 'urgent') return 'highest'
  if (p && p in STYLES) return p as Priority
  return 'medium'
}

type Props = {
  priority: Priority | string
  /** Icon-only when false. */
  isText?: boolean
  className?: string
}

export default function PriorityTag({ priority, isText = true, className }: Props) {
  const s = STYLES[normalizePriority(priority)]
  return (
    <span
      className={`inline-flex items-center px-[5px] py-[2px] rounded-[2px] ${
        isText ? 'gap-[5px]' : ''
      } ${s.bg} ${s.text} ${className ?? ''}`}
    >
      <Icon name={s.icon} size={15} />
      {isText && (
        <span className="text-[12px] font-semibold whitespace-nowrap leading-none">
          {s.label}
        </span>
      )}
    </span>
  )
}
