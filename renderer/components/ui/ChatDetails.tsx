/**
 * Right-side details panel for the chat. Two variants:
 *  - 'channel' : "About this session" — name, description, created info, members, pinned
 *  - 'dm'      : the other person's profile — avatar, role, shared sessions, shared files
 *
 * Both variants have an optional AI card pinned to the bottom (e.g. "Catch me up"
 * for channels, "Action items inferred" for DMs).
 *
 * Figma "Chat Details" frame (id 1184:11400). 240px wide.
 */

import type { ReactNode } from 'react'
import Icon from './Icon'
import UserGroup, { type Member } from './UserGroup'
import FileLabel, { type FileCategory } from './FileLabel'
import CatchMeUpCard from './CatchMeUpCard'

// ─── Shared helpers ─────────────────────────────────────────────────────────

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
    {children}
  </p>
)

function Divider() {
  return <div className="h-px bg-gray-border-light w-full" />
}

function MemberRow({ member, tag }: { member: Member; tag?: string }) {
  return (
    <div className="flex items-center gap-[10px]">
      <UserGroup members={[member]} size={20} />
      <span className="text-black text-[12px] font-semibold flex-1 min-w-0 truncate">
        {member.name}
      </span>
      {tag && (
        <span className="bg-blue-light text-blue-main text-[10px] uppercase tracking-[1px] font-semibold rounded-[3px] px-[5px] py-[1px]">
          {tag}
        </span>
      )}
    </div>
  )
}

function PinnedRow({
  title,
  meta,
}: {
  title: string
  meta?: string
}) {
  return (
    <div className="flex items-start gap-[10px]">
      <Icon name="Pin" size={12} className="text-gray-main mt-[2px] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-black text-[12px] font-semibold truncate">{title}</p>
        {meta && <p className="text-gray-secondary text-[10px]">{meta}</p>}
      </div>
    </div>
  )
}

function SharedSessionRow({
  name,
  subtitle,
  category = 'project-context',
}: {
  name: string
  subtitle?: string
  category?: FileCategory
}) {
  return (
    <div className="flex items-center gap-[10px]">
      <FileLabel variant="icon" category={category} />
      <div className="min-w-0 flex-1">
        <p className="text-black text-[12px] font-semibold truncate">#{name}</p>
        {subtitle && <p className="text-gray-secondary text-[10px]">{subtitle}</p>}
      </div>
    </div>
  )
}

function SharedFileRow({
  name,
  meta,
  category = 'project-context',
}: {
  name: string
  meta?: string
  category?: FileCategory
}) {
  return (
    <div className="flex items-center gap-[10px]">
      <FileLabel variant="icon" category={category} />
      <div className="min-w-0 flex-1">
        <p className="text-black text-[12px] font-semibold truncate">{name}</p>
        {meta && <p className="text-gray-secondary text-[10px]">{meta}</p>}
      </div>
    </div>
  )
}

// ─── AI card (bottom, dark) ─────────────────────────────────────────────────

export type AiCardProps = {
  title: string
  subtitle?: string
  /** Render arbitrary action content (buttons, list rows, etc). */
  children?: ReactNode
}

function AiCard({ title, subtitle, children }: AiCardProps) {
  return (
    <div className="bg-primary-dark text-white rounded-[10px] p-[15px] flex flex-col gap-[10px]">
      <div className="flex items-center gap-[7px]">
        <Icon name="Sparkle" size={12} className="text-white shrink-0" />
        <p className="text-white text-[12px] font-semibold">{title}</p>
      </div>
      {subtitle && (
        <p className="text-white/70 text-[10px] leading-[1.5]">{subtitle}</p>
      )}
      {children}
    </div>
  )
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type ChatChannelMember = { member: Member; tag?: string }

export type ChatPinnedItem = { id: string; title: string; meta?: string }

export type ChatSharedSession = {
  id: string
  name: string
  subtitle?: string
  category?: FileCategory
}

export type ChatSharedFile = {
  id: string
  name: string
  meta?: string
  category?: FileCategory
}

type ChannelProps = {
  variant: 'channel'
  name: string
  description?: string
  /** "Auto-created with the organization · Jan 12, 2026" */
  createdLine?: string
  members: ChatChannelMember[]
  memberCount?: number
  /** Number of additional members not shown. Renders "+N more". */
  extraMemberCount?: number
  pinned?: ChatPinnedItem[]
  aiCard?: AiCardProps
  /** When set, shows the AI "Catch me up" panel pinned to the bottom.
   *  Cached per session (see useCatchMeUp) — no per-message refetch. */
  sessionId?: string | null
}

type DmProps = {
  variant: 'dm'
  member: Member
  jobTitle?: string
  orgName?: string
  sharedSessions?: ChatSharedSession[]
  sharedFiles?: ChatSharedFile[]
  aiCard?: AiCardProps
  sessionId?: string | null
}

type Props = ChannelProps | DmProps

export default function ChatDetails(props: Props) {
  if (props.variant === 'channel') {
    const {
      name,
      description,
      createdLine,
      members,
      memberCount,
      extraMemberCount,
      pinned,
      aiCard,
      sessionId,
    } = props
    return (
      <aside className="w-[290px] shrink-0 h-full flex flex-col bg-white-white border-t border-solid border-gray-border-light overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-[15px] flex flex-col gap-[15px]">
          {/* About */}
          <div className="flex flex-col gap-[5px]">
            <Eyebrow>About this session</Eyebrow>
            <h3 className="text-black text-[20px] font-semibold leading-tight">
              #{name}
            </h3>
            {description && (
              <p className="text-gray-main text-[10px]">{description}</p>
            )}
          </div>
          <Divider />

          {/* Created */}
          {createdLine && (
            <>
              <div className="flex flex-col gap-[5px]">
                <Eyebrow>Created</Eyebrow>
                <p className="text-gray-main text-[10px] leading-[1.5]">
                  {createdLine}
                </p>
              </div>
            </>
          )}

          {/* Members */}
          <div className="flex flex-col gap-[10px] bg-white-item rounded-[5px] p-[10px]">
            <div className="flex items-center justify-between">
              <Eyebrow>Members</Eyebrow>
              <span
                className="text-gray-secondary text-[10px] font-medium"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {memberCount ?? members.length}
              </span>
            </div>
            <div className="flex flex-col gap-[7px]">
              {members.map((m, i) => (
                <MemberRow key={`${m.member.name}-${i}`} member={m.member} tag={m.tag} />
              ))}
              {extraMemberCount && extraMemberCount > 0 && (
                <p className="text-gray-main text-[10px] mt-[2px]">
                  + {extraMemberCount} more
                </p>
              )}
            </div>
          </div>

          {/* Pinned */}
          {pinned && pinned.length > 0 && (
            <div className="flex flex-col gap-[10px]">
              <Eyebrow>Pinned</Eyebrow>
              <div className="flex flex-col gap-[10px]">
                {pinned.map((p) => (
                  <PinnedRow key={p.id} title={p.title} meta={p.meta} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI footer card — Catch me up takes precedence when sessionId is
            available; fall back to legacy stub aiCard otherwise. */}
        {sessionId ? (
          <div className="p-[10px] shrink-0">
            <CatchMeUpCard sessionId={sessionId} />
          </div>
        ) : aiCard ? (
          <div className="p-[10px] shrink-0">
            <AiCard {...aiCard} />
          </div>
        ) : null}
      </aside>
    )
  }

  // DM
  const {
    member,
    jobTitle,
    orgName,
    sharedSessions,
    sharedFiles,
    aiCard,
    sessionId,
  } = props
  const initial = (member.name?.charAt(0) ?? '?').toUpperCase()
  return (
    <aside className="w-[290px] shrink-0 h-full flex flex-col bg-white-white border-t border-solid border-gray-border-light overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-[15px] flex flex-col gap-[15px]">
        {/* Profile */}
        <div className="flex flex-col items-center gap-[7px]">
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="size-[60px] rounded-full object-cover bg-white-secondary border border-solid border-gray-border-light"
            />
          ) : (
            <span
              className="size-[60px] rounded-full inline-flex items-center justify-center bg-primary-main text-white text-[24px] font-semibold uppercase select-none"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {initial}
            </span>
          )}
          <p className="text-black text-[16px] font-semibold leading-none">
            {member.name}
          </p>
          {(jobTitle || orgName) && (
            <p className="text-gray-main text-[10px]">
              {[jobTitle, orgName].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Divider />

        {/* Shared sessions */}
        {sharedSessions && sharedSessions.length > 0 && (
          <div className="flex flex-col gap-[10px]">
            <div className="flex items-center justify-between">
              <Eyebrow>Shared sessions</Eyebrow>
              <span
                className="text-gray-secondary text-[10px] font-medium"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {sharedSessions.length}
              </span>
            </div>
            <div className="flex flex-col gap-[7px]">
              {sharedSessions.map((s) => (
                <SharedSessionRow
                  key={s.id}
                  name={s.name}
                  subtitle={s.subtitle}
                  category={s.category}
                />
              ))}
            </div>
          </div>
        )}

        {/* Shared files */}
        {sharedFiles && sharedFiles.length > 0 && (
          <div className="flex flex-col gap-[10px]">
            <Eyebrow>Shared files</Eyebrow>
            <div className="flex flex-col gap-[7px]">
              {sharedFiles.map((f) => (
                <SharedFileRow
                  key={f.id}
                  name={f.name}
                  meta={f.meta}
                  category={f.category}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI footer card — Catch me up when sessionId given, else legacy stub. */}
      {sessionId ? (
        <div className="p-[10px] shrink-0">
          <CatchMeUpCard sessionId={sessionId} />
        </div>
      ) : aiCard ? (
        <div className="p-[10px] shrink-0">
          <AiCard {...aiCard} />
        </div>
      ) : null}
    </aside>
  )
}
