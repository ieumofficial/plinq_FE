import Checkbox from './Checkbox'
import PriorityTag, { type Priority } from './PriorityTag'
import Tag, { type TagColor } from './Tag'

type Props = {
  title: string
  date?: string
  priority?: Priority
  projectTag?: { label: string; color?: TagColor }
  checked?: boolean
  onCheckedChange?: (next: boolean) => void
}

export default function ActionItem({
  title,
  date,
  priority,
  projectTag,
  checked = false,
  onCheckedChange,
}: Props) {
  return (
    <div className="bg-white-item rounded-[5px] flex items-center justify-between px-[14px] py-[10px] w-full gap-4">
      <div className="flex items-center gap-[15px] min-w-0 flex-1">
        <Checkbox checked={checked} onChange={onCheckedChange} />
        <div className="flex flex-col gap-[5px] min-w-0">
          <p
            className={`font-sans text-[14px] font-semibold truncate ${
              checked ? 'text-gray-secondary line-through' : 'text-black'
            }`}
          >
            {title}
          </p>
          <div className="flex items-center gap-[15px]">
            {date && (
              <span className="font-sans text-[10px] font-medium uppercase tracking-[1.5px] text-gray-secondary">
                {date}
              </span>
            )}
            {priority && (
              <>
                {date && <span className="w-px h-[10px] bg-gray-border-light" />}
                <PriorityTag priority={priority} />
              </>
            )}
          </div>
        </div>
      </div>
      {projectTag && (
        <Tag color={projectTag.color ?? 'purple'} size="md">
          {projectTag.label}
        </Tag>
      )}
    </div>
  )
}
