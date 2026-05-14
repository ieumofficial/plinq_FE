import type { CSSProperties } from 'react'

const ICON_NAMES = [
  'Add',
  'ArrowLeft',
  'ArrowRight',
  'ArrowRight2',
  'Calendar',
  'Chat',
  'Cross',
  'Dashboard',
  'Dot-Menu',
  'Email',
  'File',
  'Filter',
  'Folder',
  'High',
  'Highest',
  'Invite',
  'Kanban',
  'Low',
  'Lowest',
  'Medium',
  'Meeting',
  'Notification',
  'Organization',
  'People',
  'Pin',
  'PinFilled',
  'Search',
  'Settings',
  'Sidebar',
  'Sparkle',
  'Task',
  'Trash',
  'Warning',
] as const

export type IconName = (typeof ICON_NAMES)[number]
export const ALL_ICON_NAMES = ICON_NAMES

type Props = {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
}

/**
 * Renders an icon from /public/icons via CSS mask-image so the
 * icon's color follows `currentColor` on the parent element.
 */
export default function Icon({ name, size = 15, className, style }: Props) {
  const url = `/icons/${name}.svg`
  return (
    <span
      role="img"
      aria-label={name}
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
