import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import PublicLayout from '../components/PublicLayout'

/**
 * Log In page — Figma node 122:1104.
 * Pre-auth page: no Header, no Sidebar (PublicLayout shell).
 * Submitting redirects to /personal-dashboard (no backend yet).
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')

  const handleSignIn = (e: FormEvent) => {
    e.preventDefault()
    router.push('/personal-dashboard')
  }

  return (
    <>
      <Head>
        <title>Log In · Plow</title>
      </Head>
      <PublicLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-[30px] px-[40px] py-[60px]">
          <p className="font-display text-[128.815px] leading-none text-black whitespace-nowrap">
            Plow
          </p>

          <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black whitespace-nowrap">
            By signing in, I agree to the company&rsquo;s{' '}
            <a href="#" className="text-[#4764c5]">
              Privacy Statement
            </a>{' '}
            and{' '}
            <a href="#" className="text-[#4764c5]">
              Terms of Service
            </a>
          </p>

          <form
            onSubmit={handleSignIn}
            className="w-[486px] flex flex-col gap-[22px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[43px] py-[48px] overflow-hidden"
          >
            <button
              type="button"
              className="w-full flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
            >
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                Continue with Google
              </span>
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
            >
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                Continue with Apple
              </span>
            </button>

            <div className="flex items-center gap-[12px] w-full">
              <div className="flex-1 h-px bg-[#afb1b6]" />
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
                or
              </span>
              <div className="flex-1 h-px bg-[#afb1b6]" />
            </div>

            <label className="flex flex-col gap-[8px] w-full">
              <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="janedoe@email.com"
                className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
              />
            </label>

            <button
              type="submit"
              className="w-full flex items-center justify-center bg-black/50 text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden hover:bg-black transition-colors"
            >
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                Sign In
              </span>
            </button>
          </form>

          <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black whitespace-nowrap">
            or{' '}
            <Link href="/signup" className="underline">
              Create Account
            </Link>
          </p>
        </div>
      </PublicLayout>
    </>
  )
}
