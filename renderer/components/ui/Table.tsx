import type { ReactNode } from 'react'

export type Column = {
  key: string
  label: string
  /** Tailwind width class (e.g. 'w-[120px]', 'flex-1') or arbitrary string. */
  width?: string
  align?: 'left' | 'center' | 'right'
  /** Extra classes applied to the header cell (e.g. 'ml-[20px]' to nudge the
   *  column heading so it lines up with a cell that has the same offset). */
  className?: string
}

type TableProps = {
  children: ReactNode
  className?: string
}

export default function Table({ children, className }: TableProps) {
  return (
    <div
      className={`bg-white-white rounded-[10px] border border-gray-border-light ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

type HeaderProps = {
  columns: Column[]
  className?: string
}

const alignClass = {
  left: 'text-left justify-start',
  center: 'text-center justify-center',
  right: 'text-right justify-end',
}

// Default gap between cells. Pages can override with `!gap-[...]` via className.
// Was 80px which forced horizontal scroll on most laptop widths — 24px lets
// the table fit ~13"–15" laptops comfortably while still feeling airy.
const DEFAULT_GAP = 'gap-[24px]'

export function TableHeader({ columns, className }: HeaderProps) {
  return (
    <div
      className={`flex items-center ${DEFAULT_GAP} bg-white-item border-b-2 border-solid border-gray-border-light px-[25px] py-[10px] ${className ?? ''}`}
    >
      {columns.map((c) => (
        <div
          key={c.key}
          className={`flex items-center min-w-0 ${alignClass[c.align ?? 'left']} ${c.width ?? 'flex-1'} ${c.className ?? ''}`}
        >
          <span className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] truncate">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  )
}

type RowProps = {
  children: ReactNode
  /** Suppress bottom border (for the last row in a group). */
  isLast?: boolean
  onClick?: () => void
  className?: string
}

export function TableRow({ children, isLast = false, onClick, className }: RowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center ${DEFAULT_GAP} px-[25px] py-[10px] ${
        isLast ? '' : 'border-b border-solid border-gray-border-light'
      } ${onClick ? 'cursor-pointer hover:bg-white-item' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

type CellProps = {
  children: ReactNode
  /** Match Column.width. */
  width?: string
  align?: 'left' | 'center' | 'right'
  className?: string
}

export function TableCell({ children, width, align = 'left', className }: CellProps) {
  return (
    <div
      className={`flex items-center gap-[10px] min-w-0 ${alignClass[align]} ${width ?? 'flex-1'} ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
