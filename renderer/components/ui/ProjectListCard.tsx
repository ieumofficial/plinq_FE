import StatusLabelBig, { type Status } from './StatusLabelBig'
import ProjectLabel from './ProjectLabel'
import UserGroup, { type Member } from './UserGroup'
import Icon from './Icon'

type Props = {
  name: string
  /** Project color palette key ('blue' | 'green' | ...) or '#rrggbb'. Defaults to blue. */
  color?: string | null
  description?: string
  status?: Status
  /** 0–100. */
  progress: number
  tasksDone: number
  tasksTotal: number
  /** Pre-formatted display string (e.g. "May 11" or "—"). */
  due?: string
  /** Lead member (avatar + name shown bottom-left). */
  lead?: Member
  /** Other project members (shown as overlapping avatars bottom-right). */
  members?: Member[]
  /** Pinned state — when true, a filled pin renders in the card header. When
   *  false, an empty pin appears on hover. */
  pinned?: boolean
  onOpen?: () => void
  onMenuClick?: () => void
  onTogglePin?: () => void
}

/**
 * Larger project card used on the dedicated Projects page.
 * Per Figma 874:6692.
 */
export default function ProjectListCard({
  name,
  color,
  description,
  status,
  progress,
  tasksDone,
  tasksTotal,
  due,
  lead,
  members,
  pinned,
  onOpen,
  onMenuClick,
  onTogglePin,
}: Props) {
  const pct = Math.max(0, Math.min(100, progress))

  return (
    <div
      onClick={onOpen}
      className="group bg-white-white border border-gray-border-light rounded-[10px] p-[20px] flex flex-col justify-between gap-4 cursor-pointer hover:shadow-sm transition-shadow"
    >
      {/* TOP: status + title + description */}
      <div className="flex flex-col gap-[15px] w-full">
        {/* Header: status + (pin + dot menu) */}
        <div className="flex items-center justify-between w-full">
          {status ? <StatusLabelBig status={status} size="md" /> : <span />}
          <div className="flex items-center gap-[2px]">
            {onTogglePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePin()
                }}
                aria-label={pinned ? 'Unpin project' : 'Pin project'}
                aria-pressed={pinned}
                className={`p-1 rounded transition-opacity ${
                  pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <Icon
                  name={pinned ? 'PinFilled' : 'Pin'}
                  size={15}
                  className={pinned ? 'text-gray-main' : 'text-primary-main'}
                />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMenuClick?.()
              }}
              className="text-gray-secondary hover:text-black p-1 rounded"
              aria-label="Project options"
            >
              <Icon name="Dot-Menu" size={15} />
            </button>
          </div>
        </div>

        {/* Title row: avatar + name */}
        <div className="flex items-center gap-[10px]">
          <ProjectLabel name={name} color={color ?? 'blue'} size="md" />
          <span className="text-black text-[20px] font-semibold truncate">{name}</span>
        </div>

        {/* Always reserve two lines of space so cards without a description
            stay the same height as cards with one. */}
        <p className="text-gray-main text-[12px] font-normal w-full leading-snug line-clamp-2 min-h-[33px]">
          {description ?? ''}
        </p>
      </div>

      {/* BOTTOM: progress + stats + lead/members */}
      <div className="flex flex-col gap-[15px] w-full">
        {/* Progress bar */}
        <div className="bg-gray-progress h-[3.5px] rounded-full overflow-hidden w-full">
          <div className="bg-blue-main h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-[40px]">
          <Stat label="Progress" value={`${pct}%`} />
          <Stat label="Tasks" value={`${tasksDone}/${tasksTotal}`} />
          <Stat label="Due" value={due ?? '—'} />
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-border-light w-full" />

        {/* Lead + members */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-[10px] min-w-0">
            {lead ? (
              <>
                <UserGroup members={[lead]} size={20} />
                <span className="text-gray-main text-[14px] font-semibold whitespace-nowrap">
                  Lead
                </span>
                <span className="text-gray-main text-[14px] font-semibold">·</span>
                <span className="text-[#2B3A45] text-[14px] font-semibold truncate">
                  {lead.name}
                </span>
              </>
            ) : (
              <span className="text-gray-secondary text-[12px]">No lead assigned</span>
            )}
          </div>
          {members && members.length > 0 && (
            <UserGroup members={members} size={20} max={5} overflowVariant="blue" />
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
        {label}
      </span>
      <span
        className="text-black text-[14px] font-semibold tracking-[1px]"
        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
      >
        {value}
      </span>
    </div>
  )
}
