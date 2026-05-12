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

import { useState } from 'react'
import Icon from './Icon'
import UserGroup, { type Member } from './UserGroup'
import ReactionButton from './ReactionButton'

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
          {body}
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
