import Tag, { type TagColor } from './Tag'
import type { IconName } from './Icon'

export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'

const config: Record<Priority, { color: TagColor; icon: IconName; label: string }> = {
  highest: { color: 'red', icon: 'Highest', label: 'Highest' },
  high: { color: 'amber', icon: 'High', label: 'High' },
  medium: { color: 'blue', icon: 'Medium', label: 'Medium' },
  low: { color: 'green', icon: 'Low', label: 'Low' },
  lowest: { color: 'gray', icon: 'Lowest', label: 'Lowest' },
}

type Props = {
  priority: Priority
  size?: 'sm' | 'md' | 'lg'
  uppercase?: boolean
}

export default function PriorityTag({ priority, size = 'md', uppercase = false }: Props) {
  const c = config[priority]
  return (
    <Tag color={c.color} icon={c.icon} size={size} uppercase={uppercase}>
      {c.label}
    </Tag>
  )
}
