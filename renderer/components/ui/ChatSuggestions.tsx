/**
 * Composer-attached strip of AI-suggested replies.
 *
 * Layout (Figma 1436:33098): a small top row with a `★ SUGGESTED REPLIES`
 * chip + hint on the left and a "Dismiss" link on the right, followed by
 * up to 3 `ChatSuggestionItem` cards in a horizontal flex row above the
 * existing `ChatComposer`.
 *
 * Owns no fetch state of its own — the parent passes in suggestions and
 * loading flag. Empty arrays render nothing (the parent uses that to hide
 * the panel without unmounting the composer).
 */
import Icon from './Icon'
import ChatSuggestionItem from './ChatSuggestionItem'
import type { ChatSuggestion } from '../../lib/chatSuggest'

type Props = {
  suggestions: ChatSuggestion[]
  loading?: boolean
  onEdit: (s: ChatSuggestion) => void
  onSend: (s: ChatSuggestion) => Promise<void> | void
  onDismiss: () => void
  /** Index currently being sent — that one card shows "Sending…" while
   *  the others stay disabled. */
  sendingIndex?: number | null
}

export default function ChatSuggestions({
  suggestions,
  loading = false,
  onEdit,
  onSend,
  onDismiss,
  sendingIndex = null,
}: Props) {
  if (!loading && suggestions.length === 0) return null
  return (
    <div className="border-t border-solid border-gray-border-light pt-[10px] flex flex-col gap-[5px] w-full">
      {/* Header: chip + hint  +  Dismiss */}
      <div className="flex items-center justify-between w-full">
        <div className="flex gap-[5px] items-center">
          <span className="bg-primary-dark rounded-[10px] px-[7px] py-[3px] inline-flex items-center gap-[5px]">
            <Icon name="Sparkle" size={12} className="text-white" />
            <span className="text-white text-[10px] uppercase tracking-[0.5px] leading-[1.5] whitespace-nowrap">
              Suggested replies
            </span>
          </span>
          <span className="text-gray-main text-[10px] whitespace-nowrap">
            {loading
              ? 'Drafting reply candidates…'
              : 'Pick one to edit, or send as-is'}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          disabled={sendingIndex !== null}
          className="text-black text-[12px] hover:opacity-70 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>

      {/* Cards row — fixed 3 slots; while loading we show 3 skeletons so
          the composer doesn't jump in height. */}
      <div className="flex gap-[10px] items-stretch w-full">
        {loading && suggestions.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white-item border border-solid border-[#D4DAE0] rounded-[10px] p-[15px] flex-1 min-w-0 animate-pulse"
                style={{ minHeight: 129 }}
              />
            ))
          : suggestions.map((s, i) => (
              <ChatSuggestionItem
                key={`${s.label}-${i}`}
                label={s.label}
                body={s.body}
                onEdit={() => onEdit(s)}
                onSend={() => onSend(s)}
                sending={sendingIndex === i}
              />
            ))}
      </div>
    </div>
  )
}
