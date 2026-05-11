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
  badgeBg: string
  badgeFg: string
  shortcut: string
  title: string
  blurb: string
  bullets: string[]
}

const CARDS: CardSpec[] = [
  {
    type: 'project',
    letter: 'P',
    badgeBg: 'bg-[#DDE7F4]',
    badgeFg: 'text-[#2D5A9E]',
    shortcut: '⌘ P',
    title: 'Project',
    blurb: 'A workstream with members, status, and more.',
    bullets: ['Name + Description', 'Lead + members'],
  },
  {
    type: 'task',
    letter: 'T',
    badgeBg: 'bg-[#DCEBE0]',
    badgeFg: 'text-[#2F6B45]',
    shortcut: '⌘ T',
    title: 'Task',
    blurb: 'A unit of work that can hold subtasks.',
    bullets: ['Project + assignee', 'Priority + due date', 'Subtasks + checklist'],
  },
  {
    type: 'meeting',
    letter: 'M',
    badgeBg: 'bg-[#E5DEEF]',
    badgeFg: 'text-[#5B3D8A]',
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
        className="bg-white-white rounded-[10px] shadow-2xl w-[780px] max-w-[95vw] flex flex-col"
      >
        {/* Header */}
        <div className="px-[30px] pt-[30px] pb-[25px] flex flex-col gap-[10px]">
          <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
            Create New
          </p>
          <h2 className="text-black text-[28px] font-semibold leading-tight">
            What would you like to create?
          </h2>
          <p className="text-gray-main text-[12px]">
            Pick a type — or press the shortcut.
          </p>
        </div>

        {/* Cards */}
        <div className="px-[30px] pb-[20px]">
          <div className="grid grid-cols-3 gap-[15px]">
            {CARDS.map((c) => (
              <button
                key={c.type}
                type="button"
                onClick={() => onPick(c.type)}
                className="bg-white-item border border-gray-border-light rounded-[10px] p-[20px] h-[210px] flex flex-col justify-between text-left hover:border-gray-border hover:shadow-sm transition-all"
              >
                {/* Top: badge + shortcut, then title + blurb */}
                <div className="flex flex-col gap-[15px]">
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-[28px] h-[28px] rounded-[5px] inline-flex items-center justify-center text-[14px] font-bold ${c.badgeBg} ${c.badgeFg}`}
                      style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                    >
                      {c.letter}
                    </span>
                    <span
                      className="bg-white-white border border-gray-border-light text-black text-[10px] px-[5px] py-[5px] rounded-[5px]"
                    >
                      {c.shortcut}
                    </span>
                  </div>
                  <h3 className="text-black text-[20px] font-semibold leading-none">
                    {c.title}
                  </h3>
                  <p className="text-[#6B7B86] text-[10px] leading-[1.5]">
                    {c.blurb}
                  </p>
                </div>

                {/* Bottom: bullet list */}
                <ul className="flex flex-col gap-[7px]">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-[5px]">
                      <span className="w-[3px] h-[3px] rounded-full bg-black shrink-0" />
                      <span className="text-black text-[10px] leading-[1.5]">{b}</span>
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-border-light px-[30px] py-[20px]">
          <p className="text-[#6B7B86] text-[10px]">press esc · click away to cancel</p>
        </div>
      </div>
    </div>
  )
}
