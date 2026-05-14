import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Icon from './ui/Icon'
import {
  useChatSessions,
  useCurrentUser,
  useMyOrg,
  useUserActionItems,
  useUserProjects,
  useUserUpcomingMeetings,
} from '../lib/hooks'

type Category = 'project' | 'task' | 'meeting' | 'channel'

type Result = {
  category: Category
  id: string
  /** Title shown — may include the search needle. */
  title: string
  /** Two-line breadcrumb beneath the title (e.g. "Apollo > Migration tooling · APO-238"). */
  breadcrumb: string
  /** Project name + color chip, when applicable. */
  projectName: string | null
  projectColor: string | null
  href: string
}

const TAB_ORDER: ('all' | Category)[] = ['all', 'project', 'task', 'meeting', 'channel']

const TAB_LABEL: Record<(typeof TAB_ORDER)[number], string> = {
  all: 'All',
  project: 'Projects',
  task: 'Tasks',
  meeting: 'Meetings',
  channel: 'Channels',
}

const CATEGORY_TYPE_LABEL: Record<Category, string> = {
  project: 'project',
  task: 'task',
  meeting: 'meeting',
  channel: 'message',
}

const CATEGORY_ICON: Record<Category, 'Folder' | 'Task' | 'Calendar' | 'Chat'> = {
  project: 'Folder',
  task: 'Task',
  meeting: 'Calendar',
  channel: 'Chat',
}

/** Pastel pill palette matching the existing FileLabel/Tag tokens elsewhere
 *  in the app (knowledge base categories, project badges). */
const CATEGORY_BADGE_BG: Record<Category, string> = {
  project: 'bg-[#DDE7F4] text-[#2D5A9E]',   // Blue/Light + Blue/Main
  task: 'bg-[#F4E6CD] text-[#B68A48]',      // Brown/Light + Brown/Med
  meeting: 'bg-[#DCEBE0] text-[#2F6B45]',   // Green/Light + Green/Med
  channel: 'bg-[#D6EAEA] text-[#558589]',   // Turquoise/Light + Turquoise/Main
}

/** How many rows of each category to show in the "All" view before the user
 *  filters down to a single tab. */
const PREVIEW_LIMIT = 2

function matches(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false
  return haystack.toLowerCase().includes(needle)
}

/** Splits `text` around the first case-insensitive `needle` so the caller can
 *  bold the matched portion. Returns the original string in `pre` and empty
 *  match/post when nothing matches. */
function highlight(text: string, needle: string): { pre: string; match: string; post: string } {
  if (!needle) return { pre: text, match: '', post: '' }
  const idx = text.toLowerCase().indexOf(needle.toLowerCase())
  if (idx === -1) return { pre: text, match: '', post: '' }
  return {
    pre: text.slice(0, idx),
    match: text.slice(idx, idx + needle.length),
    post: text.slice(idx + needle.length),
  }
}

function HighlightedTitle({ text, needle }: { text: string; needle: string }) {
  const { pre, match, post } = highlight(text, needle)
  return (
    <span className="text-white text-[12px] truncate">
      {pre}
      {match && (
        <span className="bg-[rgba(168,200,232,0.4)] text-[#a8c8e8] font-semibold rounded-[2px] px-[2px]">
          {match}
        </span>
      )}
      {post}
    </span>
  )
}

export default function GlobalSearchDropdown() {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const { data: projects = [] } = useUserProjects(user?.id)
  const { data: tasks = [] } = useUserActionItems(user?.id, { includeDone: true })
  const { data: meetings = [] } = useUserUpcomingMeetings(user?.id)
  const { data: chatSessions = [] } = useChatSessions(user?.id, org?.id)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<(typeof TAB_ORDER)[number]>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reset to "All" tab whenever the user starts typing afresh.
  useEffect(() => {
    if (query.trim().length === 0) setTab('all')
  }, [query])

  const allResults = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const out: Result[] = []

    for (const p of projects) {
      if (matches(p.name, q) || matches(p.description, q)) {
        out.push({
          category: 'project',
          id: p.id,
          title: p.name,
          breadcrumb: org?.name ? `${org.name} > Projects` : 'Projects',
          projectName: p.name,
          projectColor: p.color ?? 'blue',
          href: `/p/${p.id}/dashboard`,
        })
      }
    }

    for (const t of tasks) {
      if (matches(t.title, q) || matches(t.description, q)) {
        const projectPart = t.project_name ?? 'Project'
        out.push({
          category: 'task',
          id: t.id,
          title: t.title,
          breadcrumb: `${projectPart} > Tasks`,
          projectName: t.project_name,
          projectColor: t.project_color,
          href: t.project_id ? `/p/${t.project_id}/backlog` : '/action-items',
        })
      }
    }

    for (const m of meetings) {
      if (matches(m.name, q)) {
        const when = new Date(m.scheduled_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
        const attendeeBit =
          m.attendees.length > 0
            ? ` · ${m.attendees.length} attendee${m.attendees.length === 1 ? '' : 's'}`
            : ''
        out.push({
          category: 'meeting',
          id: m.id,
          title: m.name,
          breadcrumb: `Calendar · ${when}${attendeeBit}`,
          projectName: null,
          projectColor: null,
          href: `/p/${m.project_id}/meetings/${m.id}`,
        })
      }
    }

    for (const s of chatSessions) {
      const channelName = s.name ?? (s.other_user
        ? s.other_user.nickname ||
          `${s.other_user.first_name} ${s.other_user.last_name}`.trim()
        : 'Conversation')
      if (
        matches(channelName, q) ||
        matches(s.description, q) ||
        matches(s.last_message_body, q)
      ) {
        out.push({
          category: 'channel',
          id: s.id,
          title: s.last_message_body ?? channelName,
          breadcrumb: `Messages · #${channelName}`,
          projectName: s.project_name,
          projectColor: null,
          href: `/messages?session=${s.id}`,
        })
      }
    }

    return out
  }, [query, projects, tasks, meetings, chatSessions, org?.name])

  const counts = useMemo(() => {
    const m: Record<'all' | Category, number> = {
      all: allResults.length,
      project: 0,
      task: 0,
      meeting: 0,
      channel: 0,
    }
    for (const r of allResults) m[r.category]++
    return m
  }, [allResults])

  /** Picked according to: first project match > first task > first meeting > first channel. */
  const bestMatch = useMemo<Result | null>(() => {
    const byCat = (c: Category) => allResults.find((r) => r.category === c)
    return (
      byCat('project') ?? byCat('task') ?? byCat('meeting') ?? byCat('channel') ?? null
    )
  }, [allResults])

  const visibleByCategory = useMemo(() => {
    const groups: { category: Category; results: Result[]; total: number }[] = []
    for (const c of ['task', 'meeting', 'channel', 'project'] as Category[]) {
      const arr = allResults.filter((r) => r.category === c && r.id !== bestMatch?.id)
      if (arr.length === 0) continue
      groups.push({
        category: c,
        results: tab === 'all' ? arr.slice(0, PREVIEW_LIMIT) : arr,
        total: arr.length,
      })
    }
    return groups
  }, [allResults, bestMatch, tab])

  const tabbedResults = useMemo(() => {
    if (tab === 'all') return null
    return allResults.filter((r) => r.category === tab)
  }, [allResults, tab])

  const orgScope = org?.name ?? 'workspace'

  const goTo = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="bg-[rgba(255,255,255,0.1)] border border-solid border-gray-main h-[32px] rounded-[8px] flex items-center px-[12px] gap-[6px]">
        <Icon name="Search" size={15} className="text-gray-secondary shrink-0" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          placeholder={`Search ${orgScope}...`}
          className="bg-transparent flex-1 min-w-0 outline-none text-[12px] text-white placeholder:text-gray-secondary"
        />
        {open && query.trim() && (
          <>
            <span className="shrink-0 inline-flex items-center px-[8px] py-[3px] rounded-[6px] bg-[rgba(255,255,255,0.12)] text-[#b5c2cc] text-[11px]">
              {counts.all} result{counts.all === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 inline-flex items-center px-[7px] py-[3px] rounded-[6px] border border-solid border-[#6b7b86] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.12)] text-[#b5c2cc] text-[10px] uppercase tracking-[0.5px] transition-colors"
              aria-label="Close search"
            >
              esc
            </button>
          </>
        )}
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-gray-secondary hover:text-white shrink-0"
            aria-label="Clear search"
          >
            <Icon name="Cross" size={11} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div
          className="absolute top-[40px] right-0 z-50 w-[488px] max-h-[640px] overflow-y-auto border border-solid border-[#6b7b86] rounded-[10px] shadow-[0_18px_40px_rgba(8,16,22,0.5)]"
          style={{
            backgroundImage:
              'linear-gradient(158deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
          }}
        >
          {/* Tabs */}
          <div
            className="sticky top-0 border-b border-solid border-[#6b7b86] flex items-center gap-[15px] px-[15px] py-[12px]"
            style={{
              backgroundImage:
                'linear-gradient(158deg, rgb(46, 67, 78) 0%, rgb(40, 58, 67) 100%)',
            }}
          >
            {TAB_ORDER.map((t) => {
              const active = tab === t
              const n = counts[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`inline-flex items-center gap-[5px] px-[7px] py-[5px] rounded-[5px] text-[10px] transition-colors ${
                    active ? 'bg-[rgba(255,255,255,0.15)]' : 'hover:bg-[rgba(255,255,255,0.08)]'
                  }`}
                >
                  <span className="font-semibold text-[#e6ecef]">{TAB_LABEL[t]}</span>
                  <span className="text-[#94a0aa]">{n}</span>
                </button>
              )
            })}
          </div>

          {/* Empty state */}
          {counts.all === 0 && (
            <p className="px-[15px] py-[20px] text-[#94a0aa] text-[12px]">
              No matches for "{query}".
            </p>
          )}

          {/* "All" tab view — Best match + section previews */}
          {counts.all > 0 && tab === 'all' && (
            <div className="flex flex-col gap-[10px] p-[10px]">
              {bestMatch && (
                <div className="flex flex-col gap-[10px]">
                  <p className="px-[5px] text-[#94a0aa] text-[10px] font-medium uppercase tracking-[1.5px]">
                    Best match
                  </p>
                  <ResultRow result={bestMatch} needle={query} onSelect={goTo} highlight />
                </div>
              )}
              {visibleByCategory.map((g) => (
                <div key={g.category} className="flex flex-col gap-[10px]">
                  <p className="px-[5px] text-[#94a0aa] text-[10px] font-medium uppercase tracking-[1.5px]">
                    {TAB_LABEL[g.category].toLowerCase()} · {g.total}
                  </p>
                  <div className="flex flex-col gap-[3px]">
                    {g.results.map((r) => (
                      <ResultRow key={`${r.category}-${r.id}`} result={r} needle={query} onSelect={goTo} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Single-tab filtered view */}
          {counts.all > 0 && tab !== 'all' && tabbedResults && (
            <div className="flex flex-col gap-[3px] p-[10px]">
              {tabbedResults.length === 0 ? (
                <p className="px-[5px] py-[10px] text-[#94a0aa] text-[12px]">
                  No {TAB_LABEL[tab].toLowerCase()} match "{query}".
                </p>
              ) : (
                tabbedResults.map((r) => (
                  <ResultRow key={`${r.category}-${r.id}`} result={r} needle={query} onSelect={goTo} />
                ))
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

function ResultRow({
  result,
  needle,
  onSelect,
  highlight: showAccent = false,
}: {
  result: Result
  needle: string
  onSelect: (href: string) => void
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result.href)}
      className={`group text-left w-full px-[15px] py-[10px] rounded-[8px] hover:bg-[rgba(255,255,255,0.1)] transition-colors flex items-center gap-[10px] min-w-0 ${
        showAccent ? 'bg-[rgba(255,255,255,0.08)]' : ''
      }`}
    >
      <span
        className={`shrink-0 w-[28px] h-[28px] rounded-[5px] inline-flex items-center justify-center ${CATEGORY_BADGE_BG[result.category]}`}
        aria-hidden
      >
        <Icon name={CATEGORY_ICON[result.category]} size={14} />
      </span>
      <span className="flex flex-col min-w-0 flex-1 gap-[3px]">
        <span className="flex items-center gap-[5px] min-w-0">
          {/* Project chip only adds context when it points to a different
           *  parent than the title itself — otherwise the same name appears
           *  twice (chip + title). */}
          {result.projectName && result.category !== 'project' && (
            <span className="shrink-0 inline-flex items-center px-[3px] py-px rounded-[2px] bg-[rgba(168,200,232,0.4)] text-[#a8c8e8] text-[10px] font-semibold leading-none">
              {result.projectName}
            </span>
          )}
          <HighlightedTitle text={result.title} needle={needle} />
        </span>
        <span className="flex items-center gap-[7px] min-w-0">
          <span
            className="shrink-0 inline-flex items-center px-[3px] py-px rounded-[2px] bg-[rgba(230,236,239,0.3)] text-white text-[8px] uppercase tracking-[0.5px] leading-none"
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {CATEGORY_TYPE_LABEL[result.category]}
          </span>
          <span className="flex items-center gap-[3px] min-w-0">
            <Icon
              name={CATEGORY_ICON[result.category]}
              size={11}
              className="text-[#b5c2cc] shrink-0"
            />
            <span className="text-[#b5c2cc] text-[10px] tracking-[0.3px] truncate">
              {result.breadcrumb}
            </span>
          </span>
        </span>
      </span>
      <span
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-[5px] px-[5px] py-[2px] rounded-[2px] bg-[#e6ecef] text-[#455e6a] text-[10px]"
        aria-hidden
      >
        <ShareArrowGlyph />
        Open
      </span>
    </button>
  )
}

/** Inline ↪ glyph used in the row "Open" affordance. Kept inline rather than
 *  added to the Icon registry because it's only used here. */
function ShareArrowGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M2.2 9 C2.2 5.6 4.4 4.2 7.6 4.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M5.6 2 L8.2 4.2 L5.6 6.4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
