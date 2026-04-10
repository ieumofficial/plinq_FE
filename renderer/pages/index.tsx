import type { CSSProperties } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import FitCanvas from '../components/FitCanvas'
import Logo from '../components/Logo'
import PlaceholderCross from '../components/PlaceholderCross'

const drag: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

/**
 * Landing page — Figma node 122:597.
 * Canvas: 1728 × 1117 px (matches the design exactly), auto-scaled to window.
 */
export default function LandingPage() {
  const router = useRouter()

  return (
    <>
      <Head>
        <title>Plow</title>
      </Head>
      <FitCanvas>
        {/* Top bar — also acts as the window's draggable title bar */}
        <div
          style={drag}
          className="absolute top-0 left-0 w-[100vw] h-[5.9606vw] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg overflow-hidden"
        >
          <Logo className="absolute left-[1.6204vw] top-[1.2731vw] w-[3.0671vw] h-[3.1829vw]" />

          <button
            type="button"
            style={noDrag}
            onClick={() => router.push('/signup')}
            className="absolute left-[82.5231vw] top-[1.331vw] flex items-center justify-center bg-black text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden"
          >
            <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
              Create Account
            </span>
          </button>
          <button
            type="button"
            style={noDrag}
            onClick={() => router.push('/login')}
            className="absolute left-[93.4028vw] top-[1.331vw] flex items-center justify-center bg-black text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden"
          >
            <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
              Log In
            </span>
          </button>
        </div>

        {/* Plow brand text */}
        <p className="absolute top-[10.5903vw] left-[calc(50%-8.4491vw)] font-display text-[7.4546vw] leading-none text-black whitespace-nowrap">
          Plow
        </p>

        {/* Main image placeholder */}
        <PlaceholderCross className="absolute top-[23.4954vw] left-1/2 -translate-x-1/2 w-[45.1389vw] h-[27.7778vw]" />

        {/* Bottom CTA buttons */}
        <button
          type="button"
          onClick={() => router.push('/signup')}
          className="absolute left-[41.956vw] top-[53.6458vw] flex items-center justify-center bg-black text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden"
        >
          <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
            Create Account
          </span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="absolute left-[52.8356vw] top-[53.6458vw] flex items-center justify-center bg-black text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden"
        >
          <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
            Log In
          </span>
        </button>
      </FitCanvas>
    </>
  )
}
