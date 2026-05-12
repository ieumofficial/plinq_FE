import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

type Variant = 'primary' | 'secondary' | 'subtle' | 'tertiary'
type Size = 'default' | 'compact' | 'mini'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: Variant
  size?: Size
  iconLeft?: IconName
  iconRight?: IconName
  iconOnly?: IconName
  children?: ReactNode
}

const base =
  'inline-flex items-center justify-center font-sans whitespace-nowrap transition-colors disabled:cursor-not-allowed'

const variantStyles: Record<Variant, { enabled: string; disabled: string }> = {
  primary: {
    enabled: 'bg-primary-main text-white-main hover:bg-primary-dark',
    disabled: 'bg-primary-main/30 text-white-main',
  },
  secondary: {
    enabled:
      'bg-white-white border border-gray-border-light text-black hover:bg-white-main',
    disabled: 'bg-gray-disabled border border-gray-border-light text-gray-secondary',
  },
  subtle: {
    enabled: 'bg-white-white text-black hover:bg-white-main',
    disabled: 'text-gray-secondary',
  },
  tertiary: {
    enabled:
      'bg-white-main border border-gray-border-light text-black hover:bg-gray-extra-light',
    disabled: 'bg-white-main border border-gray-border-light text-gray-secondary',
  },
}

const sizeStyles: Record<Size, { padding: string; text: string; gap: string; rounded: string }> = {
  default: {
    padding: 'px-[15px] py-[10px]',
    text: 'text-[12px] font-semibold',
    gap: 'gap-[5px]',
    rounded: 'rounded-[5px]',
  },
  compact: {
    padding: 'h-[32px] px-[10px] py-[7px]',
    text: 'text-[12px] font-normal',
    gap: 'gap-[5px]',
    rounded: 'rounded-[5px]',
  },
  mini: {
    padding: 'pl-[10px] pr-[5px] py-[5px]',
    text: 'text-[10px] font-normal uppercase leading-none',
    gap: 'gap-[5px]',
    rounded: 'rounded-[5px]',
  },
}

const iconOnlyPadding: Record<Size, string> = {
  default: 'p-[10px]',
  compact: 'p-[10px] h-[32px]',
  mini: 'p-[5px]',
}

export default function Button({
  variant = 'primary',
  size = 'default',
  iconLeft,
  iconRight,
  iconOnly,
  children,
  className,
  disabled,
  ...rest
}: Props) {
  const v = variantStyles[variant]
  const s = sizeStyles[size]
  const isIconOnly = !!iconOnly

  const cls = [
    base,
    s.gap,
    s.rounded,
    s.text,
    isIconOnly ? iconOnlyPadding[size] : s.padding,
    disabled ? v.disabled : v.enabled,
    className ?? '',
  ]
    .join(' ')
    .trim()

  const iconSize = size === 'mini' ? 12 : 15

  return (
    <button type="button" disabled={disabled} className={cls} {...rest}>
      {iconOnly ? (
        <Icon name={iconOnly} size={iconSize} />
      ) : (
        <>
          {iconLeft && <Icon name={iconLeft} size={iconSize} />}
          {children}
          {iconRight && <Icon name={iconRight} size={iconSize} />}
        </>
      )}
    </button>
  )
}
