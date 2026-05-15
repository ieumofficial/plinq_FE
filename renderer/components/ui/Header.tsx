import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/router'
import Button from './Button'
import Icon from './Icon'
import GlobalSearchDropdown from '../GlobalSearchDropdown'
import OrgSwitcherDropdown from '../OrgSwitcherDropdown'
import NotificationDropdown from '../NotificationDropdown'
import ProfileDropdown from '../ProfileDropdown'
import { useAiBusy } from '../../lib/aiActivity'
import {
  useCurrentUser,
  useNotifications,
  useNotificationsRealtime,
} from '../../lib/hooks'
import { useNavHistory } from '../../lib/navHistory'
import { usePresence, PRESENCE_DOT } from '../../lib/presencePref'

const drag: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

type Props = {
  /** Organization label shown in the left section. */
  orgName?: string
  /** Top eyebrow line, e.g. "Workspace · Friday, April 10". */
  eyebrow?: string
  /** Big title line, e.g. "Good morning, Yujin". */
  title?: string
  /** Avatar initials shown on the right. */
  userInitials?: string
  /** Whether the notification dot should appear. */
  hasNotifications?: boolean
  /** OS hint for layout (Mac leaves room for traffic lights, Windows shows caption controls). Defaults from window.platform. */
  os?: 'darwin' | 'win32' | 'linux'
  /** True when the Ask AI panel is open — switches button label to "Hide AI". */
  aiOpen?: boolean
  /** True when the notification panel is open — toggles bell visual state. */
  notificationsOpen?: boolean
  onAskAi?: () => void
  onCreateNew?: () => void
  onNotifications?: () => void
  onOrgClick?: () => void
  onAvatarClick?: () => void
  onSearchChange?: (value: string) => void
  onBack?: () => void
  onForward?: () => void
}

function detectOs(): 'darwin' | 'win32' | 'linux' {
  if (typeof window !== 'undefined' && window.platform) return window.platform.os as 'darwin' | 'win32' | 'linux'
  return 'darwin'
}

function OrgBlock({
  orgName,
  onClick,
  triggerRef,
}: {
  orgName: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  triggerRef?: React.Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onClick}
      style={noDrag}
      className="flex items-center gap-[5px] -mx-[4px] px-[4px] py-[2px] rounded hover:bg-white/10 transition-colors"
    >
      <span className="bg-primary-main text-white rounded-[2px] w-[23px] h-[23px] inline-flex items-center justify-center text-[12px] font-semibold uppercase shrink-0">
        {orgName.charAt(0)}
      </span>
      <span className="text-white text-[12px] font-semibold capitalize whitespace-nowrap truncate">
        {orgName}
      </span>
    </button>
  )
}

function CaptionButton({
  onClick,
  variant = 'default',
  children,
  ariaLabel,
}: {
  onClick?: () => void
  variant?: 'default' | 'close'
  children: React.ReactNode
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={noDrag}
      aria-label={ariaLabel}
      className={`w-[46px] h-full inline-flex items-center justify-center text-white-white transition-colors ${
        variant === 'close' ? 'hover:bg-red-med hover:text-white' : 'hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function MinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M0 5 L10 5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
function MaxIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
function RestoreIcon() {
  // Two offset squares — the conventional Windows "restore down" glyph.
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <rect x="2.5" y="0.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
      <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="#2E434E" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export default function Header({
  orgName,
  eyebrow,
  title,
  userInitials = 'YP',
  hasNotifications = false,
  os = detectOs(),
  aiOpen = false,
  notificationsOpen = false,
  onAskAi,
  onCreateNew,
  onNotifications,
  onOrgClick,
  onAvatarClick,
  onSearchChange,
  onBack,
  onForward,
}: Props) {
  const isMac = os === 'darwin'
  const isWindows = os === 'win32'
  const hasGreeting = !!(eyebrow || title)

  const [isMaximized, setIsMaximized] = useState(false)
  // Floating dropdown state. Each picker keeps its trigger rect so the popup
  // can be `position: fixed` anchored to it.
  const orgTriggerRef = useRef<HTMLButtonElement>(null)
  const notifTriggerRef = useRef<HTMLButtonElement>(null)
  const avatarTriggerRef = useRef<HTMLButtonElement>(null)
  const [orgRect, setOrgRect] = useState<DOMRect | null>(null)
  const [notifRect, setNotifRect] = useState<DOMRect | null>(null)
  const [avatarRect, setAvatarRect] = useState<DOMRect | null>(null)

  // Same data the sidebar ProfileDropdown uses — pulled here so the Header
  // avatar can open the identical menu.
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  // Live unread count for the bell badge — also subscribes to realtime
  // so the dot lights up the moment a new notification row lands.
  const { data: notifs = [] } = useNotifications(currentUser?.id)
  useNotificationsRealtime(currentUser?.id)
  const hasUnreadNotifs = notifs.length > 0
  const [presence, setPresence] = usePresence()
  const nav = useNavHistory()
  const aiBusy = useAiBusy()
  const headerUserName = currentUser
    ? currentUser.nickname ||
      `${currentUser.first_name} ${currentUser.last_name}`.trim() ||
      currentUser.email
    : ''

  useEffect(() => {
    if (!isWindows || typeof window === 'undefined' || !window.ipc) return
    const off = window.ipc.on<boolean>('window-maximized-changed', (next) =>
      setIsMaximized(!!next)
    )
    window.ipc.send('window-get-maximized')
    return off
  }, [isWindows])

  const sendIpc = (channel: string) => () => {
    if (typeof window !== 'undefined' && window.ipc) window.ipc.send(channel)
  }

  return (
    <header
      className="h-[64px] w-full flex items-stretch shrink-0 border-b border-solid border-gray-main"
      style={{
        ...drag,
        // Figma 967:12202 — near-vertical primary-dark → primary-deep gradient.
        backgroundImage: 'linear-gradient(179.32deg, #2E434E 0%, #1F2F38 100%)',
      }}
    >
      {/* LEFT 200px — Mac: traffic lights (left) + Org block (right) via justify-between.
          Windows: org block left-aligned. macOS draws its own traffic lights via
          titleBarStyle:'hiddenInset' on top of the spacer below. */}
      <div
        className="w-[200px] flex items-center"
        style={{
          ...drag,
          paddingTop: 15,
          paddingBottom: 15,
          paddingLeft: 16,
          paddingRight: 16,
          justifyContent: isMac ? 'space-between' : 'flex-start',
        }}
      >
        {isMac && <div style={{ width: 52, height: 12 }} aria-hidden />}
        {orgName && (
          <OrgBlock
            orgName={orgName}
            triggerRef={orgTriggerRef}
            onClick={() => {
              if (orgRect) {
                setOrgRect(null)
                return
              }
              setOrgRect(
                orgTriggerRef.current?.getBoundingClientRect() ?? null
              )
              onOrgClick?.()
            }}
          />
        )}
      </div>

      {/* CENTER — nav arrows + greeting */}
      <div className="flex-1 min-w-0 flex items-center gap-[20px] px-[25px]" style={drag}>
        <div className="flex items-center gap-[10px] shrink-0" style={noDrag}>
          <button
            type="button"
            onClick={() => {
              if (nav.canBack) nav.back()
              else onBack?.()
            }}
            disabled={!nav.canBack}
            className="p-1 rounded text-primary-light hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (nav.canForward) nav.forward()
              else onForward?.()
            }}
            disabled={!nav.canForward}
            className="p-1 rounded text-primary-light hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
            aria-label="Forward"
          >
            <Icon name="ArrowRight" size={15} />
          </button>
        </div>
        {hasGreeting && (
          <div className="flex flex-col gap-[5px] min-w-0 flex-1" style={drag}>
            {eyebrow && (
              <p className="text-gray-secondary text-[10px] font-medium uppercase tracking-[1.5px] truncate">
                {eyebrow}
              </p>
            )}
            {title && <p className="text-white text-[14px] font-semibold truncate">{title}</p>}
          </div>
        )}
      </div>

      {/* RIGHT — actions */}
      <div
        className="flex items-center gap-[10px] pl-[10px] shrink-0"
        style={{ ...noDrag, paddingRight: isWindows ? 0 : 16 }}
      >
        <div className="w-[500px] max-w-[45vw]" style={noDrag}>
          <GlobalSearchDropdown />
        </div>
        <Button
          variant="ghost"
          size="compact"
          iconLeft="Sparkle"
          iconLeftClassName={aiBusy ? 'ai-sparkle-anim' : undefined}
          onClick={onAskAi}
        >
          {aiOpen ? 'Hide AI' : 'Ask AI'}
        </Button>
        <Button variant="primary" size="compact" iconLeft="Add" onClick={onCreateNew}>
          Create new
        </Button>
        <button
          ref={notifTriggerRef}
          type="button"
          onClick={() => {
            if (notifRect) {
              setNotifRect(null)
              return
            }
            setNotifRect(
              notifTriggerRef.current?.getBoundingClientRect() ?? null
            )
            onNotifications?.()
          }}
          style={noDrag}
          className="relative inline-flex items-center justify-center text-primary-light p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Notifications"
        >
          <Icon name="Notification" size={18} />
          {(hasUnreadNotifs || hasNotifications) && (
            <span className="absolute top-1 right-1 w-[5px] h-[5px] rounded-full bg-red-notification" />
          )}
        </button>
        <button
          ref={avatarTriggerRef}
          type="button"
          onClick={() => {
            if (avatarRect) {
              setAvatarRect(null)
              return
            }
            setAvatarRect(
              avatarTriggerRef.current?.getBoundingClientRect() ?? null
            )
            onAvatarClick?.()
          }}
          style={noDrag}
          className="relative bg-primary-main text-white rounded-full w-[28px] h-[28px] inline-flex items-center justify-center text-[12px] font-semibold uppercase shrink-0"
        >
          {userInitials}
          {/* Status dot — same source/colors as the sidebar avatar; dark
              border matches the header's dark gradient so the dot pops
              against the avatar but blends into the header background. */}
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: 10,
              height: 10,
              right: -1,
              bottom: -1,
              backgroundColor: PRESENCE_DOT[presence],
              border: '1.5px solid #1F2F38',
            }}
          />
        </button>
      </div>

      {/* WINDOWS caption controls (min / max / close) */}
      {isWindows && (
        <div className="flex items-stretch shrink-0" style={noDrag}>
          <CaptionButton onClick={sendIpc('window-minimize')} ariaLabel="Minimize">
            <MinIcon />
          </CaptionButton>
          <CaptionButton
            onClick={sendIpc('window-maximize')}
            ariaLabel={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <RestoreIcon /> : <MaxIcon />}
          </CaptionButton>
          <CaptionButton
            variant="close"
            onClick={sendIpc('window-close')}
            ariaLabel="Close"
          >
            <CloseIcon />
          </CaptionButton>
        </div>
      )}

      {/* Floating: org switcher + notification panel + profile dropdown */}
      <OrgSwitcherDropdown
        anchorRect={orgRect}
        onClose={() => setOrgRect(null)}
      />
      <NotificationDropdown
        anchorRect={notifRect}
        onClose={() => setNotifRect(null)}
        userId={currentUser?.id}
      />
      <ProfileDropdown
        anchorRect={avatarRect}
        placement="bottom"
        userInitials={userInitials}
        userName={headerUserName}
        userEmail={currentUser?.email}
        presence={presence}
        onPresenceChange={(next) => setPresence(next)}
        onMyPage={() => {
          setAvatarRect(null)
          router.push('/my/overview')
        }}
        onClose={() => setAvatarRect(null)}
      />
    </header>
  )
}
