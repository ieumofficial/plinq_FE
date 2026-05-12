/**
 * Emoji reaction chip on a chat message. Two flavors:
 *  - 'reaction' : shown next to a message, displays emoji + count (e.g. "🎯 4")
 *                 selected = current user has reacted
 *  - 'add'      : tiny "+" pill that opens an emoji picker
 *
 * Figma "Reaction Button" frame (id 1177:14629).
 */

import Icon from './Icon'

type ReactionProps = {
  variant: 'reaction'
  emoji: string
  count: number
  selected?: boolean
  onClick?: () => void
  className?: string
}

type AddProps = {
  variant: 'add'
  onClick?: () => void
  className?: string
}

type Props = ReactionProps | AddProps

export default function ReactionButton(props: Props) {
  if (props.variant === 'add') {
    return (
      <button
        type="button"
        onClick={props.onClick}
        aria-label="Add reaction"
        className={`inline-flex items-center justify-center rounded-[10px] border border-dashed border-gray-border p-[2px] text-gray-main hover:bg-white-item ${
          props.className ?? ''
        }`}
      >
        <Icon name="Add" size={12} />
      </button>
    )
  }
  const { emoji, count, selected, onClick, className } = props
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center justify-center rounded-[10px] border border-solid border-gray-border-light px-[7px] py-[2px] text-[10px] text-black whitespace-nowrap transition-colors ${
        selected ? 'bg-primary-light' : 'bg-white-item hover:bg-primary-light/60'
      } ${className ?? ''}`}
    >
      {emoji} {count}
    </button>
  )
}
