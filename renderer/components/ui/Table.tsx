import type { ReactNode } from 'react'

export type Column = {
  key: string
  label: string
  /** Tailwind width class (e.g. 'w-[120px]', 'flex-1') or arbitrary string. */
  width?: string
  align?: 'left' | 'center' | 'right'
}

type TableProps = {
  children: ReactNode
  className?: string
}

export default function Table({ children, className }: TableProps) {
  return (
    <div className={`bg-white-white rounded-[5px] border border-gray-border-light overflow-hidden ${className ?? ''}`}>
      {children}
    </div>
  )
}

type HeaderProps = {
  columns: Column[]
}

const alignClass = {
  left: 'text-left justify-start',
  center: 'text-center justify-center',
  right: 'text-right justify-end',
}

export function TableHeader({ columns }: HeaderProps) {
  return (
    <div className="flex items-center bg-white-item border-b-2 border-solid border-gray-border-light px-[25px] py-[10px]">
      {columns.map((c) => (
        <div
          key={c.key}
          className={`flex items-center ${alignClass[c.align ?? 'left']} ${c.width ?? 'flex-1'}`}
        >
          <span className="text-gray-main text-[12px] font-medium uppercase tracking-[1.5px]">
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
      className={`flex items-center px-[25px] py-[10px] ${
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
      className={`flex items-center gap-[10px] ${alignClass[align]} ${width ?? 'flex-1'} ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
