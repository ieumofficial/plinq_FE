import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import PublicLayout from '../components/PublicLayout'
import { ShowIcon, HideIcon } from '../components/icons'
import { supabase } from '../lib/supabase'

export default function LandingPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailContinue = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setEmailSubmitted(true)
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push('/personal-dashboard')
  }

  return (
    <>
      <Head>
        <title>Plow</title>
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
            onSubmit={emailSubmitted ? handleSignIn : handleEmailContinue}
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
              <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.4px] text-[#afb1b6]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailSubmitted) {
                    setEmailSubmitted(false)
                    setPassword('')
                    setError('')
                  }
                }}
                placeholder="janedoe@email.com"
                className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
              />
            </label>

            {emailSubmitted && (
              <label className="flex flex-col gap-[8px] w-full">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.4px] text-[#afb1b6]">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] pr-[44px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#afb1b6] hover:text-black cursor-pointer"
                  >
                    {showPassword ? <HideIcon size={20} /> : <ShowIcon size={20} />}
                  </button>
                </div>
              </label>
            )}

            {error && (
              <p className="font-sans text-[14px] leading-[20px] text-red-500">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                (emailSubmitted ? password : email) ? 'bg-black hover:bg-black/80' : 'bg-black/50'
              }`}
            >
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                {loading ? 'Signing in...' : 'Sign In'}
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
