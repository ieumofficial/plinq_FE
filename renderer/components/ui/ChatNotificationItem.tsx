/**
 * One inbox row for a chat notification (Figma 1381:19810).
 *
 * Two visual variants gated by `chatType`:
 *   - DM      : avatar (30px round) + sender name + message body
 *   - Channel : project icon (small dotted square) + #channel + "name: body"
 *
 * The `+1 / +2 / +N` "stack" effect from Figma — three slightly offset cards
 * behind the front one — is handled by the wrapper that groups same-source
 * notifications. This component just renders a single card; the wrapper stacks
 * N copies behind it. Hovering swaps the right-side dismiss [×] for the
 * "Clear all" pill (when N>1).
 */

import type { ReactNode } from 'react'

type Props = {
  chatType: 'dm' | 'channel'
  title: string                // sender name (DM) or "#channel-name"
  body: string                 // raw message body for DM, "Author: body" for channel
  /** Author's display name when chatType='channel'. Renders as bold prefix. */
  channelAuthorName?: string
  /** When set, the avatar slot is rendered with this image. DMs only. */
  avatarUrl?: string | null
  /** Initials fallback for the DM avatar. */
  avatarInitial?: string
  /** Channel project color hex used to tint the small project tile. */
  channelColorHex?: string
  /** Right-side button. Either 'dismiss' (×) or 'clearAll' (text pill). */
  rightAction?: 'dismiss' | 'clearAll' | 'none'
  onClick?: () => void
  onRightAction?: () => void
  /** When `body` content should be greyed out (used for the back cards in
   *  the stacked variant). The front card stays white. */
  muted?: boolean
}

function CloseGlyph() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M1 1L8 8M8 1L1 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Tiny 4-square project tile, mirroring the Figma channel-notification icon
 *  (matches our Sparkle/StackedSideMenu project glyph idiom in spirit). */
function ChannelTile({ color = '#6BA7CC' }: { color?: string }) {
  return (
    <span className="bg-primary-dark inline-flex items-center justify-center rounded-full w-[30px] h-[30px] shrink-0">
      <span className="grid grid-cols-2 grid-rows-2 gap-[1.5px] w-[15px] h-[15px]">
        <span className="rounded-[3px] bg-gray-light" />
        <span className="rounded-full bg-gray-light/70" />
        <span className="rounded-[3px]" style={{ backgroundColor: color }} />
        <span className="rounded-[3px] bg-[#67859b]" />
      </span>
    </span>
  )
}

function DmAvatar({
  url,
  initial,
}: {
  url?: string | null
  initial?: string
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="rounded-full w-[30px] h-[30px] object-cover shrink-0"
      />
    )
  }
  return (
    <span
      className="rounded-full w-[30px] h-[30px] shrink-0 inline-flex items-center justify-center text-white text-[12px] font-semibold uppercase bg-primary-main"
      aria-hidden
    >
      {(initial || 'U').charAt(0)}
    </span>
  )
}

function RightButton({
  variant,
  onClick,
}: {
  variant: 'dismiss' | 'clearAll'
  onClick?: () => void
}) {
  if (variant === 'clearAll') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        className="bg-gray-main rounded-[3.75px] h-[15px] px-[5.927px] inline-flex items-center justify-center text-primary-light text-[8px] font-semibold whitespace-nowrap shrink-0"
      >
        Clear All
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      aria-label="Dismiss notification"
      className="bg-gray-main rounded-[3.75px] w-[15px] h-[15px] inline-flex items-center justify-center text-primary-light shrink-0"
    >
      <CloseGlyph />
    </button>
  )
}

export default function ChatNotificationItem({
  chatType,
  title,
  body,
  channelAuthorName,
  avatarUrl,
  avatarInitial,
  channelColorHex,
  rightAction = 'dismiss',
  onClick,
  onRightAction,
  muted = false,
}: Props) {
  const bodyColor = muted ? 'text-primary-main' : 'text-white'
  const Body: ReactNode =
    chatType === 'channel' && channelAuthorName ? (
      <span className={`text-[10px] leading-[1.5] ${bodyColor}`}>
        <span className="font-semibold">{channelAuthorName}</span>
        <span>: {body}</span>
      </span>
    ) : (
      <span className={`text-[10px] leading-[1.5] ${bodyColor}`}>{body}</span>
    )
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`bg-[#394851] border border-solid border-gray-main rounded-[5px] p-[10px] flex gap-[10px] items-center w-full ${
        onClick ? 'cursor-pointer hover:bg-[#3f5260]' : ''
      }`}
    >
      {chatType === 'dm' ? (
        <DmAvatar url={avatarUrl} initial={avatarInitial} />
      ) : (
        <ChannelTile color={channelColorHex} />
      )}
      <div className="flex flex-col gap-[1px] flex-1 min-w-0">
        <p className="text-primary-light text-[12px] font-semibold truncate leading-none">
          {title}
        </p>
        <p className="truncate min-w-0">{Body}</p>
      </div>
      {rightAction !== 'none' && (
        <RightButton variant={rightAction} onClick={onRightAction} />
      )}
    </div>
  )
}
