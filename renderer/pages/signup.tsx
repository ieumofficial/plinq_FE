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
        <div className="absolute top-0 left-0 w-[49.7106vw] h-[64.6412vw] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg" />

        {/* Top-left logo (links back to landing) */}
        <Link
          href="/"
          className="absolute top-[2.5463vw] left-[5.2662vw] w-[5.787vw] h-[5.787vw]"
        >
          <Logo className="w-full h-full" />
        </Link>

        {/* Plow brand text */}
        <p className="absolute top-[calc(50%-4.456vw)] left-[17.3611vw] font-display text-[7.4546vw] leading-none text-black whitespace-nowrap">
          Plow
        </p>

        {/* Form column (centered around left:calc(50%+24.2477vw), top:50%) */}
        <div className="absolute top-1/2 left-[74.2477vw] -translate-x-1/2 -translate-y-1/2 w-[28.125vw] flex flex-col gap-[0.5787vw] items-center">
            <form
              onSubmit={handleSubmit}
              className="w-full flex flex-col gap-[0.5787vw] items-start bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[2.4884vw] py-[2.7778vw] overflow-hidden"
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

              {/* First Name */}
              <label className="flex flex-col gap-[0.463vw] w-full overflow-hidden">
                <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                  First Name
                </span>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  placeholder="Jane"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw] font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Last Name */}
              <label className="flex flex-col gap-[0.463vw] w-full overflow-hidden">
                <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                  Last Name
                </span>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  placeholder="Doe"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw] font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Nickname */}
              <label className="flex flex-col gap-[0.463vw] w-full overflow-hidden">
                <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                  Nickname
                </span>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => update('nickname', e.target.value)}
                  placeholder="janeeee"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw] font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Role */}
              <label className="flex flex-col gap-[0.463vw] w-full overflow-hidden">
                <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                  Role
                </span>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  placeholder="Front-end Developer"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw] font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Email */}
              <label className="flex flex-col gap-[0.463vw] w-full overflow-hidden">
                <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="janedoe@email.com"
                  className="w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw] font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-black placeholder:text-[#afb1b6] outline-none focus:border-black"
                />
              </label>

              {/* Password */}
              <label className="flex flex-col gap-[0.463vw] w-[23.1481vw] overflow-hidden">
                <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                  Password
                </span>
                <div className="flex items-center gap-[0.9259vw] w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw]">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="*********"
                    className="flex-1 bg-transparent outline-none font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-[#61646b] placeholder:text-[#61646b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <ShowIcon className="w-[1.3889vw] h-[1.3889vw] text-[#61646b]" />
                  </button>
                </div>
              </label>

              {/* Confirm Password */}
              <label className="flex flex-col gap-[0.463vw] w-[23.1481vw] overflow-hidden">
                <span className="font-sans font-medium text-[0.8102vw] leading-[1.1574vw] tracking-[0.0231vw] text-[#afb1b6]">
                  Confirm Password
                </span>
                <div className="flex items-center gap-[0.9259vw] w-full bg-white border border-[#afb1b6] rounded-lg p-[0.6944vw]">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    placeholder="*********"
                    className="flex-1 bg-transparent outline-none font-sans font-normal text-[0.9259vw] leading-[1.3889vw] text-[#61646b] placeholder:text-[#61646b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <ShowIcon className="w-[1.3889vw] h-[1.3889vw] text-[#61646b]" />
                  </button>
                </div>
              </label>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-[0.463vw] w-full p-[0.2315vw] overflow-hidden cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreed}
                  onChange={(e) => update('agreed', e.target.checked)}
                  className="mt-[0.1157vw] w-[1.1574vw] h-[1.1574vw] accent-black border-2 border-[#afb1b6] rounded-[0.2315vw] shrink-0"
                />
                <span className="flex-1 font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] text-[#19191b]">
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
                className="w-full flex items-center justify-center bg-black/50 hover:bg-black transition-colors text-white rounded-[0.9259vw] px-[1.1574vw] py-[0.9259vw] cursor-pointer overflow-hidden"
              >
                <span className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] whitespace-nowrap">
                  Create Account
                </span>
              </button>
            </form>

          <p className="font-sans font-medium text-[0.9259vw] leading-[1.3889vw] tracking-[0.0116vw] text-black text-center w-full">
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
