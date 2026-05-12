/**
 * Chat input composer. White card with three rows:
 *  - Format toolbar (B / I / S / ⟨⟩  |  checklist / link / attach)
 *  - Textarea + scope chips ("AI on · drafts replies", "Org-wide · 108 members")
 *  - Footer (keyboard hints on the left, Schedule + Send on the right)
 *
 * Figma "Frame 1178:16708" — chat composer.
 */

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (next: string) => void
  onSend: () => void
  onSchedule?: () => void
  placeholder?: string
  /** Pill chips shown under the textarea (left side). */
  scopeChips?: ReactNode
  /** Disable the Send button (e.g. while submitting). */
  sending?: boolean
}

// ─── Inline icons (kept here so the component is drop-in self-contained) ────

function IconBold() {
  return (
    <span className="font-bold text-[10px] leading-none text-gray-main">B</span>
  )
}
function IconItalic() {
  return (
    <span
      className="text-[10px] leading-none text-gray-main"
      style={{ fontStyle: 'italic' }}
    >
      I
    </span>
  )
}
function IconStrike() {
  return (
    <span className="text-[10px] leading-none text-gray-main line-through">
      S
    </span>
  )
}
function IconCode() {
  return (
    <span
      className="text-[10px] leading-none text-gray-main"
      style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
    >
      ⟨⟩
    </span>
  )
}
function IconChecklist() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 4 L3 5 L5 3 M2 8 L3 9 L5 7 M2 12 L3 13 L5 11"
        stroke="#6B7B86"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 4 L13 4 M7 8 L13 8 M7 12 L13 12"
        stroke="#6B7B86"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconLink() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M5.5 8.5 A2 2 0 0 1 5.5 5.5 L7.5 3.5 A2 2 0 1 1 10.5 6.5 L9.5 7.5 M8.5 5.5 A2 2 0 0 1 8.5 8.5 L6.5 10.5 A2 2 0 1 1 3.5 7.5 L4.5 6.5"
        stroke="#6B7B86"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconAttach() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M11 5 L5.5 10.5 A2 2 0 1 1 2.7 7.7 L8 2.4 A3 3 0 1 1 12.3 6.7 L7 12"
        stroke="#6B7B86"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconSparkle({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M6 1 L7 5 L11 6 L7 7 L6 11 L5 7 L1 6 L5 5 Z"
        fill="#6B7B86"
      />
    </svg>
  )
}
function IconOrgChart({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="4" y="1" width="4" height="3" rx="0.5" stroke="#6B7B86" strokeWidth="1" />
      <rect x="0.5" y="8" width="3" height="3" rx="0.5" stroke="#6B7B86" strokeWidth="1" />
      <rect x="8.5" y="8" width="3" height="3" rx="0.5" stroke="#6B7B86" strokeWidth="1" />
      <path d="M6 4 L6 6 M2 8 L2 6 L10 6 L10 8" stroke="#6B7B86" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}
function IconSend() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M1 11 L11 6 L1 1 L2 5.5 L8 6 L2 6.5 Z"
        fill="#FFFFFF"
      />
    </svg>
  )
}

// ─── Sub-pieces ─────────────────────────────────────────────────────────────

function ToolButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick?: () => void
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center size-[15px] hover:opacity-70 transition-opacity"
    >
      {children}
    </button>
  )
}

function KbdHint({
  keys,
  label,
}: {
  keys: string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-[5px]">
      <span className="bg-white-white border border-solid border-gray-border-light text-gray-main text-[10px] px-[5px] py-[2px] rounded-[5px] inline-flex items-center justify-center">
        {keys}
      </span>
      <span className="text-gray-main text-[10px]">{label}</span>
    </span>
  )
}

/** Default scope chip used when the page doesn't provide custom chips. */
export function ChatComposerChip({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span className="bg-white-item rounded-[5px] px-[5px] py-[3px] inline-flex items-center gap-[5px]">
      {icon}
      <span className="text-gray-main text-[10px] leading-[1.5] whitespace-nowrap">
        {children}
      </span>
    </span>
  )
}

export const ComposerIcons = {
  Sparkle: IconSparkle,
  OrgChart: IconOrgChart,
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ChatComposer({
  value,
  onChange,
  onSend,
  onSchedule,
  placeholder = 'Message',
  scopeChips,
  sending = false,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea up to ~5 lines
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [value])

  const canSend = !sending && value.trim().length > 0

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore Enter while an IME is composing (e.g. Korean/Japanese/Chinese):
    // the IME uses Enter to commit the composition. If we send during
    // composition, the IME re-injects the committed text afterwards and a
    // second message goes out.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div className="bg-white-white border border-solid border-gray-border-light rounded-[10px] overflow-hidden flex flex-col">
      {/* Format toolbar */}
      <div className="flex items-center gap-[20px] px-[15px] py-[5px]">
        <ToolButton ariaLabel="Bold"><IconBold /></ToolButton>
        <ToolButton ariaLabel="Italic"><IconItalic /></ToolButton>
        <ToolButton ariaLabel="Strikethrough"><IconStrike /></ToolButton>
        <ToolButton ariaLabel="Code"><IconCode /></ToolButton>
        <span className="self-stretch w-px bg-gray-border-light" />
        <div className="flex items-center gap-[10px]">
          <ToolButton ariaLabel="Checklist"><IconChecklist /></ToolButton>
          <ToolButton ariaLabel="Link"><IconLink /></ToolButton>
          <ToolButton ariaLabel="Attach"><IconAttach /></ToolButton>
        </div>
      </div>

      <div className="h-px bg-gray-border-light w-full" />

      {/* Textarea + chips */}
      <div className="flex flex-col gap-[10px] px-[15px] py-[10px]">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none resize-none text-[12px] text-black placeholder:text-gray-secondary leading-[1.5]"
        />
        {scopeChips && (
          <div className="flex items-center gap-[5px] flex-wrap">{scopeChips}</div>
        )}
      </div>

      <div className="h-px bg-gray-border-light w-full" />

      {/* Footer */}
      <div className="flex items-center justify-between px-[15px] py-[8px]">
        <div className="flex items-center gap-[10px]">
          <KbdHint keys="⏎" label="to send" />
          <KbdHint keys="⇧⏎" label="new line" />
        </div>
        <div className="flex items-center gap-[5px]">
          {onSchedule && (
            <button
              type="button"
              onClick={onSchedule}
              className="bg-white-white border border-solid border-gray-border-light text-black text-[10px] rounded-[5px] px-[15px] py-[5px] hover:bg-white-item"
            >
              Schedule
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="bg-primary-dark text-white text-[10px] rounded-[5px] px-[15px] py-[5px] inline-flex items-center gap-[5px] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            <IconSend />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
