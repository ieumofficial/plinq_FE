/**
 * Selectable option row used in single-select pickers (e.g. choosing how to
 * add members to a chat: pick directly vs assign to project).
 *
 * Figma "Option" frame (id 1172:14825): 289×62, p-15, rounded-5.
 * - Left: 29×29 icon tile (bg becomes #E6ECEF when selected) + title/subtitle stack
 * - Right: 12×12 Radio
 */

import Icon, { type IconName } from './Icon'
import Radio from './Radio'

type Props = {
  icon: IconName
  title: string
  subtitle?: string
  selected?: boolean
  onSelect?: () => void
  className?: string
}

export default function Option({
  icon,
  title,
  subtitle,
  selected = false,
  onSelect,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-center justify-between p-[15px] rounded-[5px] w-full text-left transition-colors ${
        selected ? 'bg-white-white' : 'hover:bg-white-white/60'
      } ${className ?? ''}`}
    >
      <span className="flex items-center gap-[10px]">
        <span
          className={`inline-flex items-center justify-center p-[7px] rounded-[5px] shrink-0 ${
            selected ? 'bg-primary-light text-black' : 'text-gray-main'
          }`}
        >
          <Icon name={icon} size={15} />
        </span>
        <span className="flex flex-col gap-[3px]">
          <span
            className={`text-[12px] font-semibold leading-none ${
              selected ? 'text-black' : 'text-gray-main'
            }`}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className={`text-[10px] leading-[1.5] ${
                selected ? 'text-gray-main' : 'text-gray-main'
              }`}
            >
              {subtitle}
            </span>
          )}
        </span>
      </span>
      <Radio selected={selected} />
    </button>
  )
}
