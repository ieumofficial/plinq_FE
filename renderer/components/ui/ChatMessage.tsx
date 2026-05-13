/**
 * Single chat message row.
 *
 * Figma "Chat Message" frame (id 1178:14749). Variant matrix:
 *   isReaction × isHovered × isReplied
 *
 * Layout:
 *   [Avatar 28]  [Name][Role tag][Time]
 *                Body text
 *                [🎯4][🎯4][+]              ← isReaction
 *                [👥👥] 12 replies · Last today at 2:14PM   ← isReplied
 *
 * On hover, an action toolbar floats on the right (react / reply / pin / more).
 */

import { useState, type ReactNode } from 'react'
import Icon from './Icon'
import UserGroup, { type Member } from './UserGroup'
import ReactionButton from './ReactionButton'

/**
 * Minimal markdown parser for chat messages. Supports:
 *   **bold**   *italic*   ~~strike~~   `code`
 *   [text](url)   - [ ] todo / - [x] done   📎 filename (XX KB)
 *
 * Bold is matched before italic so the double-star isn't consumed by the
 * single-star alternative. Links and inline-code are matched first so brackets
 * and backticks inside them don't trigger other tokens.
 */
const MD_TOKEN =
  /(\[[^\]\n]+\]\([^)\n]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*)/g

function renderInline(line: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(MD_TOKEN)) {
    const idx = m.index!
    if (idx > last) parts.push(line.slice(last, idx))
    const t = m[0]
    const key = `${keyBase}-${idx}`
    if (t.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-blue-main underline decoration-blue-main/40 hover:decoration-blue-main"
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        parts.push(t)
      }
    } else if (t.startsWith('**')) {
      parts.push(
        <strong key={key} className="font-semibold">
          {t.slice(2, -2)}
        </strong>
      )
    } else if (t.startsWith('~~')) {
      parts.push(<s key={key}>{t.slice(2, -2)}</s>)
    } else if (t.startsWith('`')) {
      parts.push(
        <code
          key={key}
          className="bg-gray-extra-light text-red-main px-[4px] py-[1px] rounded-[3px] text-[11px]"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {t.slice(1, -1)}
        </code>
      )
    } else if (t.startsWith('*')) {
      parts.push(<em key={key}>{t.slice(1, -1)}</em>)
    }
    last = idx + t.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

const LIST_RE = /^- (.*)$/

function renderMarkdown(body: string): ReactNode[] {
  // Split by lines so we can render list items per-line while keeping
  // inline formatting inside each line.
  const lines = body.split('\n')
  return lines.map((line, i) => {
    const li = LIST_RE.exec(line)
    if (li) {
      return (
        <span key={`l-${i}`} className="flex items-start gap-[8px]">
          <span
            aria-hidden
            className="mt-[6px] w-[4px] h-[4px] rounded-full bg-gray-main shrink-0"
          />
          <span>{renderInline(li[1], `i-${i}`)}</span>
          {i < lines.length - 1 && '\n'}
        </span>
      )
    }
    return (
      <span key={`l-${i}`}>
        {renderInline(line, `i-${i}`)}
        {i < lines.length - 1 && '\n'}
      </span>
    )
  })
}

export type Reaction = {
  /** Emoji glyph or short code. */
  emoji: string
  count: number
  /** Whether the current user has reacted with this emoji. */
  selectedByMe?: boolean
}

export type ReplyThread = {
  count: number
  /** Avatars of distinct repliers (up to 3-4 shown). */
  avatars: Member[]
  /** "Last today at 2:14PM" summary. */
  lastReplyLabel?: string
}

type Props = {
  author: Member
  /** Optional small badge after the name (e.g. "Lead"). */
  authorTag?: string
  /** "10:31AM" — already-formatted. */
  time: string
  body: string
  reactions?: Reaction[]
  thread?: ReplyThread
  onReact?: () => void
  onReply?: () => void
  onPin?: () => void
  onMore?: () => void
  onAddReaction?: () => void
  onOpenThread?: () => void
}

const FALLBACK_BG = '#5B7FB6'

function Avatar({ member }: { member: Member }) {
  if (member.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatarUrl}
        alt={member.name}
        className="size-[28px] rounded-full object-cover bg-white-secondary border border-solid border-gray-border-light shrink-0"
      />
    )
  }
  return (
    <span
      style={{ backgroundColor: member.color ?? FALLBACK_BG }}
      className="size-[28px] rounded-full inline-flex items-center justify-center text-white text-[12px] font-semibold uppercase shrink-0 select-none"
    >
      {member.name.charAt(0)}
    </span>
  )
}

function HoverToolbar({
  onReact,
  onReply,
  onPin,
  onMore,
}: Pick<Props, 'onReact' | 'onReply' | 'onPin' | 'onMore'>) {
  const Btn = ({
    icon,
    label,
    onClick,
  }: {
    icon: 'Sparkle' | 'Chat' | 'Pin' | 'Dot-Menu'
    label: string
    onClick?: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center justify-center p-[7px] text-gray-main hover:bg-white-item hover:text-black transition-colors"
    >
      <Icon name={icon} size={15} />
    </button>
  )
  return (
    <div className="absolute top-[-12px] right-[10px] bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-sm flex items-center divide-x divide-gray-border-light">
      <Btn icon="Sparkle" label="React" onClick={onReact} />
      <Btn icon="Chat" label="Reply" onClick={onReply} />
      <Btn icon="Pin" label="Pin" onClick={onPin} />
      <Btn icon="Dot-Menu" label="More" onClick={onMore} />
    </div>
  )
}

export default function ChatMessage({
  author,
  authorTag,
  time,
  body,
  reactions,
  thread,
  onReact,
  onReply,
  onPin,
  onMore,
  onAddReaction,
  onOpenThread,
}: Props) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex gap-[10px] px-[15px] py-[5px] hover:bg-white-item/60 transition-colors"
    >
      <Avatar member={author} />
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
        {/* Header */}
        <div className="flex items-center gap-[7px] flex-wrap">
          <span className="text-black text-[12px] font-semibold leading-none">
            {author.name}
          </span>
          {authorTag && (
            <span className="bg-gray-extra-light text-gray-main text-[10px] uppercase tracking-[1px] font-semibold rounded-[2px] px-[5px] py-[1px]">
              {authorTag}
            </span>
          )}
          <span
            className="text-gray-secondary text-[10px] tracking-[1px]"
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {time}
          </span>
        </div>
        {/* Body */}
        <p className="text-black text-[12px] leading-[1.5] whitespace-pre-wrap break-words">
          {renderMarkdown(body)}
        </p>
        {/* Reactions */}
        {reactions && reactions.length > 0 && (
          <div className="flex items-center gap-[5px] flex-wrap mt-[2px]">
            {reactions.map((r, i) => (
              <ReactionButton
                key={`${r.emoji}-${i}`}
                variant="reaction"
                emoji={r.emoji}
                count={r.count}
                selected={r.selectedByMe}
              />
            ))}
            <ReactionButton variant="add" onClick={onAddReaction} />
          </div>
        )}
        {/* Thread */}
        {thread && (
          <button
            type="button"
            onClick={onOpenThread}
            className="flex items-center gap-[8px] mt-[3px] text-left rounded-[5px] -mx-[5px] px-[5px] py-[3px] hover:bg-white-item"
          >
            <UserGroup members={thread.avatars.slice(0, 3)} size={20} />
            <span className="text-blue-main text-[12px] font-semibold">
              {thread.count} {thread.count === 1 ? 'reply' : 'replies'}
            </span>
            {thread.lastReplyLabel && (
              <span className="text-gray-secondary text-[10px]">
                · {thread.lastReplyLabel}
              </span>
            )}
          </button>
        )}
      </div>
      {hovered && (
        <HoverToolbar onReact={onReact} onReply={onReply} onPin={onPin} onMore={onMore} />
      )}
    </div>
  )
}
