import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

export type TagColor =
  | 'blue'
  | 'amber'
  | 'green'
  | 'red'
  | 'gray'
  | 'purple'
  | 'dark'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  color?: TagColor
  size?: Size
  icon?: IconName
  children: ReactNode
  className?: string
  uppercase?: boolean
}

// Background + text color pairs derived from the design tokens.
const colorStyles: Record<TagColor, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-light', text: 'text-blue-main' },
  amber: { bg: 'bg-[#F4E6CD]', text: 'text-[#8A5A1E]' },
  green: { bg: 'bg-[#DCEBE0]', text: 'text-green-main' },
  red: { bg: 'bg-[#F2DEDE]', text: 'text-red-main' },
  gray: { bg: 'bg-gray-extra-light', text: 'text-gray-main' },
  purple: { bg: 'bg-purple-light', text: 'text-purple-main' },
  dark: { bg: 'bg-primary-dark', text: 'text-white-main' },
}

const sizeStyles: Record<Size, { padding: string; text: string; iconSize: number; gap: string; rounded: string }> = {
  sm: {
    padding: 'px-[3px] py-[1px]',
    text: 'text-[8px] font-semibold tracking-[1.5px]',
    iconSize: 10,
    gap: 'gap-[2px]',
    rounded: 'rounded-[2px]',
  },
  md: {
    padding: 'px-[7px] py-[3px]',
    text: 'text-[10px] font-semibold tracking-[1px]',
    iconSize: 12,
    gap: 'gap-[3px]',
    rounded: 'rounded-[2px]',
  },
  lg: {
    padding: 'px-[10px] py-[5px]',
    text: 'text-[12px] font-semibold tracking-[1px]',
    iconSize: 14,
    gap: 'gap-[4px]',
    rounded: 'rounded-[3px]',
  },
}

export default function Tag({
  color = 'blue',
  size = 'md',
  icon,
  children,
  className,
  uppercase = true,
}: Props) {
  const c = colorStyles[color]
  const s = sizeStyles[size]
  const cls = [
    'inline-flex items-center justify-center font-sans whitespace-nowrap',
    c.bg,
    c.text,
    s.padding,
    s.text,
    s.gap,
    s.rounded,
    uppercase ? 'uppercase' : '',
    className ?? '',
  ]
    .join(' ')
    .trim()

  return (
    <span className={cls}>
      {icon && <Icon name={icon} size={s.iconSize} />}
      {children}
    </span>
  )
}
