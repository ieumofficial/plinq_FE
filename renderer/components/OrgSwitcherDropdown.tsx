/**
 * Org switcher popover anchored to the header's org block. Matches Figma
 * 1004:11665. Shows the current org with Settings + Invite buttons, a list of
 * other orgs the user belongs to, and a "New organization" entry.
 *
 * Renders as `position: fixed` so it floats above the header / page.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Icon from './ui/Icon'
import CreateOrganizationModal from './CreateOrganizationModal'
import { useActiveOrg, useCurrentUser, useMyOrgsWithStats } from '../lib/hooks'
import { setActiveOrgId } from '../lib/activeOrgStore'

type Props = {
  /** Trigger element's bounding rect. Null = closed. */
  anchorRect: DOMRect | null
  onClose: () => void
}

export default function OrgSwitcherDropdown({ anchorRect, onClose }: Props) {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const currentOrg = useActiveOrg(user?.id)
  const { data: allOrgs = [] } = useMyOrgsWithStats(user?.id)

  const ref = useRef<HTMLDivElement>(null)
  const [createOpen, setCreateOpen] = useState(false)
  useEffect(() => {
    if (!anchorRect) return
    // Pause the outside-click + Esc + scroll handlers while the create-org
    // modal is open, otherwise interacting with it would close the dropdown
    // (and unmount the modal with it).
    if (createOpen) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScrollOrResize() {
      onClose()
    }
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick)
    }, 0)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [anchorRect, onClose, createOpen])

  if (!anchorRect || typeof window === 'undefined') return null

  const otherOrgs = allOrgs.filter((o) => o.id !== currentOrg?.id)
  const currentName = currentOrg?.name ?? 'Organization'
  const currentInitial = currentName.charAt(0).toUpperCase()
  const currentMemberCount =
    allOrgs.find((o) => o.id === currentOrg?.id)?.memberCount ?? null

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 8,
    left: anchorRect.left,
    width: 268,
    zIndex: 100,
  }

  return (
    <div
      ref={ref}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className="bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[15px] flex flex-col gap-[15px]"
    >
      {/* Current org block */}
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center gap-[5.75px]">
          <span className="bg-primary-main text-white rounded-[2.6px] w-[30px] h-[30px] inline-flex items-center justify-center text-[15.6px] font-semibold uppercase shrink-0">
            {currentInitial}
          </span>
          <div className="flex flex-col gap-[2px]">
            <p className="text-black text-[14px] font-semibold leading-none">
              {currentName}
            </p>
            <p
              className="text-gray-secondary text-[10px] leading-[1.2]"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              Free Plan
              {currentMemberCount !== null
                ? ` · ${currentMemberCount} ${currentMemberCount === 1 ? 'member' : 'members'}`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-[10px]">
          <button
            type="button"
            onClick={() => {
              if (currentOrg?.id) router.push(`/o/${currentOrg.id}/settings`)
              onClose()
            }}
            disabled={!currentOrg?.id}
            className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[7px] flex items-center gap-[5px] text-black text-[12px] hover:bg-white-item transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icon name="Settings" size={12} />
            Settings
          </button>
          <button
            type="button"
            onClick={() => {
              if (currentOrg?.id) router.push(`/o/${currentOrg.id}/members`)
              onClose()
            }}
            disabled={!currentOrg?.id}
            className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[7px] flex items-center gap-[5px] text-black text-[12px] hover:bg-white-item transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icon name="Invite" size={12} />
            Invite members
          </button>
        </div>
      </div>

      <div className="h-px bg-gray-border-light w-full" />

      {/* Other orgs list + new org */}
      <div className="flex flex-col gap-[10px]">
        {otherOrgs.length === 0 ? (
          <p className="text-gray-secondary text-[11px]">
            You only belong to one organization.
          </p>
        ) : (
          otherOrgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setActiveOrgId(o.id)
                router.push(`/o/${o.id}/dashboard`)
                onClose()
              }}
              className="flex items-center gap-[5px] -mx-[2px] px-[2px] py-[1px] rounded hover:bg-white-item text-left"
            >
              <span className="bg-gray-disabled text-gray-secondary rounded-[1.5px] w-[18px] h-[18px] inline-flex items-center justify-center text-[9.4px] font-semibold uppercase shrink-0">
                {o.name.charAt(0)}
              </span>
              <span className="text-black text-[12px] capitalize truncate">
                {o.name}
              </span>
            </button>
          ))
        )}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[10px] py-[7px] flex items-center gap-[5px] text-black text-[12px] hover:bg-white-item transition-colors w-fit"
        >
          <Icon name="Add" size={12} />
          New organization
        </button>
      </div>

      <CreateOrganizationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setActiveOrgId(id)
          router.push(`/o/${id}/dashboard`)
          onClose()
        }}
      />
    </div>
  )
}
