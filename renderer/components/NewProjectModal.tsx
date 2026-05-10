import { useEffect, useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import { createProject } from '../lib/queries'

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export default function NewProjectModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setDescription('')
      setError('')
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Project name is required.')
      return
    }
    setError('')
    setSubmitting(true)
    const result = await createProject({
      name,
      description: description || undefined,
    })
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onCreated?.(result.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white-white rounded-[10px] shadow-xl w-[420px] max-w-[90vw] flex flex-col gap-5 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-black text-[18px] font-semibold">New project</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-secondary hover:text-black p-1 rounded"
          >
            <Icon name="Cross" size={15} />
          </button>
        </div>

        <Input
          label="NAME"
          placeholder="e.g. Apollo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          label="DESCRIPTION (OPTIONAL)"
          placeholder="What is this project about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && <p className="text-red-main text-[12px]">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-2">
          <Button type="button" variant="subtle" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </div>
  )
}
