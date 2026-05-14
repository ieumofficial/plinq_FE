import { useEffect, type ReactNode } from 'react'
import Icon from './ui/Icon'

type Props = {
  open: boolean
  /** Lowercase category that appears in the red eyebrow / delete button label. */
  type: string
  /** Bold title — e.g. "Delete this project?". */
  title: string
  /** Italicized body line under the title. */
  body: ReactNode
  /** Subject row preview (project label + name + metadata). Caller renders. */
  subject: ReactNode
  /** Bulleted "what happens next" items. The final bold red "This cannot be
   *  undone" line is appended automatically. */
  consequences: ReactNode[]
  /** Optional custom label for the destructive button. Defaults to "Delete {type}". */
  confirmLabel?: string
  submitting?: boolean
  /** When true, the destructive button is rendered gray and is not clickable.
   *  Use this while the backing delete mutation isn't yet permitted/verified. */
  confirmDisabled?: boolean
  /** Hover hint surfaced on the destructive button when disabled. */
  disabledHint?: string
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteConfirmModal({
  open,
  type,
  title,
  body,
  subject,
  consequences,
  confirmLabel,
  submitting = false,
  confirmDisabled = false,
  disabledHint,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[15px] shadow-2xl w-[520px] max-w-[92vw] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start gap-[10px] p-[15px] border-b border-solid border-gray-border-light">
          <div className="bg-red-light flex items-center justify-center rounded-[5px] w-[32px] h-[32px] shrink-0">
            <Icon name="Warning" size={15} className="text-red-main" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
            <p className="text-red-main text-[10px] font-medium uppercase tracking-[1.5px]">
              delete · {type}
            </p>
            <p className="text-black text-[14px] font-semibold leading-none">
              {title}
            </p>
            <p className="text-gray-main text-[10px] leading-[1.3]">{body}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-secondary hover:text-black w-[20px] h-[20px] flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <Icon name="Cross" size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-[10px] p-[15px]">
          <div className="bg-white-item border border-solid border-gray-border-light rounded-[8px] p-[10px] flex items-center justify-between">
            {subject}
          </div>
          <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
            what happens next?
          </p>
          <ul className="list-disc text-[10px] flex flex-col gap-[5px] pl-[15px]">
            {consequences.map((c, i) => (
              <li key={i} className="text-black leading-[1.5]">
                {c}
              </li>
            ))}
            <li className="text-red-main font-semibold leading-[1.5]">
              This cannot be undone
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="bg-white-item border-t border-solid border-gray-border-light rounded-bl-[15px] rounded-br-[15px] flex items-center justify-between px-[20px] py-[15px]">
          <div className="flex items-center gap-[5px]">
            <span className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[5px] py-[2px] text-gray-main text-[10px]">
              esc
            </span>
            <span className="text-gray-main text-[10px]">to cancel</span>
          </div>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[15px] py-[10px] text-black text-[12px] hover:bg-white-item transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting || confirmDisabled}
              title={confirmDisabled ? disabledHint : undefined}
              className={`rounded-[5px] px-[15px] py-[10px] text-[12px] font-semibold transition-opacity ${
                confirmDisabled
                  ? 'bg-gray-light text-white cursor-not-allowed'
                  : 'bg-red-main text-white-main hover:opacity-90 disabled:opacity-60'
              }`}
            >
              {submitting ? 'Deleting…' : confirmLabel ?? `Delete ${type}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
