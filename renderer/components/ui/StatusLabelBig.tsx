import Tag, { type TagColor } from './Tag'

export type Status = 'planned' | 'in-progress' | 'review' | 'blocked' | 'done' | 'all'

const config: Record<Status, { color: TagColor; label: string; overrideClass?: string }> = {
  // Spec: bg #E6ECEF (white-secondary-ish), text #16242E (black) — not the standard gray Tag.
  planned: {
    color: 'gray',
    label: 'Planned',
    overrideClass: 'bg-[#E6ECEF] text-black',
  },
  'in-progress': { color: 'blue', label: 'In Progress' },
  review: { color: 'amber', label: 'Review' },
  blocked: { color: 'red', label: 'Blocked' },
  done: { color: 'green', label: 'Done' },
  all: { color: 'purple', label: 'All' },
}

type Props = {
  status: Status
  /** Visual emphasis when used as a Kanban column header. */
  size?: 'md' | 'lg'
  className?: string
}

export default function StatusLabelBig({ status, size = 'lg', className }: Props) {
  const c = config[status]
  return (
    <Tag color={c.color} size={size} uppercase className={[c.overrideClass ?? '', className ?? ''].join(' ')}>
      {c.label}
    </Tag>
  )
}
