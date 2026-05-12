/**
 * Member status / permission pill. Two flavors:
 *  - presence: ●Available / ●In meeting / ●Unavailable (colored pill with dot + text)
 *  - permission: Read-only / Editor / Admin (filled gray pill, white text)
 *
 * Figma "Member Status" frame (id 1001:9814).
 */

import type { ProjectRoleDb } from '../../lib/types'

export type Presence = 'available' | 'in_meeting' | 'unavailable'

const PRESENCE: Record<Presence, { bg: string; text: string; dot: string; label: string }> = {
  available: {
    bg: 'bg-green-light',
    text: 'text-green-main',
    dot: 'bg-green-main',
    label: 'Available',
  },
  in_meeting: {
    bg: 'bg-brown-light',
    text: 'text-brown-main',
    dot: 'bg-brown-main',
    label: 'In meeting',
  },
  unavailable: {
    bg: 'bg-red-light',
    text: 'text-red-main',
    dot: 'bg-red-main',
    label: 'Unavailable',
  },
}

const PERMISSION: Record<ProjectRoleDb, { bg: string; label: string }> = {
  admin: { bg: 'bg-gray-main', label: 'Admin' },
  editor: { bg: 'bg-gray-secondary', label: 'Editor' },
  readonly: { bg: 'bg-gray-light', label: 'Read-only' },
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
      <span
        className={`inline-flex items-center justify-center gap-[5px] px-[7px] py-[3px] rounded-[2px] ${p.bg} ${props.className ?? ''}`}
      >
        <span className={`w-[7px] h-[7px] rounded-full ${p.dot}`} />
        <span className={`text-[12px] font-semibold leading-none whitespace-nowrap ${p.text}`}>
          {p.label}
        </span>
      </span>
    )
  }
  const p = PERMISSION[props.status]
  return (
    <span
      className={`inline-flex items-center justify-center px-[7px] py-[3px] rounded-[2px] text-[12px] font-semibold leading-none whitespace-nowrap text-white ${p.bg} ${props.className ?? ''}`}
    >
      {p.label}
    </span>
  )
}
