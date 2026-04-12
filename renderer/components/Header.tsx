import { type CSSProperties, useEffect, useRef, useState } from 'react'
import Logo from './Logo'
import CreateNewModal, { type CreateNewType } from './CreateNewModal'
import { ArrowDownIcon, NotificationIcon, UserIcon } from './icons'

// Make the entire Header act as the macOS title bar (draggable area).
// Interactive children opt out via `noDrag` so they remain clickable.
const drag: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

export const HEADER_HEIGHT = 103

/**
 * Top header bar shown on all authenticated pages.
 * Matches Figma node 122:2279 — 1728 × 103 px design canvas, but rendered
 * at fixed pixel sizes so it stays the same size regardless of window size.
 * Spans the full window width and doubles as the draggable title bar.
 */
const createMenuItems: { label: string; type: CreateNewType }[] = [
  { label: 'Meeting Minute', type: 'meeting' },
  { label: 'Team', type: 'team' },
  { label: 'Project', type: 'project' },
  { label: 'Task', type: 'task' },
]

export default function Header() {
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<CreateNewType | null>(null)
  const createMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false)
      }
    }
    if (createMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [createMenuOpen])

  return (
    <>
    <header
      style={drag}
      className="fixed top-0 left-0 right-0 h-[103px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg overflow-visible z-10"
      data-name="Header"
    >
      {/* Logo (Figma: left=30, top=24, 53×55) */}
      <Logo className="absolute left-[30px] top-[24px] w-[53px] h-[55px]" />

      {/* Plow brand text (Figma: left=107, top=29, 38.38px) */}
      <p className="absolute left-[107px] top-[29px] font-display text-[38.38px] leading-none text-black whitespace-nowrap">
        Plow
      </p>

      {/* Global search — fluid width between left:308 and the right cluster */}
      <div
        style={noDrag}
        className="absolute left-[308px] right-[335px] top-[18px] h-[64px] bg-white border border-[#afb1b6] rounded-[10px] flex items-center px-[12px] py-[13px]"
      >
        <input
          type="text"
          placeholder="Global Search"
          className="w-full bg-transparent outline-none font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black placeholder:text-[#afb1b6]"
        />
      </div>

      {/* Right-side cluster: + Create New, notification bell, profile.
          Anchored to the right edge so they hug the window edge no matter
          how wide the window grows. */}
      <div className="absolute right-[13px] top-0 h-[103px] flex items-center">
        <div ref={createMenuRef} className="relative mr-[19px]" style={noDrag}>
          <button
            type="button"
            onClick={() => setCreateMenuOpen((prev) => !prev)}
            className="flex items-center justify-center gap-[10px] bg-black text-white rounded-[16px] px-[20px] py-[16px] overflow-hidden cursor-pointer"
          >
            <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
              + Create New...
            </span>
            <ArrowDownIcon className="w-[24px] h-[24px]" />
          </button>

          {createMenuOpen && (
            <div className="absolute right-0 top-full mt-[4px] w-[175px] bg-[#d9d9d9] flex flex-col items-center p-[20px] gap-[10px] z-50">
              {createMenuItems.map((item, idx) => (
                <div key={item.type} className="w-full flex flex-col items-center gap-[10px]">
                  {idx > 0 && <div className="w-full h-[1px] bg-[#afb1b6]" />}
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMenuOpen(false)
                      setActiveModal(item.type)
                    }}
                    className="font-sans font-medium text-[20px] leading-[24px] tracking-[0.2px] text-black text-center whitespace-nowrap bg-transparent border-0 cursor-pointer w-full"
                  >
                    {item.label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          style={noDrag}
          className="mr-[10px] relative w-[35px] h-[35px] flex items-center justify-center cursor-pointer"
          aria-label="Notifications"
        >
          <NotificationIcon className="w-[28px] h-[28px] text-black" />
          <span className="absolute top-[3px] right-[5px] w-[9px] h-[9px] rounded-full bg-red-500 border-2 border-[#efeff0]" />
        </button>

        <button
          type="button"
          style={noDrag}
          className="w-[45px] h-[45px] rounded-full border-[1.667px] border-black bg-white flex items-center justify-center cursor-pointer"
          aria-label="Profile"
        >
          <UserIcon className="w-[24px] h-[24px] text-black" />
        </button>
      </div>
    </header>

    {activeModal && (
      <CreateNewModal type={activeModal} onClose={() => setActiveModal(null)} />
    )}
    </>
  )
}
