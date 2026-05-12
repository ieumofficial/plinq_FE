/**
 * Left sidebar for the Messages page. Lists all chat sessions (channels grouped
 * by org-wide / project-assigned / member-group) and direct messages.
 *
 * Figma "Stacked Side Menu / Page=Chat" frame (id 1140:9173). 250px wide.
 */

import { useEffect, useState, type ReactNode } from 'react'
import Icon from './Icon'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChatFilterKey = 'all' | 'unread' | 'mentions' | 'sessions' | 'dms'

export type ChatPresence = 'online' | 'away' | 'offline'

export type ChatSessionItem = {
  id: string
  /** Channel name without the "#" prefix. */
  name: string
  /** Optional small project label shown next to the name (e.g. "APOLLO"). */
  projectTag?: string
  /** Total unread count. */
  unreadCount?: number
  /** Whether unread items include @mentions (renders @ icon in the badge). */
  hasMention?: boolean
}

export type ChatSessionGroup = {
  /** "Org-wide · Stratos Labs" / "Assigned to projects" / "Member groups" */
  label: string
  items: ChatSessionItem[]
}

export type ChatDmItem = {
  id: string
  name: string
  /** Avatar URL. Falls back to first-letter initial. */
  avatarUrl?: string
  presence?: ChatPresence
  /** "Yes — staging flake reproduced." or "You: Sounds good!" */
  preview?: string
  /** "2m" / "1h" / "Yesterday" — relative time. */
  timeLabel?: string
  unreadCount?: number
  hasMention?: boolean
}

type Props = {
  /** Filter chip currently selected. */
  activeFilter?: ChatFilterKey
  onFilterChange?: (next: ChatFilterKey) => void

  searchValue?: string
  onSearchChange?: (value: string) => void
  onCreateClick?: () => void

  sessionsCount?: number
  sessionGroups?: ChatSessionGroup[]

  dmCount?: number
  dms?: ChatDmItem[]

  /** id of the currently selected session/dm row. */
  activeId?: string
  onItemClick?: (id: string, kind: 'session' | 'dm') => void
}

// ─── Sub-pieces ─────────────────────────────────────────────────────────────

const FILTERS: { key: ChatFilterKey; label: string; bg: string; text: string }[] = [
  { key: 'all', label: 'All', bg: 'bg-blue-light', text: 'text-blue-main' },
  { key: 'unread', label: 'Unread', bg: 'bg-red-light', text: 'text-red-main' },
  { key: 'mentions', label: 'Mentions', bg: 'bg-brown-light', text: 'text-brown-main' },
  { key: 'sessions', label: 'Sessions', bg: 'bg-purple-light', text: 'text-purple-main' },
  { key: 'dms', label: 'DMs', bg: 'bg-green-light', text: 'text-green-main' },
]

function FilterChip({
  label,
  bg,
  text,
  active,
  onClick,
}: {
  label: string
  bg: string
  text: string
  active: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-[7px] py-[3px] rounded-[2px] text-[10px] font-semibold uppercase tracking-[1px] whitespace-nowrap transition-opacity ${bg} ${text} ${
        active ? 'opacity-100' : 'opacity-30 hover:opacity-60'
      }`}
    >
      {label}
    </button>
  )
}

function NotificationBadge({
  count,
  hasMention,
}: {
  count: number
  hasMention?: boolean
}) {
  return (
    <span
      className={`bg-red-notification text-white inline-flex items-center justify-center rounded-[8px] h-[16px] ${
        hasMention ? 'gap-[2px] px-[4px]' : 'min-w-[16px] px-[4px]'
      }`}
    >
      {hasMention && <span className="text-[10px] leading-none">@</span>}
      <span
        className="text-[10px] leading-none tracking-[1px]"
        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
      >
        {count}
      </span>
    </span>
  )
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M5 1.5 L4 10.5 M8 1.5 L7 10.5 M1.5 4 L10.5 4 M1.5 8 L10.5 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SessionRow({
  item,
  active,
  onClick,
}: {
  item: ChatSessionItem
  active: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-between gap-[10px] px-[10px] py-[8px] rounded-[8px] w-full transition-colors ${
        active
          ? 'bg-white-white border border-solid border-gray-border-light'
          : 'border border-solid border-transparent hover:bg-white-white/60'
      }`}
    >
      <span className="flex items-center gap-[5px] min-w-0">
        <HashIcon
          className={`shrink-0 ${active ? 'text-black' : 'text-gray-main'}`}
        />
        <span
          className={`text-[12px] truncate ${
            active ? 'text-black font-semibold' : 'text-gray-main'
          }`}
        >
          {item.name}
        </span>
        {item.projectTag && (
          <span className="bg-blue-light text-blue-main text-[8px] uppercase tracking-[1px] font-semibold px-[5px] py-[2px] rounded-[2px] shrink-0">
            {item.projectTag}
          </span>
        )}
      </span>
      {item.unreadCount && item.unreadCount > 0 && (
        <NotificationBadge count={item.unreadCount} hasMention={item.hasMention} />
      )}
    </button>
  )
}

const PRESENCE_DOT: Record<ChatPresence, string> = {
  online: 'bg-green-main',
  away: 'bg-brown-med',
  offline: 'bg-gray-secondary',
}

function DmRow({
  item,
  active,
  onClick,
}: {
  item: ChatDmItem
  active: boolean
  onClick?: () => void
}) {
  const initial = item.name.charAt(0).toUpperCase()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-between gap-[10px] w-full text-left transition-colors rounded-[8px] -mx-[5px] px-[5px] py-[3px] ${
        active ? 'bg-white-white' : 'hover:bg-white-white/60'
      }`}
    >
      <span className="flex items-center gap-[6px] min-w-0 flex-1">
        {item.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.avatarUrl}
            alt={item.name}
            className="size-[30px] rounded-full object-cover bg-white-secondary border border-solid border-gray-border-light shrink-0"
          />
        ) : (
          <span className="size-[30px] rounded-full inline-flex items-center justify-center bg-primary-main text-white text-[12px] font-semibold uppercase shrink-0 select-none">
            {initial}
          </span>
        )}
        <span className="flex flex-col gap-[1px] min-w-0 flex-1">
          <span className="flex items-center gap-[5px]">
            <span className="text-black text-[10px] font-semibold truncate">
              {item.name}
            </span>
            {item.presence && (
              <span
                className={`size-[5px] rounded-full shrink-0 ${PRESENCE_DOT[item.presence]}`}
              />
            )}
          </span>
          {item.preview && (
            <span className="text-primary-main text-[8px] leading-[1.5] truncate">
              {item.preview}
            </span>
          )}
        </span>
      </span>
      <span className="flex flex-col items-end gap-[2px] shrink-0">
        {item.timeLabel && (
          <span
            className="text-gray-main text-[8px] tracking-[1px] font-semibold"
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {item.timeLabel}
          </span>
        )}
        {item.unreadCount && item.unreadCount > 0 && (
          <NotificationBadge
            count={item.unreadCount}
            hasMention={item.hasMention}
          />
        )}
      </span>
    </button>
  )
}

function SectionHeader({
  label,
  count,
}: {
  label: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-[10px]">
      <p className="text-gray-main text-[10px] font-semibold uppercase tracking-[1px]">
        {label}
      </p>
      {count !== undefined && (
        <p
          className="text-gray-secondary text-[10px] font-semibold tracking-[1px]"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {count}
        </p>
      )}
    </div>
  )
}

function GroupSubHeader({ children }: { children: ReactNode }) {
  return (
    <p className="text-gray-main text-[8px] font-medium uppercase tracking-[1.5px]">
      {children}
    </p>
  )
}

function Divider() {
  return <div className="h-px bg-gray-border-light w-full" />
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function ChatSidebar({
  activeFilter = 'all',
  onFilterChange,
  searchValue = '',
  onSearchChange,
  onCreateClick,
  sessionsCount,
  sessionGroups = [],
  dmCount,
  dms = [],
  activeId,
  onItemClick,
}: Props) {
  // Slide-in: start at 0 width, expand to 250px on the next paint so the
  // sidebar animates open whenever the Messages route mounts it.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <aside
      className={`bg-[#F4F6F8] border-t border-r border-solid border-gray-border-light shrink-0 h-full flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out ${
        open ? 'w-[250px]' : 'w-0'
      }`}
    >
      {/* Title block */}
      <div className="flex flex-col gap-[5px] p-[10px]">
        <p className="text-primary-main text-[10px] font-medium uppercase tracking-[1.5px]">
          Chat
        </p>
        <p className="text-black text-[20px] font-semibold leading-tight">
          All Conversations
        </p>
        <p className="text-gray-main text-[10px] leading-[1.5]">
          Sessions and DMs across all projects
        </p>
      </div>

      <Divider />

      {/* Search + create + filters */}
      <div className="flex flex-col gap-[10px] p-[10px]">
        <div className="flex items-center gap-[5px]">
          <label className="bg-white-white border border-solid border-gray-border rounded-[8px] flex items-center gap-[5px] px-[10px] py-[7px] flex-1 min-w-0">
            <Icon name="Search" size={15} className="text-gray-secondary shrink-0" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[10px] text-black placeholder:text-gray-secondary"
            />
          </label>
          <button
            type="button"
            onClick={onCreateClick}
            aria-label="New chat session"
            className="bg-primary-main hover:bg-primary-dark text-white inline-flex items-center justify-center rounded-[5px] p-[7px] shrink-0"
          >
            <Icon name="Add" size={15} />
          </button>
        </div>
        <div className="flex flex-wrap gap-[5px]">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              bg={f.bg}
              text={f.text}
              active={activeFilter === f.key}
              onClick={() => onFilterChange?.(f.key)}
            />
          ))}
        </div>
      </div>

      <Divider />

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {/* Sessions */}
        <div className="flex flex-col gap-[10px] p-[10px]">
          <SectionHeader
            label="Sessions"
            count={
              sessionsCount ??
              sessionGroups.reduce((s, g) => s + g.items.length, 0)
            }
          />
          {sessionGroups.map((g, i) => (
            <div key={`${g.label}-${i}`} className="flex flex-col gap-[3px]">
              <GroupSubHeader>{g.label}</GroupSubHeader>
              {g.items.map((it) => (
                <SessionRow
                  key={it.id}
                  item={it}
                  active={it.id === activeId}
                  onClick={() => onItemClick?.(it.id, 'session')}
                />
              ))}
            </div>
          ))}
        </div>

        {/* DMs */}
        <div className="flex flex-col gap-[10px] p-[10px]">
          <SectionHeader label="Direct Messages" count={dmCount ?? dms.length} />
          <div className="flex flex-col gap-[15px]">
            {dms.map((d) => (
              <DmRow
                key={d.id}
                item={d}
                active={d.id === activeId}
                onClick={() => onItemClick?.(d.id, 'dm')}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
