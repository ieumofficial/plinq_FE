/**
 * Single AI-suggested chat reply card. Three of these stack horizontally
 * inside `ChatSuggestions`. Figma: 1436:32886 — small label tag, body, and
 * two buttons (Edit fills the composer, Send as-is dispatches immediately).
 */

type Props = {
  /** Short uppercase tag — the AI's tone/intent label (e.g. "short"). */
  label: string
  /** The reply body the user can send or edit. */
  body: string
  onEdit: () => void
  onSend: () => void
  /** While Send is in flight, both buttons are disabled. */
  sending?: boolean
}

function PaperPlane() {
  return (
    <svg
      width="9"
      height="9.6"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M0.5 5L9.5 1L7.5 9L5 6L0.5 5Z"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function ChatSuggestionItem({
  label,
  body,
  onEdit,
  onSend,
  sending = false,
}: Props) {
  return (
    <div
      className="bg-white-white border border-solid border-[#D4DAE0] rounded-[10px] p-[15px] flex flex-col justify-between gap-[10px] flex-1 min-w-0"
      style={{ minHeight: 129 }}
    >
      <div className="flex flex-col gap-[10px] pb-[10px] min-w-0">
        <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] whitespace-nowrap">
          {label}
        </p>
        <p className="text-black text-[12px] leading-[1.3] break-words whitespace-pre-wrap">
          {body}
        </p>
      </div>
      <div className="flex gap-[5px] shrink-0">
        <button
          type="button"
          onClick={onEdit}
          disabled={sending}
          className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[15px] py-[5px] text-black text-[10px] hover:bg-white-item disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          className="bg-primary-dark text-white rounded-[5px] px-[15px] py-[5px] text-[10px] inline-flex items-center gap-[5px] hover:bg-primary-deep disabled:opacity-60"
        >
          <PaperPlane />
          {sending ? 'Sending…' : 'Send as-is'}
        </button>
      </div>
    </div>
  )
}
