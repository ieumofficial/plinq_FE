type IconProps = {
  className?: string
  size?: number
}

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function CategoryIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function FolderIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <path d="M3 7.5C3 6.12 4.12 5 5.5 5h3.38c.53 0 1.04.21 1.41.59l1.12 1.12c.38.38.88.59 1.41.59h5.68C19.88 7.3 21 8.42 21 9.8v7.7c0 1.38-1.12 2.5-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
    </svg>
  )
}

export function CalendarIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  )
}

export function ListCheckIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <path d="M3 6l2 2 3-3" />
      <path d="M3 13l2 2 3-3" />
      <path d="M3 20l2 2 3-3" />
      <path d="M11 6h10" />
      <path d="M11 13h10" />
      <path d="M11 20h10" />
    </svg>
  )
}

export function UsersIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21.5 18c0-2.49-2.01-4.5-4.5-4.5" />
    </svg>
  )
}

export function SettingsIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function NotificationIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function ArrowDownIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function UserIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8" />
    </svg>
  )
}

export function ShowIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function HideIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  )
}

export function SearchIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} {...baseProps(size)} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
