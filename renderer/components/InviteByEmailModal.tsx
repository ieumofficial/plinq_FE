import { useEffect, useState } from 'react'
import Button from './ui/Button'
import Icon from './ui/Icon'
import type { ProjectRoleDb } from '../lib/types'

type Props = {
  open: boolean
  /** 'project' shows role picker (Editor/Admin/Read-only). 'meeting' is just email. */
  variant: 'project' | 'meeting'
  onClose: () => void
  /** Resolves with the entered email (and role if project). The caller is responsible
   *  for inserting into project_invites/meeting_invites. */
  onSubmit: (data: { email: string; role?: ProjectRoleDb }) => Promise<void>
}

const ROLES: { key: ProjectRoleDb; label: string }[] = [
  { key: 'editor', label: 'Editor' },
  { key: 'admin', label: 'Admin' },
  { key: 'readonly', label: 'Read-only' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InviteByEmailModal({ open, variant, onClose, onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectRoleDb>('editor')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setRole('editor')
    setError('')
    setSubmitting(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({
        email: email.trim().toLowerCase(),
        role: variant === 'project' ? role : undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white-white rounded-[10px] shadow-2xl w-[420px] max-w-[92vw] flex flex-col gap-4 p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-black text-[16px] font-semibold">Invite by email</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-secondary hover:text-black p-1 rounded"
            aria-label="Close"
          >
            <Icon name="Cross" size={14} />
          </button>
        </div>

        <p className="text-gray-main text-[12px]">
          We&apos;ll add them automatically when they sign up with this email.
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            autoFocus
            className="bg-white-white border border-gray-border rounded-lg px-3 py-2 text-[12px] text-black outline-none focus:border-primary-main h-[39px]"
          />
        </div>

        {variant === 'project' && (
          <div className="flex flex-col gap-1">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Role
            </label>
            <div className="flex items-center gap-[6px]">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key)}
                  className={`text-[11px] font-semibold uppercase tracking-[0.5px] px-[10px] py-[5px] rounded-[3px] transition-colors ${
                    role === r.key
                      ? 'bg-blue-light text-blue-main'
                      : 'text-gray-secondary hover:text-black'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-main text-[11px]">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-2">
          <Button
            type="button"
            variant="subtle"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !email.trim()}>
            {submitting ? 'Sending…' : 'Send invite'}
          </Button>
        </div>
      </form>
    </div>
  )
}
