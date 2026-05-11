import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import ProjectLabel from './ProjectLabel'
import StatusLabelBig, { type Status } from './StatusLabelBig'

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
}

/**
 * 210px-wide secondary side menu used inside Project Space and Organization Space.
 * Renders a stacked layout of: BACK · header section · nav items.
 *
 * Sits to the right of the narrow stacked main rail (`<SideMenu stacked />`).
 */
export default function StackedSideMenu({
  header,
  items,
  activeKey,
  onItemClick,
  onBack,
  overlay,
}: Props) {
  const isProject = header.kind === 'project'
  const sectionLabel = isProject ? 'Project' : 'Organization'

  return (
    <aside className="bg-[#F4F6F8] border-t border-r border-[#E6EAEE] w-[210px] shrink-0 h-full flex flex-col relative">
      {/* BACK */}
      <div className="flex flex-col items-start py-[5px]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] hover:bg-white-white/60"
        >
          <Icon name="ArrowLeft" size={15} />
          <span
            className="text-black text-[10px] uppercase leading-none"
          >
            back
          </span>
        </button>
      </div>

      <div className="h-px bg-[#E6EAEE] w-full" />

      {/* Header section */}
      <div className="flex flex-col gap-[10px] p-[15px]">
        <div className="flex flex-col gap-[5px]">
          <p className="text-primary-main text-[10px] font-medium uppercase tracking-[1.5px]">
            {sectionLabel}
          </p>
          <button
            type="button"
            onClick={header.onSwitch}
            className="flex items-center gap-[5px] h-[19.32px] -mx-[2px] px-[2px] rounded hover:bg-white-white/60"
          >
            <ProjectLabel name={header.initial} color={header.color} size="sm" />
            <span className="text-black text-[14px] font-semibold">
              {header.name}
            </span>
            <Icon name="ArrowRight" size={11} className="rotate-90" />
          </button>
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

      {/* Nav */}
      <nav className="flex flex-col gap-[5px] px-[7px] py-[10px]">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => onItemClick?.(it.key)}
            aria-current={it.key === activeKey ? 'page' : undefined}
            className={`flex items-center justify-between px-[10px] py-[7px] rounded-[5px] w-full transition-colors ${
              it.key === activeKey
                ? 'bg-white-white border border-solid border-gray-border text-black'
                : 'text-primary-main hover:bg-white-white/60'
            }`}
          >
            <span className="flex items-center gap-[10px]">
              <Icon name={it.icon} size={15} />
              <span
                className={`text-[12px] whitespace-nowrap ${
                  it.key === activeKey ? 'font-semibold' : 'font-normal'
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
        ))}
      </nav>

      {overlay}
    </aside>
  )
}
