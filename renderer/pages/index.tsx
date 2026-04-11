import Head from 'next/head'
import { useRouter } from 'next/router'
import PublicLayout from '../components/PublicLayout'
import PlaceholderCross from '../components/PlaceholderCross'

/**
 * Landing page — Figma node 122:597.
 * Pre-auth page: no Header, no Sidebar (PublicLayout shell).
 */
export default function LandingPage() {
  const router = useRouter()

  return (
    <>
      <Head>
        <title>Plow</title>
      </Head>
      <PublicLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-[40px] px-[40px] py-[60px]">
          <p className="font-display text-[128.815px] leading-none text-black whitespace-nowrap">
            Plow
          </p>

          <PlaceholderCross className="w-[780px] h-[480px]" />

          <div className="flex items-center gap-[20px]">
            <button
              type="button"
              onClick={() => router.push('/signup')}
              className="flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
            >
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                Create Account
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
            >
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                Log In
              </span>
            </button>
          </div>
        </div>
      </PublicLayout>
    </>
  )
}
