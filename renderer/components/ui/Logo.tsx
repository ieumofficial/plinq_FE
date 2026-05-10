type Variant = 'on-light' | 'on-dark' | 'icon-only'

type Props = {
  variant?: Variant
  size?: number
  className?: string
}

const ASPECT: Record<Variant, number> = {
  'on-light': 94 / 27,
  'on-dark': 94 / 27,
  'icon-only': 1,
}

export default function Logo({ variant = 'on-dark', size = 28, className }: Props) {
  const src = `/logo/${variant}.svg`
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt="plinq"
      className={className}
      style={{
        height: size,
        width: size * ASPECT[variant],
        display: 'block',
      }}
    />
  )
}
