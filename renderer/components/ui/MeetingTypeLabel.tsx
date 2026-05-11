/**
 * Pill that identifies a meeting's type. Used on meeting cards, lists,
 * and the dashboard. Matches Figma "Meeting Type Label" frame (id 1042:6008).
 */

import type { MeetingType } from '../../lib/types'

const STYLES: Record<MeetingType, { bg: string; text: string; label: string }> = {
  planning: { bg: 'bg-blue-light', text: 'text-blue-main', label: 'Planning' },
  check_in: { bg: 'bg-green-light', text: 'text-green-main', label: 'Check-In' },
  review: { bg: 'bg-brown-light', text: 'text-brown-main', label: 'Review' },
  retrospective: {
    bg: 'bg-purple-light',
    text: 'text-purple-main',
    label: 'Retrospective',
  },
}

type Props = {
  type: MeetingType
  className?: string
}

export default function MeetingTypeLabel({ type, className }: Props) {
  const s = STYLES[type]
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[2px] px-[7px] py-[3px] text-[10px] font-semibold uppercase tracking-[1px] whitespace-nowrap ${s.bg} ${s.text} ${className ?? ''}`}
    >
      {s.label}
    </span>
  )
}
