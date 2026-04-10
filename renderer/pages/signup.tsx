import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import FitCanvas from '../components/FitCanvas'
import Logo from '../components/Logo'
import { ShowIcon } from '../components/icons'

type FormState = {
  firstName: string
  lastName: string
  nickname: string
  role: string
  email: string
  password: string
  confirmPassword: string
  agreed: boolean
}

const initialState: FormState = {
  firstName: '',
  lastName: '',
  nickname: '',
  role: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreed: false,
}

/**
 * Create Account page — Figma node 122:1125.
 * Submitting redirects to /personal-dashboard (no backend yet).
 */
export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialState)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    router.push('/personal-dashboard')
  }

  return (
    <>
      <Head>
        <title>Create Account · Plow</title>
      </Head>
      <FitCanvas>
        {/* Left panel — large background */}
        <div className="absolute top-0 left-0 w-[859px] h-[1117px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg" />

        {/* Top-left logo (links back to landing) */}
        <Link
          href="/"
          className="absolute top-[44px] left-[91px] w-[100px] h-[100px]"
        >
          <Logo className="w-full h-full" />
        </Link>

        {/* Plow brand text */}
        <p className="absolute top-[calc(50%-77px)] left-[300px] font-display text-[128.815px] leading-none text-black whitespace-nowrap">
          Plow
        </p>

        {/* Form column (centered around left:calc(50%+419px), top:50%) */}
        <div className="absolute top-1/2 left-[1283px] -translate-x-1/2 -translate-y-1/2 w-[486px] flex flex-col gap-[10px] items-center">
            <form
              onSubmit={handleSubmit}
              className="w-full flex flex-col gap-[10px] items-start bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[43px] py-[48px] overflow-hidden"
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

              {/* "or" divider */}
              <div className="flex items-center gap-[12px] w-full">
                <div className="flex-1 h-px bg-[#afb1b6]" />
                <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
                  or
                </span>
                <div className="flex-1 h-px bg-[#afb1b6]" />
              </div>

              {/* First Name */}
              <label className="flex flex-col gap-[8px] w-full overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  First Name
                </span>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  placeholder="Jane"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Last Name */}
              <label className="flex flex-col gap-[8px] w-full overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Last Name
                </span>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  placeholder="Doe"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Nickname */}
              <label className="flex flex-col gap-[8px] w-full overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Nickname
                </span>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => update('nickname', e.target.value)}
                  placeholder="janeeee"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Role */}
              <label className="flex flex-col gap-[8px] w-full overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Role
                </span>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  placeholder="Front-end Developer"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Email */}
              <label className="flex flex-col gap-[8px] w-full overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="janedoe@email.com"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[12px] font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Password */}
              <label className="flex flex-col gap-[8px] w-[400px] overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Password
                </span>
                <div className="flex items-center gap-[16px] w-full bg-white border border-[#afb1b6] rounded-lg p-[12px]">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="*********"
                    className="flex-1 bg-transparent outline-none font-sans font-normal text-[16px] leading-[24px] text-[#61646b] placeholder:text-[#61646b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <ShowIcon className="w-[24px] h-[24px] text-[#61646b]" />
                  </button>
                </div>
              </label>

              {/* Confirm Password */}
              <label className="flex flex-col gap-[8px] w-[400px] overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Confirm Password
                </span>
                <div className="flex items-center gap-[16px] w-full bg-white border border-[#afb1b6] rounded-lg p-[12px]">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    placeholder="*********"
                    className="flex-1 bg-transparent outline-none font-sans font-normal text-[16px] leading-[24px] text-[#61646b] placeholder:text-[#61646b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <ShowIcon className="w-[24px] h-[24px] text-[#61646b]" />
                  </button>
                </div>
              </label>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-[8px] w-full p-[4px] overflow-hidden cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreed}
                  onChange={(e) => update('agreed', e.target.checked)}
                  className="mt-[2px] w-[20px] h-[20px] accent-black border-2 border-[#afb1b6] rounded-[4px] shrink-0"
                />
                <span className="flex-1 font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-[#19191b]">
                  I have read and agreed to the company&rsquo;s{' '}
                  <a href="#" className="text-[#4764c5]">
                    Privacy Statement
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-[#4764c5]">
                    Terms of Service
                  </a>
                </span>
              </label>

              <button
                type="submit"
                className="w-full flex items-center justify-center bg-black/50 hover:bg-black transition-colors text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden"
              >
                <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                  Create Account
                </span>
              </button>
            </form>

          <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black text-center w-full">
            Already have an account?{' '}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </div>
      </FitCanvas>
    </>
  )
}
