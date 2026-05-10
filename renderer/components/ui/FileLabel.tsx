import Icon from './Icon'

export type FileCategory = 'project-context' | 'decisions' | 'references'

const config: Record<FileCategory, { bg: string; text: string; label: string }> = {
  'project-context': { bg: 'bg-turquoise-light', text: 'text-turquoise-main', label: 'Project Context' },
  decisions: { bg: 'bg-brown-light', text: 'text-brown-med', label: 'Decisions & History' },
  references: { bg: 'bg-purple-light', text: 'text-purple-main', label: 'References & Resources' },
}

type IconProps = {
  variant: 'icon'
  category: FileCategory
  size?: 'sm' | 'lg'
  className?: string
}

type TextProps = {
  variant: 'text'
  category: FileCategory
  className?: string
}

type Props = IconProps | TextProps

export default function FileLabel(props: Props) {
  const c = config[props.category]

  if (props.variant === 'text') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[3px] px-[7px] py-[3px] text-[10px] font-semibold uppercase tracking-[1px] whitespace-nowrap ${c.bg} ${c.text} ${props.className ?? ''}`}
      >
        {c.label}
      </span>
    )
  }

  const dimension = props.size === 'lg' ? 30 : 20
  const iconSize = props.size === 'lg' ? 18 : 15
  return (
    <span
      style={{ width: dimension, height: dimension }}
      className={`inline-flex items-center justify-center rounded-[3px] shrink-0 ${c.bg} ${c.text} ${props.className ?? ''}`}
      aria-label={c.label}
    >
      <Icon name="File" size={iconSize} />
    </span>
  )
}
