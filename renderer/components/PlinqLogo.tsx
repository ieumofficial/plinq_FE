type Props = {
  size?: 'big' | 'medium'
}

/**
 * Plinq logo: 4 colored squares + gradient "plinq" text.
 * "big" is used on the login page, "medium" on other pages.
 */
export default function PlinqLogo({ size = 'medium' }: Props) {
  const isBig = size === 'big'

  const squareSize = isBig ? 14 : 10
  const gap = isBig ? 4 : 3
  const textSize = isBig ? 'text-[48px]' : 'text-[32px]'
  const containerGap = isBig ? 'gap-4' : 'gap-3'

  return (
    <div className={`flex items-center ${containerGap}`}>
      {/* 4 colored squares in a 2x2 grid */}
      <div
        className="grid grid-cols-2"
        style={{ gap: `${gap}px` }}
      >
        <div
          className="rounded-[2px]"
          style={{
            width: squareSize,
            height: squareSize,
            backgroundColor: '#2D5A9E',
          }}
        />
        <div
          className="rounded-[2px]"
          style={{
            width: squareSize,
            height: squareSize,
            backgroundColor: '#5B7FB6',
          }}
        />
        <div
          className="rounded-[2px]"
          style={{
            width: squareSize,
            height: squareSize,
            backgroundColor: '#5B3D8A',
          }}
        />
        <div
          className="rounded-[2px]"
          style={{
            width: squareSize,
            height: squareSize,
            backgroundColor: '#455E6A',
          }}
        />
      </div>

      {/* Gradient "plinq" text */}
      <span
        className={`${textSize} font-bold leading-none bg-clip-text text-transparent select-none`}
        style={{
          backgroundImage:
            'linear-gradient(135deg, #5B7FB6 0%, #DDE7F4 50%, #94A0AA 100%)',
        }}
      >
        plinq
      </span>
    </div>
  )
}
