import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'
import FileLabel, { type FileCategory } from '../../../components/ui/FileLabel'
import UserGroup from '../../../components/ui/UserGroup'
import FilterChecklist from '../../../components/ui/FilterChecklist'
import NewDocModal from '../../../components/NewDocModal'
import DeleteConfirmModal from '../../../components/DeleteConfirmModal'
import {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import {
  useCurrentUser,
  useDeleteKnowledgeDoc,
  useProject,
  useProjectDocs,
  useProjectMembersWithRoles,
} from '../../../lib/hooks'
import { usePinnedDocs } from '../../../lib/pinPref'
import { userToMember } from '../../../lib/types'
import { resolveProjectColor } from '../../../lib/projectColors'
import type { ProjectDoc } from '../../../lib/queries'

const COLS: Column[] = [
  { key: 'title', label: 'Title', width: 'flex-[2]' },
  { key: 'type', label: 'Type', width: 'w-[120px]' },
  { key: 'tag', label: 'Tag', width: 'w-[160px]' },
  { key: 'size', label: 'Size', width: 'w-[70px]', className: 'ml-[20px]' },
  { key: 'edited', label: 'Edited', width: 'w-[140px]' },
  { key: 'more', label: '', width: 'w-[40px]' },
]

const SOURCE_TO_CATEGORY: Record<ProjectDoc['source'], FileCategory> = {
  uploaded: 'project-context',
  meeting: 'decisions',
  auto_generated: 'references',
}

const TAG_OPTIONS: {
  key: ProjectDoc['source']
  label: string
  color: string
}[] = [
  { key: 'uploaded', label: 'Project context', color: '#5B7FB6' },
  { key: 'meeting', label: 'Decisions', color: '#B68A48' },
  { key: 'auto_generated', label: 'References', color: '#588F6E' },
]

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

function PinnedCard({ doc }: { doc: ProjectDoc }) {
  const cat = SOURCE_TO_CATEGORY[doc.source]
  return (
    <article className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex-1 flex flex-col gap-[15px] min-w-0">
      <div className="flex items-center gap-[10px]">
        <FileLabel variant="icon" category={cat} size="lg" />
        <div className="flex flex-col min-w-0">
          <p className="text-black text-[14px] font-semibold truncate">{doc.name}</p>
          <p className="text-gray-secondary text-[10px]">
            {doc.file_type ?? 'Doc'}
          </p>
        </div>
      </div>
      <div className="h-px bg-gray-border-light w-full" />
      <div className="flex items-center justify-between gap-2">
        <FileLabel variant="text" category={cat} />
        {doc.uploader && (
          <span className="flex items-center gap-[6px]">
            <UserGroup members={[userToMember(doc.uploader)]} size={20} />
            <span className="text-gray-secondary text-[10px]">
              {relativeDate(doc.uploaded_at)}
            </span>
          </span>
        )}
      </div>
    </article>
  )
}

export default function KnowledgePage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  if (!projectId) return null
  return (
    <>
      <Head>
        <title>plinq · Knowledge Base</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="knowledge">
        <KnowledgeBody projectId={projectId} />
      </ProjectAppShell>
    </>
  )
}

function KnowledgeBody({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId)
  const { data: me } = useCurrentUser()
  const { data: members = [] } = useProjectMembersWithRoles(projectId)
  const { data: docs = [] } = useProjectDocs(projectId)
  const { isPinned, toggle: togglePin } = usePinnedDocs(projectId)
  const { mutate: deleteDoc, isPending: isDeleting } = useDeleteKnowledgeDoc()

  const isAdmin = useMemo(() => {
    if (!me) return false
    return members.some((m) => m.id === me.id && m.role === 'admin')
  }, [me, members])

  const [tagFilter, setTagFilter] = useState<Set<ProjectDoc['source']>>(
    () => new Set(TAG_OPTIONS.map((t) => t.key))
  )
  const [tagOpen, setTagOpen] = useState(false)
  const tagRef = useClickOutside(tagOpen, () => setTagOpen(false))
  const [sortRecent, setSortRecent] = useState(true)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<ProjectDoc | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<ProjectDoc | null>(null)

  const allTagsOn = tagFilter.size === TAG_OPTIONS.length

  const toggleTag = (key: ProjectDoc['source']) => {
    setTagFilter((prev) => {
      // From "All" mode → narrow to just this one tag.
      if (prev.size === TAG_OPTIONS.length) return new Set([key])
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleAllTag = () => {
    setTagFilter((prev) =>
      prev.size === TAG_OPTIONS.length
        ? new Set()
        : new Set(TAG_OPTIONS.map((t) => t.key))
    )
  }

  const tagCounts = useMemo(() => {
    const m = new Map<ProjectDoc['source'], number>()
    for (const d of docs) m.set(d.source, (m.get(d.source) ?? 0) + 1)
    return m
  }, [docs])

  const filtered = useMemo(() => {
    let arr = docs
    if (tagFilter.size < TAG_OPTIONS.length) {
      arr = arr.filter((d) => tagFilter.has(d.source))
    }
    const sorted = [...arr].sort((a, b) => {
      const da = new Date(a.uploaded_at).getTime()
      const db = new Date(b.uploaded_at).getTime()
      return sortRecent ? db - da : da - db
    })
    return sorted
  }, [docs, tagFilter, sortRecent])

  const pinned = useMemo(
    () => docs.filter((d) => isPinned(d.id)),
    [docs, isPinned]
  )

  const tagFilterLabel = allTagsOn ? 'Tag' : `Tag · ${tagFilter.size}`

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6 gap-6">
      {/* Toolbar */}
      <div className="shrink-0 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <p
            className="text-[10px] font-medium uppercase tracking-[1.5px]"
            style={{ color: resolveProjectColor(project?.color) }}
          >
            {(project?.name ?? '').toUpperCase()} · KNOWLEDGE BASE · {docs.length} DOCS
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            The project's{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              memory.
            </em>
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
          <div ref={tagRef} className="relative">
            <Button
              size="compact"
              variant="secondary"
              iconLeft="Filter"
              onClick={() => setTagOpen((s) => !s)}
            >
              {tagFilterLabel}
            </Button>
            {tagOpen && (
              <div className="absolute top-[40px] right-0 z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[10px] flex flex-col gap-[2px] min-w-[240px]">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
                  Tag
                </p>
                <FilterChecklist
                  label="All"
                  count={docs.length}
                  color="#455E6A"
                  checked={allTagsOn}
                  onChange={toggleAllTag}
                />
                <div className="h-px bg-gray-border-light my-[5px]" />
                {TAG_OPTIONS.map((t) => (
                  <FilterChecklist
                    key={t.key}
                    label={t.label}
                    count={tagCounts.get(t.key) ?? 0}
                    color={t.color}
                    checked={tagFilter.has(t.key)}
                    onChange={() => toggleTag(t.key)}
                  />
                ))}
              </div>
            )}
          </div>
          <Button
            size="compact"
            variant="secondary"
            iconLeft="Filter"
            onClick={() => setSortRecent((s) => !s)}
          >
            Sort: {sortRecent ? 'Recent' : 'Old'}
          </Button>
          <Button size="compact" iconLeft="Add" onClick={() => setNewDocOpen(true)}>
            New doc
          </Button>
        </div>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="shrink-0 flex flex-col gap-[10px]">
          <div className="flex items-center gap-[10px]">
            <Icon name="Pin" size={15} className="text-black" />
            <h2 className="text-black text-[14px] font-semibold">Pinned</h2>
            <span
              className="text-gray-secondary text-[12px] font-medium"
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              {pinned.length}
            </span>
          </div>
          <div className="flex gap-[10px]">
            {pinned.slice(0, 3).map((d) => (
              <PinnedCard key={d.id} doc={d} />
            ))}
          </div>
        </div>
      )}

      {/* All docs — shrinks to content when rows are few, scrolls internally when overflowing */}
      <div className="min-h-0 flex flex-col gap-[10px]">
        <div className="shrink-0 flex items-center gap-[10px]">
          <h2 className="text-black text-[14px] font-semibold">All docs</h2>
          <span
            className="text-gray-secondary text-[12px] font-medium"
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {filtered.length}
          </span>
        </div>
        <div className="min-h-0 bg-white-white rounded-[10px] border border-gray-border-light flex flex-col overflow-hidden">
          <TableHeader columns={COLS} className="!gap-[12px] !px-[16px] shrink-0" />
          <div className="min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-secondary text-[12px]">
              {docs.length === 0 ? 'No documents yet.' : 'No docs match the filter.'}
            </div>
          ) : (
            filtered.map((d, i) => {
              const cat = SOURCE_TO_CATEGORY[d.source]
              const pinnedNow = isPinned(d.id)
              return (
                <TableRow
                  key={d.id}
                  isLast={i === filtered.length - 1}
                  onClick={() => setPreviewDoc(d)}
                  className="!gap-[12px] !px-[16px]"
                >
                  <TableCell width="flex-[2]">
                    <span className="flex items-center gap-[10px] min-w-0">
                      <FileLabel variant="icon" category={cat} />
                      {pinnedNow && (
                        <Icon
                          name="Pin"
                          size={16}
                          className="text-gray-main shrink-0"
                        />
                      )}
                      <span className="text-[12px] text-black truncate">{d.name}</span>
                    </span>
                  </TableCell>
                  <TableCell width="w-[120px]">
                    <span className="text-[12px] text-gray-main">
                      {d.file_type ?? 'Doc'}
                    </span>
                  </TableCell>
                  <TableCell width="w-[160px]">
                    <FileLabel variant="text" category={cat} />
                  </TableCell>
                  <TableCell width="w-[70px]" className="ml-[20px]">
                    <span
                      className="text-[12px] font-semibold tracking-[-0.2px] text-gray-main"
                      style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                    >
                      —
                    </span>
                  </TableCell>
                  <TableCell width="w-[140px]">
                    <span className="flex items-center gap-[8px]">
                      {d.uploader && (
                        <UserGroup members={[userToMember(d.uploader)]} size={20} />
                      )}
                      <span className="text-[12px] text-black">
                        {relativeDate(d.uploaded_at)}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell width="w-[40px]">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      title={
                        isAdmin
                          ? undefined
                          : 'Only project admins can delete docs'
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isAdmin) return
                        setDeletingDoc(d)
                      }}
                      className="text-red-main hover:bg-red-50 inline-flex items-center justify-center w-[24px] h-[24px] rounded transition-colors disabled:text-gray-secondary disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      aria-label="Delete document"
                    >
                      <Icon name="Trash" size={15} />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
          </div>
        </div>
      </div>

      {/* New doc modal */}
      <NewDocModal
        open={newDocOpen}
        projectId={projectId}
        projectName={project?.name ?? undefined}
        onClose={() => setNewDocOpen(false)}
      />

      {/* Preview modal */}
      {previewDoc && (
        <DocPreviewModal
          doc={previewDoc}
          pinned={isPinned(previewDoc.id)}
          onTogglePin={() => togglePin(previewDoc.id)}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Delete confirmation */}
      <DeleteConfirmModal
        open={deletingDoc !== null}
        type="file"
        title="Delete this file?"
        body={
          <>
            This action is <strong className="font-bold">permanent</strong>. The
            file will be removed for everyone in the workspace.
          </>
        }
        subject={
          deletingDoc && (
            <div className="flex items-center gap-[10px] min-w-0">
              <FileLabel
                variant="icon"
                category={SOURCE_TO_CATEGORY[deletingDoc.source]}
              />
              <div className="flex flex-col gap-[3px] min-w-0">
                <p className="text-black text-[12px] font-semibold truncate">
                  {deletingDoc.name}
                </p>
                <p className="text-gray-main text-[8px] truncate">
                  {deletingDoc.file_type ?? 'Doc'} · Edited{' '}
                  {relativeDate(deletingDoc.uploaded_at)}
                  {deletingDoc.uploader
                    ? ` by ${
                        deletingDoc.uploader.nickname ||
                        `${deletingDoc.uploader.first_name} ${deletingDoc.uploader.last_name}`.trim() ||
                        deletingDoc.uploader.email
                      }`
                    : ''}
                </p>
              </div>
            </div>
          )
        }
        consequences={
          deletingDoc
            ? [
                `Removed from ${project?.name ?? 'this project'}'s knowledge base`,
                'Any task descriptions or references to this file will break — descriptions are preserved',
              ]
            : []
        }
        confirmLabel="Delete file"
        submitting={isDeleting}
        onClose={() => setDeletingDoc(null)}
        onConfirm={() => {
          if (!deletingDoc) return
          deleteDoc(
            { docId: deletingDoc.id, projectId },
            {
              onSuccess: () => setDeletingDoc(null),
              onError: (err) => window.alert(err.message),
            }
          )
        }}
      />
    </div>
  )
}

function DocPreviewModal({
  doc,
  pinned,
  onTogglePin,
  onClose,
}: {
  doc: ProjectDoc
  pinned: boolean
  onTogglePin: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const cat = SOURCE_TO_CATEGORY[doc.source]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[40px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[10px] shadow-2xl w-[720px] max-w-[95vw] h-[600px] max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-[10px] px-[20px] pt-[20px] pb-[15px] border-b border-gray-border-light">
          <div className="flex items-start gap-[12px] min-w-0">
            <FileLabel variant="icon" category={cat} size="lg" />
            <div className="flex flex-col gap-[3px] min-w-0">
              <p className="text-blue-main text-[10px] font-semibold uppercase tracking-[1.5px]">
                Knowledge · Preview
              </p>
              <h2 className="text-black text-[18px] font-semibold leading-tight truncate">
                {doc.name}
              </h2>
              <div className="flex items-center gap-[10px] mt-[3px]">
                <FileLabel variant="text" category={cat} />
                <span className="text-gray-secondary text-[10px]">
                  {doc.file_type ?? 'Doc'}
                </span>
                <span className="text-gray-secondary text-[10px]">·</span>
                <span className="text-gray-secondary text-[10px]">
                  {doc.uploader
                    ? doc.uploader.nickname ||
                      `${doc.uploader.first_name} ${doc.uploader.last_name}`.trim()
                    : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-[5px] shrink-0">
            <button
              type="button"
              onClick={onTogglePin}
              aria-label={pinned ? 'Unpin' : 'Pin'}
              title={pinned ? 'Unpin' : 'Pin'}
              className={`inline-flex items-center gap-[5px] px-[10px] h-[28px] rounded-[5px] border border-solid text-[12px] transition-colors ${
                pinned
                  ? 'bg-blue-light text-blue-main border-blue-main/30'
                  : 'bg-white-white text-gray-main border-gray-border-light hover:bg-white-item'
              }`}
            >
              <Icon name="Pin" size={13} />
              <span>{pinned ? 'Pinned' : 'Pin'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-main hover:bg-white-item rounded p-1 transition-colors"
            >
              <Icon name="Cross" size={13} />
            </button>
          </div>
        </div>

        {/* Preview body — blind placeholder until real file rendering ships */}
        <div className="relative flex-1 min-h-0 bg-white-main p-[20px] overflow-auto flex items-center justify-center">
          <div
            aria-hidden
            className="w-full max-w-[480px] aspect-[3/4] bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-sm flex flex-col p-[30px] gap-[10px] overflow-hidden"
            style={{
              filter: 'blur(4px)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            <div className="h-[18px] w-[60%] bg-gray-extra-light rounded-[3px]" />
            <div className="h-[10px] w-[40%] bg-gray-extra-light rounded-[3px]" />
            <div className="mt-[20px] flex flex-col gap-[8px]">
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  className="h-[8px] bg-gray-extra-light rounded-[3px]"
                  style={{ width: `${65 + ((i * 13) % 30)}%` }}
                />
              ))}
            </div>
            <div className="mt-[15px] h-[100px] bg-gray-extra-light rounded-[3px]" />
            <div className="mt-[10px] flex flex-col gap-[8px]">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="h-[8px] bg-gray-extra-light rounded-[3px]"
                  style={{ width: `${50 + ((i * 17) % 35)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p
              className="text-gray-main text-[12px] bg-white-white/90 px-[14px] py-[8px] rounded-[5px] border border-gray-border-light shadow-sm tracking-[0.5px]"
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              Preview
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
