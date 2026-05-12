import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'
import FileLabel, { type FileCategory } from '../../../components/ui/FileLabel'
import UserGroup from '../../../components/ui/UserGroup'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import { useProject, useProjectDocs } from '../../../lib/hooks'
import { userToMember } from '../../../lib/types'
import type { ProjectDoc } from '../../../lib/queries'

const COLS: Column[] = [
  { key: 'title', label: 'Title', width: 'flex-[2]' },
  { key: 'type', label: 'Type', width: 'w-[140px]' },
  { key: 'tag', label: 'Tag', width: 'w-[200px]' },
  { key: 'size', label: 'Size', width: 'w-[80px]' },
  { key: 'edited', label: 'Edited', width: 'w-[140px]' },
]

const SOURCE_TO_CATEGORY: Record<ProjectDoc['source'], FileCategory> = {
  uploaded: 'project-context',
  meeting: 'decisions',
  auto_generated: 'references',
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  const { data: project } = useProject(projectId)
  const { data: docs = [] } = useProjectDocs(projectId)

  const pinned = docs.slice(0, 3)
  const all = docs

  if (!projectId) return null

  return (
    <>
      <Head>
        <title>plinq · Knowledge Base</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="knowledge">
        <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                {(project?.name ?? '').toUpperCase()} · KNOWLEDGE BASE · {docs.length} DOCS
              </p>
              <h1 className="text-black text-[28px] font-semibold leading-tight">
                The project's{' '}
                <em
                  className="italic text-blue-main font-medium"
                  style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
                >
                  memory.
                </em>
              </h1>
            </div>
            <div className="flex items-center gap-[10px]">
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Tag
              </Button>
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Sort: Recent
              </Button>
              <Button size="compact" iconLeft="Add">
                New doc
              </Button>
            </div>
          </div>

          {/* Pinned */}
          {pinned.length > 0 && (
            <div className="flex flex-col gap-[10px]">
              <div className="flex items-center gap-[10px]">
                <Icon name="Pin" size={15} />
                <h2 className="text-black text-[14px] font-semibold">Pinned</h2>
                <span
                  className="text-gray-secondary text-[12px] font-medium"
                  style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                >
                  {pinned.length}
                </span>
              </div>
              <div className="flex gap-[10px]">
                {pinned.map((d) => (
                  <PinnedCard key={d.id} doc={d} />
                ))}
              </div>
            </div>
          )}

          {/* All docs */}
          <div className="flex flex-col gap-[10px]">
            <div className="flex items-center gap-[10px]">
              <h2 className="text-black text-[14px] font-semibold">All docs</h2>
              <span
                className="text-gray-secondary text-[12px] font-medium"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {all.length}
              </span>
            </div>
            <Table>
              <TableHeader columns={COLS} />
              {all.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-secondary text-[12px]">
                  No documents yet.
                </div>
              ) : (
                all.map((d, i) => {
                  const cat = SOURCE_TO_CATEGORY[d.source]
                  return (
                    <TableRow key={d.id} isLast={i === all.length - 1}>
                      <TableCell width="flex-[2]">
                        <span className="flex items-center gap-[10px]">
                          <FileLabel variant="icon" category={cat} />
                          <span className="text-[14px] text-black">{d.name}</span>
                        </span>
                      </TableCell>
                      <TableCell width="w-[140px]">
                        <span className="text-[14px] text-black">
                          {d.file_type ?? 'Doc'}
                        </span>
                      </TableCell>
                      <TableCell width="w-[200px]">
                        <FileLabel variant="text" category={cat} />
                      </TableCell>
                      <TableCell width="w-[80px]">
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
                            <UserGroup
                              members={[userToMember(d.uploader)]}
                              size={20}
                            />
                          )}
                          <span className="text-[12px] text-black">
                            {relativeDate(d.uploaded_at)}
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </Table>
          </div>
        </div>
      </ProjectAppShell>
    </>
  )
}
