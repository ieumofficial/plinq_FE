import { useEffect, useState, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import ProjectLabel from './ProjectLabel'
import StatusLabelBig, { type Status } from './StatusLabelBig'
import { getLastSpaceId, type SpaceId } from '../../lib/sidebarPref'

export type StackedNavItem = {
  key: string
  icon: IconName
  label: string
  count?: number
}

type ProjectHeader = {
  kind: 'project'
  /** Initial shown in the colored badge. */
  initial: string
  /** Hex color for the badge background. */
  color: string
  name: string
  /** Subtitle line (e.g. "Auth migration · Q2 2026"). */
  subtitle?: string
  /** Status pill below the title. */
  status?: Status
  /** Click handler for the dropdown chevron / name area (project switcher). */
  onSwitch?: () => void
  /** True while the project switcher dropdown is open — used to flip the chevron. */
  switchOpen?: boolean
  /** Click handler for the status pill (status switcher). */
  onStatusClick?: () => void
}

type OrgHeader = {
  kind: 'org'
  initial: string
  color: string
  name: string
  /** e.g. "108 members total" */
  subtitle?: string
  onSwitch?: () => void
  switchOpen?: boolean
}

type Props = {
  /** Header section content varies by space type. */
  header: ProjectHeader | OrgHeader
  items: StackedNavItem[]
  activeKey?: string
  onItemClick?: (key: string) => void
  onBack?: () => void
  /** Optional extra content rendered absolutely positioned (e.g. status switcher popover). */
  overlay?: ReactNode
  /** Identifier for the current space. When the panel remounts within the
   *  same space (page-to-page navigation), it renders fully open; when the
   *  space changes (e.g. switching projects), it replays the slide-in. */
  spaceId?: SpaceId
  /** Persistent collapsed flag — true renders a thin icon-only rail with
   *  motion when toggled. */
  collapsed?: boolean
  /** Toggle handler for the collapse / expand button. When provided, a
   *  "Toggle sidebar" row is rendered at the bottom of the panel. */
  onToggle?: () => void
}

const EXPANDED_W = 210
const COLLAPSED_W = 50

/**
 * 210px secondary side menu used inside Project / Organization Space. Sits
 * to the right of the narrow main rail. Animates between expanded (full nav)
 * and collapsed (icon-only rail) states when toggled.
 */
export default function StackedSideMenu({
  header,
  items,
  activeKey,
  onItemClick,
  onBack,
  overlay,
  spaceId,
  collapsed = false,
  onToggle,
}: Props) {
  const isProject = header.kind === 'project'
  const sectionLabel = isProject ? 'Project' : 'Organization'

  // Slide-in plays on first paint AND whenever the space id changes
  // (Personal → project, project A → project B, project → org, etc.).
  // Page-to-page navigation *within* the same space — where `useSpaceTransition`
  // has already marked lastSpaceId as the same value — skips the animation
  // and renders fully open immediately.
  const [open, setOpen] = useState(
    () => spaceId !== undefined && getLastSpaceId() === spaceId
  )
  useEffect(() => {
    if (open) return
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  const width = open ? (collapsed ? COLLAPSED_W : EXPANDED_W) : 0

  return (
    <aside
      style={{ width }}
      className="bg-[#F4F6F8] border-t border-r border-[#E6EAEE] shrink-0 h-full flex flex-col relative overflow-hidden transition-[width] duration-200 ease-in-out"
    >
      {/* BACK — hidden in collapsed mode. */}
      {!collapsed && (
        <>
          <div className="flex flex-col items-start py-[5px]">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] text-black hover:bg-white-white/60"
            >
              <Icon name="ArrowLeft" size={15} />
              <span className="text-[10px] uppercase leading-none">back</span>
            </button>
          </div>

          <div className="h-px bg-[#E6EAEE] w-full" />

          {/* Header section — project / org details */}
          <div className="flex flex-col gap-[10px] p-[15px]">
            <div className="flex flex-col gap-[5px]">
              <p className="text-primary-main text-[10px] font-medium uppercase tracking-[1.5px]">
                {sectionLabel}
              </p>
              {isProject ? (
                <button
                  type="button"
                  onClick={header.onSwitch}
                  className="flex items-center gap-[5px] h-[19.32px] -mx-[2px] px-[2px] rounded hover:bg-white-white/60"
                >
                  <ProjectLabel
                    name={header.initial}
                    color={header.color}
                    size="sm"
                  />
                  <span className="text-black text-[14px] font-semibold">
                    {header.name}
                  </span>
                  <Icon
                    name="ArrowRight"
                    size={11}
                    className={`text-black transition-transform ${
                      header.switchOpen ? '-rotate-90' : 'rotate-90'
                    }`}
                  />
                </button>
              ) : (
                // Org header: static, non-interactive — no switcher, no
                // chevron. Solid org-colour badge (white letter) so it matches
                // the header + settings treatment. #2D5A9E is the shared org
                // colour placeholder until the organizations.color migration
                // lands and this becomes DB-driven.
                <div className="flex items-center gap-[5px] h-[19.32px]">
                  <span
                    className="inline-flex items-center justify-center font-bold uppercase text-white shrink-0"
                    style={{
                      width: 20,
                      height: 20,
                      fontSize: '12px',
                      borderRadius: '3px',
                      backgroundColor: '#2D5A9E',
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                    }}
                  >
                    {(header.initial?.charAt(0) ?? '?').toUpperCase()}
                  </span>
                  <span className="text-black text-[14px] font-semibold">
                    {header.name}
                  </span>
                </div>
              )}
              {header.subtitle && (
                <p className="text-gray-secondary text-[10px] leading-[1.5]">
                  {header.subtitle}
                </p>
              )}
            </div>
            {isProject && header.status && (
              <button
                type="button"
                onClick={header.onStatusClick}
                className="self-start"
              >
                <StatusLabelBig status={header.status} size="md" />
              </button>
            )}
          </div>

          <div className="h-px bg-[#E6EAEE] w-full" />
        </>
      )}

      {/* In collapsed mode, give the collapsed nav a touch of top padding so
          the first icon doesn't kiss the panel's top border. */}
      {collapsed && <div className="h-[10px] shrink-0" />}

      {/* Nav */}
      <nav
        className={
          collapsed
            ? 'flex flex-col items-center gap-[5px] py-[5px]'
            : 'flex flex-col gap-[5px] px-[7px] py-[10px]'
        }
      >
        {items.map((it) => {
          const isActive = it.key === activeKey
          if (collapsed) {
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onItemClick?.(it.key)}
                title={it.label}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center justify-center w-[34px] h-[34px] rounded-[5px] transition-colors ${
                  isActive
                    ? 'bg-white-white border border-solid border-gray-border text-black'
                    : 'text-primary-main hover:bg-white-white/60'
                }`}
              >
                <Icon name={it.icon} size={15} />
              </button>
            )
          }
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onItemClick?.(it.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center justify-between px-[10px] py-[7px] rounded-[5px] w-full transition-colors ${
                isActive
                  ? 'bg-white-white border border-solid border-gray-border text-black'
                  : 'text-primary-main hover:bg-white-white/60'
              }`}
            >
              <span className="flex items-center gap-[10px]">
                <Icon name={it.icon} size={15} />
                <span
                  className={`text-[12px] whitespace-nowrap ${
                    isActive ? 'font-semibold' : 'font-normal'
                  }`}
                >
                  {it.label}
                </span>
              </span>
              <span
                className={`text-[12px] font-medium tracking-[-0.27px] text-gray-secondary ${
                  it.count === undefined ? 'opacity-0' : ''
                }`}
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {it.count ?? 0}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Footer — Toggle sidebar */}
      {onToggle && (
        <div
          className={
            collapsed
              ? 'mt-auto flex justify-center py-[10px]'
              : 'mt-auto flex flex-col px-[7px] py-[10px]'
          }
        >
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={
              collapsed
                ? 'inline-flex items-center justify-center w-[34px] h-[34px] rounded-[5px] text-primary-main hover:bg-white-white/60 transition-colors'
                : 'flex items-center justify-between p-[10px] rounded-[5px] w-full text-primary-main hover:bg-white-white/60 transition-colors'
            }
          >
            {collapsed ? (
              <Icon name="Sidebar" size={15} />
            ) : (
              <span className="flex items-center gap-[10px]">
                <Icon name="Sidebar" size={15} />
                <span className="text-[12px] whitespace-nowrap">
                  Toggle sidebar
                </span>
              </span>
            )}
          </button>
        </div>
      )}

      {overlay}
    </aside>
  )
}
