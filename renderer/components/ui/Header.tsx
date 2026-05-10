import Input from './Input'
import Button from './Button'
import Icon from './Icon'

type Props = {
  /** Top eyebrow line, e.g. "Workspace · Friday, April 10". */
  eyebrow?: string
  /** Big title line, e.g. "Good morning, Yujin". */
  title?: string
  /** Avatar initials shown on the right. */
  userInitials?: string
  /** Whether the notification dot should appear. */
  hasNotifications?: boolean
  onAskAi?: () => void
  onCreateNew?: () => void
  onNotifications?: () => void
  onAvatarClick?: () => void
  onSearchChange?: (value: string) => void
}

export default function Header({
  eyebrow,
  title,
  userInitials = 'YP',
  hasNotifications = false,
  onAskAi,
  onCreateNew,
  onNotifications,
  onAvatarClick,
  onSearchChange,
}: Props) {
  const hasGreeting = !!(eyebrow || title)

  return (
    <header className={`flex items-center px-[25px] py-[15px] w-full ${hasGreeting ? 'justify-between' : 'justify-end'}`}>
      {hasGreeting && (
        <div className="flex flex-col gap-[5px] min-w-0 flex-1">
          {eyebrow && (
            <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] truncate">
              {eyebrow}
            </p>
          )}
          {title && (
            <p className="text-black text-[14px] font-semibold truncate">{title}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-[10px] shrink-0">
        <div className="w-[240px]">
          <Input
            variant="search"
            placeholder="Global Search"
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="compact" iconLeft="Sparkle" onClick={onAskAi}>
          Ask AI
        </Button>
        <Button size="compact" iconLeft="Add" onClick={onCreateNew}>
          Create new
        </Button>
        <button
          type="button"
          onClick={onNotifications}
          className="relative inline-flex items-center justify-center text-black p-1 rounded-md hover:bg-gray-extra-light transition-colors"
          aria-label="Notifications"
        >
          <Icon name="Notification" size={15} />
          {hasNotifications && (
            <span className="absolute top-1 right-1 w-[5px] h-[5px] rounded-full bg-red-med" />
          )}
        </button>
        <button
          type="button"
          onClick={onAvatarClick}
          className="bg-primary-main text-white rounded-full w-[28px] h-[28px] inline-flex items-center justify-center text-[12px] font-semibold uppercase shrink-0"
        >
          {userInitials}
        </button>
      </div>
    </header>
  )
}
