import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useState,
} from 'react'
import Icon from './Icon'

type Variant =
  | 'default'
  | 'translucent'
  | 'search'
  | 'search-dark'
  | 'error'
  | 'disabled'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** Label text or ReactNode (e.g. for colored asterisks). */
  label?: ReactNode
  variant?: Variant
  errorMessage?: string
  /** Search variant only — show clear icon when value is non-empty */
  onClear?: () => void
}

const labelBase =
  'font-sans text-[10px] font-medium uppercase tracking-[1.5px] w-full'

const labelColor: Record<Variant, string> = {
  default: 'text-gray-main',
  translucent: 'text-gray-secondary',
  search: 'text-gray-main',
  'search-dark': 'text-gray-secondary',
  error: 'text-red-main',
  disabled: 'text-gray-main',
}

const fieldBase =
  'flex h-[32px] items-center w-full min-w-[240px] px-4 py-3 rounded-lg border border-solid font-sans text-[12px] outline-none transition-colors'

const fieldByVariant: Record<Variant, string> = {
  default: 'bg-white-white border-gray-border text-black focus:border-primary-main',
  translucent:
    'bg-white/10 border-gray-border text-white placeholder:text-gray-main backdrop-blur-[10px] focus:border-white/50',
  search: 'bg-white-white border-gray-border text-black focus:border-primary-main',
  'search-dark':
    'bg-white/10 border-gray-main text-white-white focus:border-white/40',
  error: 'bg-white-white border-red-main text-black',
  disabled: 'bg-gray-disabled border-gray-border text-gray-main cursor-not-allowed',
}

export default function Input({
  label,
  variant = 'default',
  errorMessage,
  onClear,
  className,
  value,
  ...rest
}: Props) {
  const [internal, setInternal] = useState('')
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internal

  const isSearch = variant === 'search' || variant === 'search-dark'
  const isDisabled = variant === 'disabled' || rest.disabled

  return (
    <div className={`flex flex-col gap-[5px] w-full max-w-[280px] ${className ?? ''}`}>
      {label && (
        <label className={`${labelBase} ${labelColor[variant]}`}>{label}</label>
      )}
      <div className={`${fieldBase} ${fieldByVariant[variant]}`}>
        {isSearch && (
          <Icon name="Search" size={15} style={{ color: '#94A0AA', marginRight: 5 }} />
        )}
        <input
          {...rest}
          value={currentValue}
          disabled={isDisabled}
          onChange={(e) => {
            if (!isControlled) setInternal(e.target.value)
            rest.onChange?.(e)
          }}
          placeholder={rest.placeholder ?? (isSearch ? 'Search for…' : undefined)}
          className="flex-1 min-w-0 bg-transparent outline-none border-none placeholder:text-gray-secondary disabled:cursor-not-allowed"
        />
        {isSearch && currentValue && (
          <button
            type="button"
            onClick={() => {
              if (!isControlled) setInternal('')
              // Always notify the parent's onChange with an empty value so
              // controlled inputs reset even if `onClear` isn't provided.
              if (rest.onChange) {
                const synthetic = {
                  target: { value: '' },
                  currentTarget: { value: '' },
                } as unknown as ChangeEvent<HTMLInputElement>
                rest.onChange(synthetic)
              }
              onClear?.()
            }}
            className="ml-1 inline-flex items-center justify-center bg-gray-border rounded-full text-white hover:bg-gray-main transition-colors"
            style={{ width: 15, height: 15 }}
            aria-label="Clear"
          >
            <Icon name="Cross" size={9} />
          </button>
        )}
      </div>
      {variant === 'error' && errorMessage && (
        <p className="text-red-main text-[11px] font-sans">{errorMessage}</p>
      )}
    </div>
  )
}
