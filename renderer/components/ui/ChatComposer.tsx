/**
 * Chat input composer. White card with three rows:
 *  - Format toolbar (B / I / S / ⟨⟩  |  checklist / link / attach)
 *  - Textarea + scope chips ("AI on · drafts replies", "Org-wide · 108 members")
 *  - Footer (keyboard hints on the left, Schedule + Send on the right)
 *
 * Figma "Frame 1178:16708" — chat composer.
 */

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

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
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const k = e.key.toLowerCase()
      if (k === 'b') {
        e.preventDefault()
        wrapSelection('**', '**')
      } else if (k === 'i') {
        e.preventDefault()
        wrapSelection('*', '*')
      } else if (k === 'e') {
        e.preventDefault()
        wrapSelection('`', '`')
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault()
      wrapSelection('~~', '~~')
    }
  }

  /** Wrap the textarea's current selection (or cursor) with markdown markers. */
  function wrapSelection(prefix: string, suffix: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = value.slice(0, start)
    const selected = value.slice(start, end)
    const after = value.slice(end)
    const next = `${before}${prefix}${selected}${suffix}${after}`
    onChange(next)
    // Restore selection in the next tick so React re-renders the value first.
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      if (selected.length === 0) {
        // No selection: place cursor between the markers.
        const pos = start + prefix.length
        node.setSelectionRange(pos, pos)
      } else {
        // Select the wrapped text so further actions stack predictably.
        node.setSelectionRange(start + prefix.length, end + prefix.length)
      }
    })
  }

  /** Prefix the current line with "- " (toggle on/off if already a list item). */
  function insertList() {
    const el = ref.current
    if (!el) return
    const pos = el.selectionStart
    // Find the start of the current line.
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1
    const lineEnd = (() => {
      const i = value.indexOf('\n', pos)
      return i === -1 ? value.length : i
    })()
    const line = value.slice(lineStart, lineEnd)
    let nextLine: string
    let deltaCursor = 0
    if (/^- /.test(line)) {
      // Toggle off — strip "- "
      nextLine = line.replace(/^- /, '')
      deltaCursor = -2
    } else {
      // Toggle on — add "- "
      nextLine = `- ${line}`
      deltaCursor = 2
    }
    const next = value.slice(0, lineStart) + nextLine + value.slice(lineEnd)
    onChange(next)
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      const newPos = pos + deltaCursor
      node.setSelectionRange(newPos, newPos)
    })
  }

  /** Inline link-insertion popover state. Remembers the textarea selection so
   * that focus changes (clicking the URL input) don't lose the insertion point. */
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkAnchor = useRef<{ start: number; end: number; selected: string }>({
    start: 0,
    end: 0,
    selected: '',
  })

  function openLinkPopover() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    linkAnchor.current = { start, end, selected: value.slice(start, end) }
    setLinkUrl('https://')
    setLinkOpen(true)
  }

  function applyLink() {
    const url = linkUrl.trim()
    if (!url || url === 'https://') {
      setLinkOpen(false)
      return
    }
    const { start, end, selected } = linkAnchor.current
    const text = selected || 'link'
    const insert = `[${text}](${url})`
    const next = value.slice(0, start) + insert + value.slice(end)
    onChange(next)
    setLinkOpen(false)
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      const pos = start + insert.length
      node.setSelectionRange(pos, pos)
    })
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Open the OS file picker and insert "📎 filename (XX KB)" at the cursor. */
  function pickFile() {
    fileInputRef.current?.click()
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    const sizeKb = Math.max(1, Math.round(file.size / 1024))
    const tag = `📎 ${file.name} (${sizeKb} KB)`
    const el = ref.current
    if (!el) {
      onChange(value + tag)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = value.slice(0, start) + tag + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      const pos = start + tag.length
      node.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="bg-white-white border border-solid border-gray-border-light rounded-[10px] overflow-hidden flex flex-col">
      {/* Format toolbar */}
      <div className="flex items-center gap-[20px] px-[15px] py-[5px]">
        <ToolButton ariaLabel="Bold (Ctrl+B)" onClick={() => wrapSelection('**', '**')}>
          <IconBold />
        </ToolButton>
        <ToolButton ariaLabel="Italic (Ctrl+I)" onClick={() => wrapSelection('*', '*')}>
          <IconItalic />
        </ToolButton>
        <ToolButton ariaLabel="Strikethrough (Ctrl+Shift+X)" onClick={() => wrapSelection('~~', '~~')}>
          <IconStrike />
        </ToolButton>
        <ToolButton ariaLabel="Code (Ctrl+E)" onClick={() => wrapSelection('`', '`')}>
          <IconCode />
        </ToolButton>
        <span className="self-stretch w-px bg-gray-border-light" />
        <div className="flex items-center gap-[10px]">
          <ToolButton ariaLabel="List" onClick={insertList}>
            <IconChecklist />
          </ToolButton>
          <ToolButton ariaLabel="Link" onClick={openLinkPopover}>
            <IconLink />
          </ToolButton>
          <ToolButton ariaLabel="Attach" onClick={pickFile}>
            <IconAttach />
          </ToolButton>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFile}
            className="hidden"
            aria-hidden
          />
        </div>
      </div>

      {linkOpen && (
        <div className="flex items-center gap-[5px] px-[15px] py-[5px] border-t border-solid border-gray-border-light bg-white-item">
          <input
            type="url"
            value={linkUrl}
            autoFocus
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setLinkOpen(false)
              }
            }}
            placeholder="https://"
            className="flex-1 bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[4px] text-[12px] outline-none focus:border-primary-main"
          />
          <button
            type="button"
            onClick={applyLink}
            className="bg-primary-dark text-white text-[10px] rounded-[5px] px-[10px] py-[5px] hover:opacity-90"
          >
            Insert
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="text-gray-main text-[10px] px-[8px] py-[5px] hover:bg-white-white rounded-[5px]"
          >
            Cancel
          </button>
        </div>
      )}

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
