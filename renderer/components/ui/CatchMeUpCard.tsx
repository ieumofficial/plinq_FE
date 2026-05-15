/**
 * AI "Catch me up" card pinned to the bottom of ChatDetails (Figma 1436:34418).
 *
 * Two sections inside one dark-gradient card:
 *   1. Catch me up — short narrative summary (renders **bold** spans for
 *      names / 'AI' picked up from the AI response).
 *   2. Action items — N detected follow-up tasks, each with an optional
 *      project-key chip (APO-205 etc.) and a check button.
 *
 * The card is silent when there are no recent messages — parent decides when
 * to mount it. Loading / error states render in-place so the panel layout
 * doesn't jump.
 */

import Icon from './Icon'
import { useCatchMeUp } from '../../lib/hooks'
import type { CatchMeUpActionItem } from '../../lib/chatSuggest'

type Props = {
  sessionId: string | null | undefined
}

/** Render a string with `**bold**` spans converted to <strong>. Keeps the
 *  AI's emphasis on people / 'AI' visible without us doing NLP on the
 *  client. */
function renderBoldSpans(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <strong key={key++} className="text-white font-bold">
        {m[1]}
      </strong>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function StarIcon() {
  // Small inline glyph for the section headers (matches Figma's "star icon").
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 1L7.5 4.5L11 5L8.5 7.5L9.2 11L6 9.3L2.8 11L3.5 7.5L1 5L4.5 4.5L6 1Z"
        fill="white"
      />
    </svg>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className="bg-white/15 rounded-[5px] w-[22px] h-[22px] inline-flex items-center justify-center">
        <StarIcon />
      </span>
      <span className="text-white text-[12px] font-semibold whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

function ActionItemRow({ item }: { item: CatchMeUpActionItem }) {
  return (
    <div className="bg-white/10 border-[2.6px] border-transparent rounded-[5px] px-[7px] py-[5px] flex items-center gap-[5px] w-full">
      <div className="flex flex-1 min-w-0 items-center gap-[7px]">
        {item.project_key && (
          <span
            className="bg-[#A8C8E8]/10 border border-solid border-[#A8C8E8] rounded-[3px] px-[3px] py-[2px] text-[#A8C8E8] text-[8px] font-semibold whitespace-nowrap shrink-0"
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              letterSpacing: '1px',
            }}
          >
            {item.project_key}
          </span>
        )}
        <span className="text-white text-[10px] font-semibold leading-[1.3] flex-1 min-w-0">
          {item.title}
        </span>
      </div>
      <button
        type="button"
        aria-label="Acknowledge action item"
        className="shrink-0 text-white/80 hover:text-white"
      >
        <Icon name="Add" size={11} className="rotate-45 opacity-0" />
        <svg
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 5.5L4.5 8L9 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default function CatchMeUpCard({ sessionId }: Props) {
  const { data, isLoading: loading, error: queryError } = useCatchMeUp(sessionId)
  const error = queryError ? (queryError as Error).message : null

  // No unread → there's nothing to summarize, but keep the card visible
  // (the user asked for it not to disappear). It just shows a "caught up"
  // state until new unread messages arrive.
  const caughtUp = !!data && data.has_unread === false

  return (
    <div
      className="rounded-[10px] px-[10px] py-[15px] flex flex-col gap-[10px] w-full"
      style={{
        backgroundImage:
          'linear-gradient(160.6deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
    >
      <SectionHeader label="Catch me up" />

      {loading ? (
        <p className="text-[#B5C2CC] text-[10px] leading-[1.5]">
          Reading the recent messages…
        </p>
      ) : error ? (
        <p className="text-[#EB7373] text-[10px] leading-[1.5]">{error}</p>
      ) : caughtUp ? (
        <p className="text-[#B5C2CC] text-[10px] leading-[1.5] w-full">
          You're all caught up — nothing new to summarize.
        </p>
      ) : (
        <p className="text-[#B5C2CC] text-[10px] leading-[1.5] w-full">
          {data?.summary ? renderBoldSpans(data.summary) : 'No recent activity to summarize.'}
        </p>
      )}

      <div className="h-px w-full bg-white/15" />

      <div className="flex items-center justify-between w-full">
        <SectionHeader label="Action items" />
        <span
          className="bg-[#A8C8E8]/10 border border-solid border-[#A8C8E8] rounded-[8px] px-[5px] py-[3px] text-[#A8C8E8] text-[8px] font-medium uppercase whitespace-nowrap"
          style={{ letterSpacing: '1.5px' }}
        >
          {(caughtUp ? 0 : data?.action_items.length ?? 0)} found
        </span>
      </div>

      <p className="text-[#B5C2CC] text-[10px] leading-[1.5] w-full">
        {!caughtUp && data && data.action_items.length > 0
          ? `${data.action_items.length} item${data.action_items.length === 1 ? '' : 's'} detected from the messages.`
          : 'Nothing to act on right now.'}
      </p>

      {!caughtUp && data && data.action_items.length > 0 && (
        <div className="flex flex-col gap-[5px] w-full">
          {data.action_items.map((it, i) => (
            <ActionItemRow key={i} item={it} />
          ))}
        </div>
      )}
    </div>
  )
}
