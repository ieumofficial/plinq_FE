/**
 * Header bar at the top of a chat conversation. Two variants:
 *  - 'channel' : "#general" with org eyebrow, members chip, search, pinned chip
 *  - 'dm'      : "Mira Chen" with active-now eyebrow, role + project tags, search
 *
 * Figma "Chat Header" frame (id 1172:15131).
 */

import type { ReactNode } from 'react'
import Icon from './Icon'
import UserGroup, { type Member } from './UserGroup'
import ProjectLabel from './ProjectLabel'

type ChannelProps = {
  variant: 'channel'
  /** "STRATOS LABS" — shown after "ORG · " in the eyebrow. */
  orgName: string
  /** Channel name without the "#" prefix. */
  name: string
  description?: string
  /** AI tip line shown below the title. */
  tipNode?: ReactNode
  members?: Member[]
  memberCount?: number
  pinnedCount?: number
  /** Hex color for the eyebrow ("ORG · …"). Defaults to blue. */
  eyebrowColor?: string
  onSearch?: () => void
  onShowMembers?: () => void
  onShowPinned?: () => void
}

type DmProps = {
  variant: 'dm'
  /** Their name. */
  name: string
  /** Avatar member object (for initial fallback). */
  member: Member
  /** "ACTIVE NOW" / "AWAY" / "OFFLINE" — shown after "DIRECT · " in the eyebrow. */
  presenceLabel?: string
  /** Show a small green presence dot next to the name. */
  isActive?: boolean
  jobTitle?: string
  /** Project the user belongs to (small ProjectLabel + name pill below the title). */
  project?: { name: string; color?: string | null }
  tipNode?: ReactNode
  /** Hex color for the eyebrow ("DIRECT · …"). Defaults to blue. */
  eyebrowColor?: string
  onSearch?: () => void
}

type Props = ChannelProps | DmProps

const Eyebrow = ({
  children,
  color,
}: {
  children: ReactNode
  color?: string
}) => (
  <p
    className="text-[10px] font-medium uppercase tracking-[1.5px]"
    style={{ color: color ?? '#2D5A9E' }}
  >
    {children}
  </p>
)

function TipBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white-item border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[7px] flex items-center gap-[7px] text-[12px] text-gray-main">
      <Icon name="Sparkle" size={12} className="text-primary-main shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  )
}

export default function ChatHeader(props: Props) {
  if (props.variant === 'channel') {
    const {
      orgName,
      name,
      description,
      tipNode,
      members,
      memberCount,
      pinnedCount,
      eyebrowColor,
      onSearch,
      onShowMembers,
      onShowPinned,
    } = props
    return (
      <header className="flex flex-col gap-[10px] w-full">
        <div className="flex items-start justify-between gap-[20px]">
          <div className="flex flex-col gap-[5px] min-w-0 flex-1">
            <Eyebrow color={eyebrowColor}>org · {orgName}</Eyebrow>
            <h1 className="text-black text-[28px] font-semibold leading-tight truncate">
              #{name}
            </h1>
            {description && (
              <p className="text-gray-main text-[12px]">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-[10px] shrink-0">
            {members && members.length > 0 && (
              <button
                type="button"
                onClick={onShowMembers}
                className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[5px] inline-flex items-center gap-[8px] hover:bg-white-item"
              >
                <UserGroup members={members.slice(0, 4)} size={20} />
                <span
                  className="text-gray-main text-[12px] font-medium"
                  style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                >
                  {memberCount ?? members.length}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onSearch}
              aria-label="Search messages"
              className="bg-white-white border border-solid border-gray-border-light rounded-[5px] p-[7px] inline-flex items-center justify-center text-primary-main hover:bg-white-item"
            >
              <Icon name="Search" size={15} />
            </button>
            {pinnedCount !== undefined && (
              <button
                type="button"
                onClick={onShowPinned}
                className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[5px] inline-flex items-center gap-[5px] text-[12px] text-black hover:bg-white-item"
              >
                <Icon name="Pin" size={12} />
                Pinned · {pinnedCount}
              </button>
            )}
          </div>
        </div>
        {tipNode && <TipBar>{tipNode}</TipBar>}
      </header>
    )
  }

  // DM
  const { name, member, presenceLabel = 'ACTIVE NOW', isActive, jobTitle, project, tipNode, eyebrowColor, onSearch } = props
  const initial = (member.name?.charAt(0) ?? '?').toUpperCase()
  return (
    <header className="flex flex-col gap-[10px] w-full">
      <div className="flex items-start justify-between gap-[20px]">
        <div className="flex items-start gap-[15px] min-w-0 flex-1">
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="size-[50px] rounded-full object-cover bg-white-secondary border border-solid border-gray-border-light shrink-0"
            />
          ) : (
            <span
              className="size-[50px] rounded-full inline-flex items-center justify-center bg-primary-main text-white text-[18px] font-semibold uppercase shrink-0"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {initial}
            </span>
          )}
          <div className="flex flex-col gap-[5px] min-w-0 flex-1">
            <Eyebrow color={eyebrowColor}>direct · {presenceLabel}</Eyebrow>
            <div className="flex items-center gap-[10px]">
              <h1 className="text-black text-[28px] font-semibold leading-tight truncate">
                {name}
              </h1>
              {isActive && (
                <span className="size-[10px] rounded-full bg-green-main shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-[5px] flex-wrap">
              {jobTitle && (
                <span className="bg-gray-extra-light text-gray-main text-[10px] uppercase tracking-[1px] font-semibold rounded-[3px] px-[7px] py-[3px]">
                  {jobTitle}
                </span>
              )}
              {project && (
                <span className="inline-flex items-center gap-[5px] bg-blue-light text-blue-main text-[10px] uppercase tracking-[1px] font-semibold rounded-[3px] px-[7px] py-[3px]">
                  <ProjectLabel name={project.name} color={project.color ?? 'blue'} size="sm" />
                  {project.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search messages"
          className="bg-white-white border border-solid border-gray-border-light rounded-[5px] p-[7px] inline-flex items-center justify-center text-primary-main hover:bg-white-item shrink-0"
        >
          <Icon name="Search" size={15} />
        </button>
      </div>
      {tipNode && <TipBar>{tipNode}</TipBar>}
    </header>
  )
}
