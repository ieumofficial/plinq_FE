import { useEffect, useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import { useCreateKnowledgeDoc } from '../lib/hooks'
import type { ProjectDoc } from '../lib/queries'

type Props = {
  open: boolean
  projectId: string
  projectName?: string
  onClose: () => void
  onCreated?: (id: string) => void
}

const SOURCE_OPTIONS: {
  key: ProjectDoc['source']
  label: string
  description: string
}[] = [
  {
    key: 'uploaded',
    label: 'Project context',
    description: 'PRD, architecture, anything the team uploaded',
  },
  {
    key: 'meeting',
    label: 'Decisions',
    description: 'Coming out of a meeting or agreement',
  },
  {
    key: 'auto_generated',
    label: 'References',
    description: 'Spec, API docs, external links',
  },
]

export default function NewDocModal({
  open,
  projectId,
  projectName,
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState('')
  const [source, setSource] = useState<ProjectDoc['source']>('uploaded')
  const [error, setError] = useState('')
  const { mutate, isPending } = useCreateKnowledgeDoc()

  useEffect(() => {
    if (!open) return
    setName('')
    setSource('uploaded')
    setError('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, source])

  const submit = () => {
    if (!name.trim()) {
      setError('Title is required.')
      return
    }
    setError('')
    mutate(
      {
        project_id: projectId,
        name,
        source,
      },
      {
        onSuccess: (r) => {
          onCreated?.(r.id)
          onClose()
        },
        onError: (e) => setError(e.message),
      }
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[10px] shadow-2xl w-[560px] max-w-[95vw] flex flex-col"
      >
        <div className="px-[20px] pt-[20px] pb-[15px] border-b border-gray-border-light">
          <p className="text-blue-main text-[10px] font-semibold uppercase tracking-[1.5px]">
            New doc{projectName ? ` · ${projectName}` : ''}
          </p>
          <h2 className="text-black text-[20px] font-semibold mt-2">
            Add to knowledge base
          </h2>
          <p className="text-gray-main text-[12px] mt-1">
            File upload isn't wired up yet — paste a link or just record the
            title for now.
          </p>
        </div>

        <div className="px-[20px] py-[20px] flex flex-col gap-[15px]">
          <Input
            label="TITLE *"
            placeholder="Cutover runbook v2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="!max-w-none"
          />

          <div className="flex flex-col gap-[6px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Category
            </label>
            <div className="flex flex-col gap-[5px]">
              {SOURCE_OPTIONS.map((opt) => {
                const active = source === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSource(opt.key)}
                    className={`flex flex-col px-[12px] py-[8px] rounded-[5px] border border-solid text-left transition-colors ${
                      active
                        ? 'bg-blue-light/30 border-blue-main'
                        : 'border-gray-border-light hover:bg-white-item'
                    }`}
                  >
                    <span className="text-black text-[13px] font-semibold">
                      {opt.label}
                    </span>
                    <span className="text-gray-secondary text-[11px]">
                      {opt.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* File upload + Link — disabled placeholders until storage / link
              parsing ships. */}
          <div className="grid grid-cols-2 gap-[15px]">
            <div className="flex flex-col gap-[5px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                File
              </label>
              <div
                title="File upload is not available yet"
                className="bg-gray-extra-light border border-dashed border-gray-border rounded-[5px] px-[12px] py-[10px] flex items-center gap-[8px] text-gray-secondary text-[12px] cursor-not-allowed"
              >
                <Icon name="File" size={13} />
                <span className="flex-1">Drop file or click to upload</span>
              </div>
              <p className="text-gray-secondary text-[10px]">Not available yet</p>
            </div>
            <div className="flex flex-col gap-[5px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Link
              </label>
              <input
                type="url"
                placeholder="https://…"
                disabled
                value=""
                onChange={() => {}}
                title="Link attachments are not available yet"
                className="bg-gray-extra-light border border-solid border-gray-border rounded-[5px] px-[12px] py-[10px] text-[12px] text-gray-secondary cursor-not-allowed disabled:cursor-not-allowed"
              />
              <p className="text-gray-secondary text-[10px]">Not available yet</p>
            </div>
          </div>

          {error && <p className="text-red-main text-[12px]">{error}</p>}
        </div>

        <div className="px-[20px] py-[15px] border-t border-gray-border-light flex items-center justify-between">
          <p className="text-gray-secondary text-[11px]">⌘ ↵ to create</p>
          <div className="flex items-center gap-3">
            <Button variant="subtle" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending || !name.trim()}>
              {isPending ? 'Adding…' : 'Add Doc'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
