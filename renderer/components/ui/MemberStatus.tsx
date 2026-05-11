/**
 * Member status / permission pill. Two flavors:
 *  - presence: ●Available / ●In meeting / ●Unavailable (colored dot + text)
 *  - permission: Read-only / Editor / Admin (filled pill)
 *
 * Figma "Member Status" frame (id 1001:9814).
 */

import type { ProjectRoleDb } from '../../lib/types'

export type Presence = 'available' | 'in_meeting' | 'unavailable'

const PRESENCE: Record<Presence, { dot: string; label: string }> = {
  available: { dot: 'bg-green-main', label: 'Available' },
  in_meeting: { dot: 'bg-brown-med', label: 'In meeting' },
  unavailable: { dot: 'bg-red-main', label: 'Unavailable' },
}

const PERMISSION: Record<ProjectRoleDb, { bg: string; text: string; label: string }> = {
  admin: { bg: 'bg-primary-main', text: 'text-white', label: 'Admin' },
  editor: { bg: 'bg-gray-main', text: 'text-white', label: 'Editor' },
  readonly: { bg: 'bg-gray-extra-light', text: 'text-gray-main', label: 'Read-only' },
}

type PresenceProps = {
  variant: 'presence'
  status: Presence
  className?: string
}

type PermissionProps = {
  variant: 'permission'
  status: ProjectRoleDb
  className?: string
}

type Props = PresenceProps | PermissionProps

export default function MemberStatus(props: Props) {
  if (props.variant === 'presence') {
    const p = PRESENCE[props.status]
    return (
      <span className={`inline-flex items-center gap-[6px] ${props.className ?? ''}`}>
        <span className={`w-[6px] h-[6px] rounded-full ${p.dot}`} />
        <span className="text-[12px] text-black">{p.label}</span>
      </span>
    )
  }
  const p = PERMISSION[props.status]
  return (
    <span
      className={`inline-flex items-center justify-center px-[10px] py-[3px] rounded-[3px] text-[12px] font-semibold ${p.bg} ${p.text} ${props.className ?? ''}`}
    >
      {p.label}
    </span>
  )
}
