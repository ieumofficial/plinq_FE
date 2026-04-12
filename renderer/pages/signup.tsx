import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Logo from '../components/Logo'
import PublicLayout from '../components/PublicLayout'
import { ShowIcon, HideIcon } from '../components/icons'
import { supabase } from '../lib/supabase'

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

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialState)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    if (!form.email.trim()) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!form.agreed) {
      setError('약관에 동의해주세요.')
      return
    }

    setLoading(true)

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          nickname: form.nickname || null,
          job_title: form.role || null,
        },
      },
    })

    if (authError) {
      setError(
        authError.message === 'User already registered'
          ? '이미 등록된 이메일입니다.'
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
        <title>Create Account · Plow</title>
      </Head>
      <PublicLayout>
        <div className="min-h-screen flex">
          {/* Left: brand container */}
          <div className="relative flex-1 min-h-screen bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg flex items-center justify-center p-[40px]">
            <div className="absolute top-[44px] left-[91px] w-[100px] h-[100px]">
              <Logo className="w-full h-full" />
            </div>
            <p className="font-display text-[128.815px] leading-none text-black whitespace-nowrap">
              Plow
            </p>
          </div>

          {/* Right: form column */}
          <div className="flex-1 min-h-screen flex flex-col items-center justify-center gap-[10px] px-[40px] py-[60px]">
            <form
              onSubmit={handleSubmit}
              className="w-[486px] flex flex-col gap-[10px] items-start bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[43px] py-[48px] overflow-hidden"
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

              <label className="flex flex-col gap-[8px] w-full overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Password
                </span>
                <div className="flex items-center gap-[16px] w-full bg-white border border-[#afb1b6] rounded-lg p-[12px]">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="*********"
                    className="flex-1 bg-transparent outline-none font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="cursor-pointer text-[#afb1b6] hover:text-black"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <HideIcon size={24} /> : <ShowIcon size={24} />}
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-[8px] w-full overflow-hidden">
                <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.399px] text-[#afb1b6]">
                  Confirm Password
                </span>
                <div className="flex items-center gap-[16px] w-full bg-white border border-[#afb1b6] rounded-lg p-[12px]">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    placeholder="*********"
                    className="flex-1 bg-transparent outline-none font-sans font-normal text-[16px] leading-[24px] text-black placeholder:text-[#afb1b6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="cursor-pointer text-[#afb1b6] hover:text-black"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <HideIcon size={24} /> : <ShowIcon size={24} />}
                  </button>
                </div>
              </label>

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

              {error && (
                <p className="font-sans text-[14px] leading-[20px] text-red-500 w-full">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center bg-black text-white rounded-[16px] px-[20px] py-[16px] cursor-pointer overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/80 transition-colors"
              >
                <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap">
                  {loading ? 'Creating...' : 'Create Account'}
                </span>
              </button>
            </form>

            <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black text-center">
              Already have an account?{' '}
              <Link href="/" className="underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </PublicLayout>
    </>
  )
}
