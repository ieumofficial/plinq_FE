import { useEffect } from 'react'

export type CreateType = 'project' | 'task' | 'meeting'

type Props = {
  open: boolean
  onClose: () => void
  onPick: (type: CreateType) => void
}

type CardSpec = {
  type: CreateType
  letter: string
  bg: string
  fg: string
  shortcut: string
  title: string
  blurb: string
  bullets: string[]
}

const CARDS: CardSpec[] = [
  {
    type: 'project',
    letter: 'P',
    bg: 'bg-purple-light',
    fg: 'text-purple-main',
    shortcut: '⌘ P',
    title: 'Project',
    blurb: 'A workstream with members, status, and more.',
    bullets: ['Name + Description', 'Lead + members'],
  },
  {
    type: 'task',
    letter: 'T',
    bg: 'bg-[#DCEBE0]',
    fg: 'text-green-main',
    shortcut: '⌘ T',
    title: 'Task',
    blurb: 'A unit of work that can hold subtasks.',
    bullets: ['Project + assignee', 'Priority + due date', 'Subtasks + checklist'],
  },
  {
    type: 'meeting',
    letter: 'M',
    bg: 'bg-purple-light',
    fg: 'text-purple-main',
    shortcut: '⌘ M',
    title: 'Meeting',
    blurb: 'A scheduled session with agenda and attendees.',
    bullets: ['Title + time', 'Agenda + attendees', 'Auto AI minutes + action items'],
  },
]

export default function CreateNewMenu({ open, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault()
          onPick('project')
        }
        if (e.key.toLowerCase() === 't') {
          e.preventDefault()
          onPick('task')
        }
        if (e.key.toLowerCase() === 'm') {
          e.preventDefault()
          onPick('meeting')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, onPick])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[10px] shadow-xl p-[20px] w-[717px] max-w-[92vw] flex flex-col gap-[20px]"
      >
        <div className="flex flex-col gap-[5px]">
          <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
            Create New
          </p>
          <h2 className="text-black text-[24px] font-semibold leading-tight">
            What would you like to create?
          </h2>
          <p className="text-gray-main text-[12px]">
            Pick a type — or press the shortcut.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-[10px]">
          {CARDS.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => onPick(c.type)}
              className="text-left bg-white-white border border-gray-border-light rounded-[10px] p-[20px] flex flex-col gap-[15px] cursor-pointer hover:shadow-md hover:border-gray-border transition-all"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`w-[28px] h-[28px] rounded-[4px] inline-flex items-center justify-center text-[14px] font-bold uppercase ${c.bg} ${c.fg}`}
                  style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                >
                  {c.letter}
                </span>
                <span
                  className="bg-white-item border border-gray-border-light text-gray-main text-[11px] px-[6px] py-[2px] rounded-[4px] tracking-[0.2px]"
                  style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                >
                  {c.shortcut}
                </span>
              </div>
              <h3 className="text-black text-[20px] font-semibold leading-tight">{c.title}</h3>
              <p className="text-gray-main text-[12px] leading-[1.4]">{c.blurb}</p>
              <ul className="flex flex-col gap-[3px] mt-[5px] text-[12px] text-gray-main">
                {c.bullets.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-border-light pt-[15px]">
          <p className="text-gray-secondary text-[11px]">press esc · click away to cancel</p>
        </div>
      </div>
    </div>
  )
}
