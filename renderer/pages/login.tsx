import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import FitCanvas from '../components/FitCanvas'
import Logo from '../components/Logo'

/**
 * Log In page — Figma node 122:1104.
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
      <FitCanvas>
        {/* Top-left logo (links back to landing) */}
        <Link
          href="/"
          className="absolute top-[2.5463vw] left-[5.2662vw] w-[5.787vw] h-[5.787vw]"
        >
            <Logo className="w-full h-full" />
          </Link>

          {/* Plow brand text */}
          <p className="absolute top-[9.5486vw] left-[calc(50%-8.4491vw)] font-display text-[7.4546vw] leading-none text-black whitespace-nowrap">
            Plow
          </p>

          {/* Terms tagline */}
          <p className="absolute top-[22.1644vw] left-1/2 -translate-x-1/2 font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] text-black whitespace-nowrap">
            By signing in, I agree to the company&rsquo;s{' '}
            <a href="#" className="text-[#4764c5]">
              Privacy Statement
            </a>{' '}
            and{' '}
            <a href="#" className="text-[#4764c5]">
              Terms of Service
            </a>
          </p>

          {/* Sign-in card */}
          <form
            onSubmit={handleSignIn}
            className="absolute top-[25.463vw] left-1/2 -translate-x-1/2 w-[28.125vw] flex flex-col gap-[1.2731vw] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[2.4884vw] py-[2.7778vw] overflow-hidden"
          >
            <button
              type="button"
              className="w-full flex items-center justify-center bg-black text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden"
            >
              <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
                Continue with Google
              </span>
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center bg-black text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden"
            >
              <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
                Continue with Apple
              </span>
            </button>

            {/* "or" divider */}
            <div className="flex items-center gap-[0.6944vw] w-full">
              <div className="flex-1 h-px bg-[#afb1b6]" />
              <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] text-black">
                or
              </span>
              <div className="flex-1 h-px bg-[#afb1b6]" />
            </div>

            {/* Email field */}
            <label className="flex flex-col gap-[0.463vw] w-full">
              <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="janedoe@email.com"
                className="w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw] font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
              />
            </label>

            <button
              type="submit"
              className="w-full flex items-center justify-center bg-black/50 text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden hover:bg-black transition-colors"
            >
              <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
                Sign In
              </span>
            </button>
          </form>

        {/* Bottom: link to Create Account */}
        <p className="absolute top-[54.3981vw] left-1/2 -translate-x-1/2 -translate-y-1/2 font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] text-black whitespace-nowrap">
          or{' '}
          <Link href="/signup" className="underline">
            Create Account
          </Link>
        </p>
      </FitCanvas>
    </>
  )
}
