import { useEffect, useRef, useState } from 'react'
import type { OrgRoleDb } from '../lib/types'

type Props = {
  /** Trigger button's bounding rect. Null when closed. */
  anchorRect: DOMRect | null
  current: OrgRoleDb
  /** Owner cannot be reassigned through this dropdown; if the current role
   *  is owner we render disabled. */
  onClose: () => void
  onSave: (next: OrgRoleDb) => void
}

const OPTIONS: { key: OrgRoleDb; label: string; bg: string; desc: string }[] = [
  {
    key: 'admin',
    label: 'Admin',
    bg: 'bg-gray-main',
    desc: 'Full access to the organization — members, settings.',
  },
  {
    key: 'member',
    label: 'Member',
    bg: 'bg-gray-light',
    desc: 'Standard access to projects shared with them.',
  },
]

export default function PermissionDropdown({
  anchorRect,
  current,
  onClose,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<OrgRoleDb>(current)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelected(current)
  }, [current])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScrollOrResize() {
      onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [onClose])

  if (!anchorRect || typeof window === 'undefined') return null

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: Math.max(8, anchorRect.left),
    width: 190,
  }

  return (
    <div
      ref={ref}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className="z-50 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[10px] flex flex-col gap-[5px]"
    >
      <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
        set permission
      </p>
      {OPTIONS.map((opt) => {
        const isSel = selected === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSelected(opt.key)}
            className={`w-full flex flex-col gap-[5px] items-start px-[10px] py-[7px] rounded-[8px] text-left transition-colors ${
              isSel ? 'bg-primary-light' : 'bg-white-white hover:bg-white-item'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center px-[7px] py-[3px] rounded-[3px] ${opt.bg}`}
            >
              <span className="text-white text-[12px] font-semibold leading-none">
                {opt.label}
              </span>
            </span>
            <span className="text-black text-[8px] leading-[1.5]">{opt.desc}</span>
          </button>
        )
      })}
      <div className="border-t border-solid border-gray-border-light my-[3px]" />
      <div className="flex gap-[5px] w-full">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[15px] py-[5px] text-black text-[10px] hover:bg-white-item transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(selected)}
          disabled={selected === current}
          className="flex-1 bg-primary-main rounded-[5px] px-[15px] py-[5px] text-white text-[10px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}
