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
          className="absolute top-0 left-0 w-[1728px] h-[103px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg overflow-hidden"
        >
          <Logo className="absolute left-[28px] top-[22px] w-[53px] h-[55px]" />

          <button
            type="button"
            style={noDrag}
            onClick={() => router.push('/signup')}
            className="absolute left-[1426px] top-[23px] flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
          >
            <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
              Create Account
            </span>
          </button>
          <button
            type="button"
            style={noDrag}
            onClick={() => router.push('/login')}
            className="absolute left-[1614px] top-[23px] flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
          >
            <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
              Log In
            </span>
          </button>
        </div>

        {/* Plow brand text */}
        <p className="absolute top-[183px] left-[calc(50%-146px)] font-display text-[128.815px] leading-none text-black whitespace-nowrap">
          Plow
        </p>

        {/* Main image placeholder */}
        <PlaceholderCross className="absolute top-[406px] left-1/2 -translate-x-1/2 w-[780px] h-[480px]" />

        {/* Bottom CTA buttons */}
        <button
          type="button"
          onClick={() => router.push('/signup')}
          className="absolute left-[725px] top-[927px] flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
        >
          <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
            Create Account
          </span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="absolute left-[913px] top-[927px] flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
        >
          <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
            Log In
          </span>
        </button>
      </FitCanvas>
    </>
  )
}
