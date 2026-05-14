import PriorityTag, { type Priority } from './PriorityTag'
import UserGroup, { type Member } from './UserGroup'

export type TaskStatus = 'planned' | 'in-progress' | 'review' | 'done'

const STATUS_BORDER: Record<TaskStatus, string> = {
  planned: '#E6ECEF',
  'in-progress': '#5B7FB6',
  review: '#B68A48',
  done: '#588F6E',
}

type Props = {
  id: string
  title: string
  status?: TaskStatus
  priority?: Priority
  dueDate?: string
  assignees?: Member[]
  onClick?: () => void
}

export default function Task({
  id,
  title,
  status = 'planned',
  priority,
  dueDate,
  assignees,
  onClick,
}: Props) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`bg-white-white rounded-[5px] flex flex-col gap-[10px] pt-[10px] pb-[8px] pl-[20px] pr-[10px] w-full border-l-[8px] border-solid ${
        onClick ? 'cursor-pointer hover:bg-white-item transition-colors' : ''
      }`}
      style={{ borderLeftColor: STATUS_BORDER[status] }}
    >
      <p
        className="text-[10px] font-semibold tracking-[1px] text-gray-secondary"
        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
      >
        {id}
      </p>
      <p className="font-sans text-[12px] font-semibold text-black leading-snug">{title}</p>
      <div className="flex items-center justify-between">
        {priority ? <PriorityTag priority={priority} /> : <span />}
        <div className="flex items-center gap-[10px]">
          {dueDate && (
            <span
              className="text-[10px] font-semibold tracking-[1px] text-gray-main"
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              {dueDate}
            </span>
          )}
          {assignees && assignees.length > 0 && <UserGroup members={assignees} size={15} />}
        </div>
      </div>
    </div>
  )
}
