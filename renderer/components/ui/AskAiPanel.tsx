import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aiStream } from '../../lib/aiClient'
import { renderMarkdown } from '../../lib/markdown'
import {
  useAgentConversations,
  useAgentMessages,
  useDeleteAgentConversation,
  type AgentConversation,
} from '../../lib/hooks'
import { queryKeys } from '../../lib/queryKeys'
import {
  clearActiveConversationId,
  getActiveConversationId,
  setActiveConversationId,
} from '../../lib/conversationStore'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Local hh:mm timestamp shown next to author label. */
  time: string
  /** Assistant only — true while chunks are still streaming in. */
  streaming?: boolean
  /** Assistant only — server message_id once persisted (for future actions). */
  serverId?: string
  error?: string | null
}

type Props = {
  /** Close (✕) — parent toggles the panel mount. */
  onClose: () => void
  /**
   * Personal Agent: omit `projectId`, the server picks the user's single org
   * unless `orgId` is also given. Project Agent: pass `projectId` and the
   * server uses that project's org automatically.
   */
  orgId?: string
  projectId?: string
  /** Shown in the subtitle ("About this session · {label}"). */
  scopeLabel?: string
}

type View = 'chat' | 'sessions'

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function newId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function AskAiPanel({
  onClose,
  orgId,
  projectId,
  scopeLabel,
}: Props) {
  const scope = useMemo(
    () => ({ orgId: orgId ?? null, projectId: projectId ?? null }),
    [orgId, projectId],
  )

  const qc = useQueryClient()
  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [restored, setRestored] = useState(false) // tracked to avoid re-hydrating once user starts typing
  const [sending, setSending] = useState(false)
  const [composing, setComposing] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Restoration: localStorage → DB fallback ─────────────────────
  // Step 1: read localStorage on scope change.
  useEffect(() => {
    setRestored(false)
    setMessages([])
    const saved = getActiveConversationId(scope)
    setConversationId(saved)
  }, [scope])

  // Step 2: if localStorage was empty, ask the server for the most recent
  // conversation in this scope. Only runs while we don't have an id yet.
  const convListEnabledForFallback = !conversationId && !restored
  const convListQuery = useAgentConversations({
    orgId: scope.orgId,
    projectId: scope.projectId,
    enabled: convListEnabledForFallback || view === 'sessions',
  })
  useEffect(() => {
    if (conversationId) return
    if (restored) return
    if (!convListQuery.data) return
    const first = convListQuery.data[0]
    if (first) {
      setConversationId(first.id)
    } else {
      // No prior conversation anywhere — start fresh.
      setRestored(true)
    }
  }, [conversationId, restored, convListQuery.data])

  // Step 3: hydrate messages from DB once we have a conversation id.
  const messagesQuery = useAgentMessages(conversationId)
  useEffect(() => {
    if (!conversationId) return
    if (restored) return
    const data = messagesQuery.data
    if (!data) return
    setMessages(
      data.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          time: isoToHHMM(m.created_at),
        })),
    )
    setRestored(true)
  }, [conversationId, messagesQuery.data, restored])

  // Persist active conversation id whenever it changes.
  useEffect(() => {
    if (conversationId) setActiveConversationId(scope, conversationId)
  }, [conversationId, scope])

  // Autoscroll on new messages / chunks.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  function startNewChat() {
    clearActiveConversationId(scope)
    setConversationId(null)
    setMessages([])
    setRestored(true) // don't auto-fallback to most recent
    setView('chat')
  }

  function openConversation(id: string) {
    setConversationId(id)
    setMessages([])
    setRestored(false) // trigger hydrate from DB
    setView('chat')
  }

  async function send(): Promise<void> {
    const body = draft.trim()
    if (!body || sending) return

    const userMsg: Message = {
      id: newId(),
      role: 'user',
      content: body,
      time: nowHHMM(),
    }
    const assistantMsg: Message = {
      id: newId(),
      role: 'assistant',
      content: '',
      time: nowHHMM(),
      streaming: true,
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setDraft('')
    setSending(true)
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })

    try {
      await aiStream(
        '/agent/chat',
        {
          message: body,
          conversation_id: conversationId,
          org_id: conversationId ? null : orgId ?? null,
          project_id: projectId ?? null,
        },
        (evt) => {
          const t = evt.type
          if (t === 'meta' && evt.is_new && typeof evt.conversation_id === 'string') {
            setConversationId(evt.conversation_id)
            // The new session needs to show up the next time the user opens
            // the sessions list — invalidate now so it's already in the cache.
            qc.invalidateQueries({ queryKey: queryKeys.agentChats.all })
          } else if (t === 'chunk' && typeof evt.text === 'string') {
            const text = evt.text as string
            setMessages((prev) => {
              const out = [...prev]
              const last = out[out.length - 1]
              if (last && last.role === 'assistant') {
                out[out.length - 1] = { ...last, content: last.content + text }
              }
              return out
            })
          } else if (t === 'done') {
            setMessages((prev) => {
              const out = [...prev]
              const last = out[out.length - 1]
              if (last && last.role === 'assistant') {
                out[out.length - 1] = {
                  ...last,
                  streaming: false,
                  serverId:
                    typeof evt.message_id === 'string' ? evt.message_id : last.serverId,
                }
              }
              return out
            })
          } else if (t === 'error') {
            const msg = typeof evt.message === 'string' ? evt.message : 'unknown error'
            setMessages((prev) => {
              const out = [...prev]
              const last = out[out.length - 1]
              if (last && last.role === 'assistant') {
                out[out.length - 1] = { ...last, streaming: false, error: msg }
              }
              return out
            })
          }
        },
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages((prev) => {
        const out = [...prev]
        const last = out[out.length - 1]
        if (last && last.role === 'assistant') {
          out[out.length - 1] = { ...last, streaming: false, error: msg }
        }
        return out
      })
    } finally {
      setSending(false)
      // The new conversation appears in the sessions list — refresh next open.
      // (TanStack invalidation happens via mutation; here we just re-fetch on view switch.)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (composing || e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setDraft(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(120, ta.scrollHeight)}px`
  }

  const todayLabel = (() => {
    const d = new Date()
    const month = d.toLocaleString('en', { month: 'short' }).toLowerCase()
    return `today  ·  ${month} ${d.getDate()}`
  })()

  return (
    <aside
      className="flex h-full w-[265px] shrink-0 flex-col justify-between border-l border-gray-border-light text-white"
      style={{
        backgroundImage:
          'linear-gradient(139.48deg, #2E434E 0%, #1F2F38 100%)',
      }}
      data-node-id="1373:14052"
    >
      {view === 'sessions' ? (
        <SessionsView
          conversations={convListQuery.data ?? []}
          loading={convListQuery.isLoading}
          activeId={conversationId}
          onClose={onClose}
          onBack={() => setView('chat')}
          onNew={startNewChat}
          onPick={openConversation}
          onDeletedActive={() => {
            // The conversation we were viewing was just deleted — reset so the
            // next message starts a fresh session instead of POSTing to a 404.
            clearActiveConversationId(scope)
            setConversationId(null)
            setMessages([])
            setRestored(true)
          }}
        />
      ) : (
        <>
          {/* ── Top: header + context chips ─────────────────────────── */}
          <div className="flex flex-col gap-[10px]">
            <div className="flex flex-col gap-[10px] border-b border-primary-main p-[15px]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-[5px]">
                  <button
                    type="button"
                    onClick={() => setView('sessions')}
                    aria-label="Open sessions"
                    className="flex size-[28px] items-center justify-center rounded-[5px] bg-white/15 hover:bg-white/25"
                  >
                    <SessionsIcon size={14} />
                  </button>
                  <div className="flex w-[120px] flex-col">
                    <p className="text-[14px] font-semibold leading-none text-white">Ask AI</p>
                    <p className="text-[10px] leading-[1.5] text-gray-secondary">
                      About this session{scopeLabel ? ` · ${scopeLabel}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-[5px]">
                  <button
                    type="button"
                    onClick={startNewChat}
                    aria-label="New chat"
                    title="New chat"
                    className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
                  >
                    <PlusIcon size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Ask AI"
                    className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-[5px]">
                {scopeLabel && <ContextChip label={scopeLabel} dot />}
                <ContextChip label="+ Add Context" dashed />
              </div>
            </div>
          </div>

          {/* ── Body: messages ──────────────────────────────────────── */}
          <div ref={scrollRef} className="flex flex-1 flex-col gap-[20px] overflow-y-auto px-[15px] py-[10px]">
            <DateDivider label={todayLabel} />

            {messages.length === 0 && !messagesQuery.isLoading && (
              <p className="px-[15px] text-center text-[10px] italic text-gray-secondary">
                Ask anything about this {scopeLabel ?? 'workspace'} — meetings, tasks,
                decisions, or plain reasoning. I can also propose tasks/meetings for
                you to review.
              </p>
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <UserBubble key={m.id} content={m.content} time={m.time} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  content={m.content}
                  time={m.time}
                  streaming={m.streaming}
                  error={m.error ?? null}
                />
              ),
            )}
          </div>

          {/* ── Composer ────────────────────────────────────────────── */}
          <div className="border-t border-primary-main px-[15px] py-[10px]">
            <div className="overflow-clip rounded-[10px] p-px">
              <div className="flex flex-col gap-[10px] rounded-[10px] border border-gray-main bg-white/10 p-[10px]">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={onInput}
                  onKeyDown={onKeyDown}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
                  rows={1}
                  placeholder={`Ask anything about ${scopeLabel ?? 'this session'}...`}
                  disabled={sending}
                  className="min-h-[20px] w-full resize-none bg-transparent text-[10px] leading-normal text-white placeholder:text-gray-secondary focus:outline-none disabled:opacity-60"
                />
                <div className="flex items-center justify-end gap-[10px]">
                  <span className="text-[10px] text-gray-secondary">⏎ to send</span>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={sending || !draft.trim()}
                    className="flex h-[25px] items-center justify-center gap-[5px] rounded-[5px] bg-white pl-[7px] pr-[10px] text-[10px] font-semibold text-primary-main disabled:opacity-50"
                  >
                    <SendIcon size={11} />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

// ─── Sessions list view ──────────────────────────────────────────

function SessionsView({
  conversations,
  loading,
  activeId,
  onClose,
  onBack,
  onNew,
  onPick,
  onDeletedActive,
}: {
  conversations: AgentConversation[]
  loading: boolean
  activeId: string | null
  onClose: () => void
  onBack: () => void
  onNew: () => void
  onPick: (id: string) => void
  onDeletedActive: () => void
}) {
  const grouped = useMemo(() => groupByDay(conversations), [conversations])
  const deleteConv = useDeleteAgentConversation()

  return (
    <>
      <div className="flex items-center justify-between border-b border-primary-main p-[15px]">
        <div className="flex items-center gap-[5px]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chat"
            className="flex size-[28px] items-center justify-center rounded-[5px] bg-white/15 hover:bg-white/25"
          >
            <BackIcon size={12} />
          </button>
          <p className="text-[14px] font-semibold leading-none text-white">Sessions</p>
        </div>
        <div className="flex items-center gap-[5px]">
          <button
            type="button"
            onClick={onNew}
            aria-label="New chat"
            title="New chat"
            className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
          >
            <PlusIcon size={11} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Ask AI"
            className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
          >
            <CloseIcon size={11} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[15px] overflow-y-auto px-[10px] py-[12px]">
        {loading && (
          <p className="px-[10px] text-[10px] italic text-gray-secondary">Loading…</p>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-[10px] text-[10px] italic text-gray-secondary">
            No prior sessions yet. Start a new chat below.
          </p>
        )}
        {grouped.map((g) => (
          <div key={g.label} className="flex flex-col gap-[3px]">
            <p className="px-[10px] text-[8px] uppercase tracking-[1.5px] text-gray-main">
              {g.label}
            </p>
            {g.items.map((c) => (
              <SessionRow
                key={c.id}
                convo={c}
                active={c.id === activeId}
                onPick={() => onPick(c.id)}
                onDelete={() => {
                  if (!window.confirm('Delete this conversation?')) return
                  const wasActive = c.id === activeId
                  deleteConv.mutate(c.id, {
                    onSuccess: () => {
                      if (wasActive) onDeletedActive()
                    },
                  })
                }}
                deleting={deleteConv.isPending}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function SessionRow({
  convo,
  active,
  onPick,
  onDelete,
  deleting,
}: {
  convo: AgentConversation
  active: boolean
  onPick: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const title = convo.title?.trim() || 'Untitled'
  return (
    <div
      className={`group flex items-center gap-[5px] rounded-[5px] px-[10px] py-[7px] ${
        active ? 'bg-white/15' : 'hover:bg-white/10'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        className="flex flex-1 flex-col items-start gap-[2px] truncate text-left"
      >
        <p
          className={`w-full truncate text-[11px] ${
            active ? 'font-semibold text-white' : 'text-primary-light'
          }`}
        >
          {title}
        </p>
        <p className="text-[9px] text-gray-main">{relTime(convo.created_at)}</p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label="Delete session"
        className="flex size-[20px] shrink-0 items-center justify-center rounded-[4px] text-gray-light opacity-0 transition-opacity hover:bg-white/15 hover:text-white group-hover:opacity-100 disabled:opacity-50"
      >
        <TrashIcon size={11} />
      </button>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function ContextChip({
  label,
  dot,
  dashed,
}: {
  label: string
  dot?: boolean
  dashed?: boolean
}) {
  return (
    <span
      className={`flex items-center gap-[6px] rounded-[15px] border ${
        dashed
          ? 'border-dashed border-primary-main text-gray-light'
          : 'border-primary-main bg-white/10 text-primary-light'
      } px-[10px] py-[3px] text-[10px]`}
    >
      {dot && <span className="size-[5px] rounded-full bg-blue-med" />}
      {label}
    </span>
  )
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-[6px] px-[10px]">
      <div className="h-px flex-1 bg-primary-main/60" />
      <span className="whitespace-pre text-[8px] uppercase tracking-[1.5px] text-gray-main">
        {label}
      </span>
      <div className="h-px flex-1 bg-primary-main/60" />
    </div>
  )
}

function UserBubble({ content, time }: { content: string; time: string }) {
  return (
    <div className="flex flex-col items-end gap-[5px] pl-[15px]">
      <div className="flex items-center gap-[4px] text-[8px]">
        <span className="font-semibold text-white">YOU</span>
        <span className="font-mono text-primary-main">· {time}</span>
      </div>
      <div className="rounded-[10px] rounded-tr-[3px] border border-gray-main bg-white/15 px-[10px] py-[5px] text-[10px] leading-[1.5] text-white">
        {content}
      </div>
    </div>
  )
}

function AssistantBubble({
  content,
  time,
  streaming,
  error,
}: {
  content: string
  time: string
  streaming?: boolean
  error: string | null
}) {
  const showGenerating = streaming && content.length === 0 && !error
  return (
    <div className="flex flex-col items-start gap-[5px] pr-[15px]">
      <div className="flex items-center gap-[4px] text-[8px]">
        <div className="flex size-[15px] items-center justify-center rounded-[3px] bg-white/15">
          <SparkleIcon size={8} />
        </div>
        <span className="font-semibold text-white-main">plinq AI</span>
        <span className="font-mono text-primary-main">· {time}</span>
      </div>

      {showGenerating ? (
        <GeneratingAnimation />
      ) : (
        <div
          className="prose-invert w-full rounded-[10px] rounded-tl-[3px] border border-gray-main bg-white/15 px-[10px] py-[5px] text-[10px] leading-[1.5] text-white [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_li]:ml-4 [&_ol]:list-decimal [&_strong]:font-semibold [&_table]:border [&_table]:border-collapse [&_td]:border [&_td]:border-white/20 [&_td]:px-1 [&_td]:py-0.5 [&_th]:border [&_th]:border-white/20 [&_th]:bg-white/10 [&_th]:px-1 [&_th]:py-0.5 [&_ul]:list-disc"
          dangerouslySetInnerHTML={
            streaming
              ? { __html: escapeForStreaming(content) }
              : { __html: renderMarkdown(content) }
          }
        />
      )}

      {error && (
        <p className="rounded-[6px] border border-red-med/60 bg-red-med/15 px-[8px] py-[5px] text-[10px] text-red-light">
          {error}
        </p>
      )}
    </div>
  )
}

function escapeForStreaming(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function GeneratingAnimation() {
  return (
    <div className="flex items-center gap-[5px]">
      <div className="grid size-[20px] grid-cols-2 grid-rows-2 gap-[1px]">
        <div className="size-[9px] animate-pulse rounded-[2px] bg-gray-light" />
        <div className="size-[9px] animate-pulse rounded-full bg-blue-med [animation-delay:120ms]" />
        <div className="size-[9px] animate-pulse rounded-[2px] bg-blue-med [animation-delay:240ms]" />
        <div className="size-[9px] animate-pulse rounded-[2px] bg-gray-main [animation-delay:360ms]" />
      </div>
      <p className="text-[10px] leading-[1.5] text-gray-light">Generating a response...</p>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function groupByDay(
  conversations: AgentConversation[],
): { label: string; items: AgentConversation[] }[] {
  const todayStart = startOfDay(new Date())
  const dayMs = 86400000
  const groups: Record<string, AgentConversation[]> = {}
  const order: string[] = []
  for (const c of conversations) {
    const d = new Date(c.created_at)
    const ds = startOfDay(d)
    let label: string
    if (ds === todayStart) label = 'Today'
    else if (ds === todayStart - dayMs) label = 'Yesterday'
    else if (ds > todayStart - 7 * dayMs) label = 'Earlier this week'
    else label = d.toLocaleDateString('en', { month: 'short', year: 'numeric' })
    if (!(label in groups)) {
      groups[label] = []
      order.push(label)
    }
    groups[label].push(c)
  }
  return order.map((label) => ({ label, items: groups[label] }))
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })
}

// ─── Icons (inline SVG so we don't need extra files) ────────────

function SparkleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path
        d="M6 0L7.2 4.8L12 6L7.2 7.2L6 12L4.8 7.2L0 6L4.8 4.8L6 0Z"
        fill="white"
      />
    </svg>
  )
}

function CloseIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 2 L10 10 M10 2 L2 10" />
    </svg>
  )
}

function SendIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <path d="M11 1 L1 5 L5 6.5 L6.5 10.5 L11 1Z" />
    </svg>
  )
}

function SessionsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3 4 H11 M3 7 H11 M3 10 H8" />
    </svg>
  )
}

function PlusIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 2 V10 M2 6 H10" />
    </svg>
  )
}

function BackIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 2 L3.5 6 L7.5 10" />
    </svg>
  )
}

function TrashIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5 H9.5 M4 3.5 V2 H8 V3.5 M3.5 3.5 L4 10 H8 L8.5 3.5" />
    </svg>
  )
}
