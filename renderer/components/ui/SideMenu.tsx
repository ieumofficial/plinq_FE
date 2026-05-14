import { useRouter } from 'next/router'
import { useState, type ReactNode } from 'react'
import MenuItem from './MenuItem'
import Button from './Button'
import type { IconName } from './Icon'
import ProfileDropdown from '../ProfileDropdown'
import { useCurrentUser } from '../../lib/hooks'
import { usePresence } from '../../lib/presencePref'

export type NavItem = {
  key: string
  icon: IconName
  label: string
  count?: number
}

type Props = {
  /** Section header (e.g., "Personal Space" / "Project · Apollo"). */
  sectionLabel?: string
  /** Active item key. */
  activeKey?: string
  /** Items rendered in main nav. */
  items: NavItem[]
  /** Items rendered above the user / settings footer. */
  footerItems?: NavItem[]
  /** Initials shown in the footer avatar. */
  userInitials: string
  /** Display name shown next to the avatar. */
  userName: string
  /** Compact icon-only rail. */
  stacked?: boolean
  /** Click handler for a nav item — receives item key. */
  onItemClick?: (key: string) => void
  /** Optional "Create new" button shown above the divider. */
  onCreateNew?: () => void
  /** Replace the section label with arbitrary content (e.g. project switcher). */
  sectionExtra?: ReactNode
  /** Click handler for the "Toggle sidebar" footer item. When provided, the
   * row is rendered above the user block / divider. */
  onToggleSidebar?: () => void
}

export default function SideMenu({
  sectionLabel,
  activeKey,
  items,
  footerItems,
  userInitials,
  userName,
  stacked = false,
  onItemClick,
  onCreateNew,
  sectionExtra,
  onToggleSidebar,
}: Props) {
  const router = useRouter()
  const [presence, setPresence] = usePresence()
  const [profileRect, setProfileRect] = useState<DOMRect | null>(null)
  const { data: currentUser } = useCurrentUser()

  const widthClass = stacked ? 'w-[59px]' : 'w-[200px]'
  // Less top padding now that the org block lives in the header above.
  const padding = 'pt-[5px] pb-[18px] px-[12px]'

  return (
    <aside
      className={`border-r border-solid border-gray-border h-full flex flex-col ${stacked ? 'items-center' : 'items-start'} justify-between ${padding} ${widthClass} shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden`}
      style={{
        // Figma 856:316 (expanded, 131deg) vs 857:5428 (rail, 104deg)
        backgroundImage: stacked
          ? 'linear-gradient(104.6deg, #2E434E 0%, #1F2F38 100%)'
          : 'linear-gradient(131.45deg, #2E434E 0%, #1F2F38 100%)',
      }}
    >
      {/* Top: Section + Nav */}
      <div className={`flex flex-col gap-[10px] w-full ${stacked ? 'items-center' : 'items-start'}`}>
        {!stacked && sectionLabel && (
          <p className="text-gray-secondary text-[10px] font-medium uppercase tracking-[1.5px] w-full">
            {sectionLabel}
          </p>
        )}
        {!stacked && sectionExtra}
        <nav className={`flex flex-col gap-[5px] w-full ${stacked ? 'items-center' : 'items-start'}`}>
          {items.map((it) => (
            <MenuItem
              key={it.key}
              icon={it.icon}
              label={it.label}
              count={it.count}
              selected={it.key === activeKey}
              stacked={stacked}
              onClick={() => onItemClick?.(it.key)}
            />
          ))}
        </nav>
        {onCreateNew && (
          stacked ? (
            <Button size="compact" variant="ghost" iconOnly="Add" onClick={onCreateNew} />
          ) : (
            <Button
              variant="ghost"
              size="compact"
              iconLeft="Add"
              onClick={onCreateNew}
              className="w-full"
            >
              Create new
            </Button>
          )
        )}
      </div>

      {/* Footer */}
      <div className={`flex flex-col gap-[5px] w-full ${stacked ? 'items-center' : 'items-start'}`}>
        {onToggleSidebar && (
          <MenuItem
            icon="Sidebar"
            label="Toggle sidebar"
            stacked={stacked}
            onClick={onToggleSidebar}
          />
        )}
        {footerItems?.map((it) => (
          <MenuItem
            key={it.key}
            icon={it.icon}
            label={it.label}
            count={it.count}
            selected={it.key === activeKey}
            stacked={stacked}
            onClick={() => onItemClick?.(it.key)}
          />
        ))}
        <div className="h-px bg-white/10 w-full" />
        <button
          type="button"
          onClick={(e) => {
            setProfileRect(
              profileRect ? null : e.currentTarget.getBoundingClientRect()
            )
          }}
          className={`flex items-center px-[5px] py-[10px] w-full rounded-[5px] hover:bg-white/10 transition-colors ${
            stacked ? 'justify-center' : 'gap-[10px]'
          }`}
          aria-label="Open profile menu"
        >
          <span className="bg-primary-main text-white rounded-full w-[25px] h-[25px] inline-flex items-center justify-center text-[12px] font-semibold uppercase shrink-0">
            {userInitials}
          </span>
          {!stacked && (
            <span
              className="text-primary-light text-[14px] font-semibold whitespace-nowrap truncate"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {userName}
            </span>
          )}
        </button>
      </div>
      <ProfileDropdown
        anchorRect={profileRect}
        placement="right"
        userInitials={userInitials}
        userName={userName}
        userEmail={currentUser?.email}
        presence={presence}
        onPresenceChange={(next) => setPresence(next)}
        onMyPage={() => {
          setProfileRect(null)
          router.push('/my/overview')
        }}
        onClose={() => setProfileRect(null)}
      />
    </aside>
  )
}
