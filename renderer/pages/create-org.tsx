import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import DarkBackground from '../components/DarkBackground'
import PlinqLogo from '../components/PlinqLogo'
import { supabase } from '../lib/supabase'

const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

export default function CreateOrgPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [orgName, setOrgName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberEmails, setMemberEmails] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/')
      }
    })
  }, [router])

  const handleAddEmail = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const trimmed = memberEmail.trim().toLowerCase()
    if (!trimmed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }
    if (memberEmails.includes(trimmed)) {
      setError('This email has already been added.')
      return
    }
    setMemberEmails((prev) => [...prev, trimmed])
    setMemberEmail('')
    setError('')
  }

  const handleRemoveEmail = (email: string) => {
    setMemberEmails((prev) => prev.filter((e) => e !== email))
  }

  const handleContinue = () => {
    if (!orgName.trim()) {
      setError('Organization name is required.')
      return
    }
    setError('')
    setStep(2)
  }

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError('Organization name is required.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Insert organization
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          owner_id: user.id,
        })

      if (orgError) {
        setError(orgError.message)
        setLoading(false)
        return
      }

      // TODO: handle member invites for memberEmails

      router.push('/personal-dashboard')
    } catch {
      setError('Failed to create organization. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>plinq - Create Organization</title>
      </Head>
      <DarkBackground>
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 px-10 py-16"
          style={noDrag}
        >
          {/* Logo */}
          <PlinqLogo size="medium" />

          {/* Header */}
          <div className="text-center">
            <h1 className="text-[28px] leading-tight">
              <span className="text-[#EBEFF2] font-semibold">
                Looks like you&rsquo;re{' '}
              </span>
              <span
                className="text-[#5B7FB6] italic font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                new!
              </span>
            </h1>
            <p className="text-[#94A0AA] text-[12px] mt-2">
              Create an organization to get started.
            </p>
          </div>

          {/* Form */}
          <div className="w-full max-w-[380px] flex flex-col gap-4">
            {/* Organization Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#94A0AA] text-[10px] tracking-[1.5px] uppercase font-medium">
                ORGANIZATION NAME
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Enter organization name"
                className="w-full backdrop-blur-sm bg-white/10 border border-[#D9D9D9]/40 rounded-[8px] px-4 py-3 text-white text-[12px] placeholder:text-[#6B7B86] outline-none focus:border-white/50 transition-colors"
                autoFocus
              />
            </div>

            {/* Step 2: Add Members */}
            {step === 2 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[#94A0AA] text-[10px] tracking-[1.5px] uppercase font-medium">
                  ADD MEMBERS
                </label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => {
                    setMemberEmail(e.target.value)
                    setError('')
                  }}
                  onKeyDown={handleAddEmail}
                  placeholder="Type an email and press Enter"
                  className="w-full backdrop-blur-sm bg-white/10 border border-[#D9D9D9]/40 rounded-[8px] px-4 py-3 text-white text-[12px] placeholder:text-[#6B7B86] outline-none focus:border-white/50 transition-colors"
                  autoFocus
                />

                {/* Email tags */}
                {memberEmails.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {memberEmails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center gap-2 bg-white/10 border border-[#EBEFF2]/30 rounded-full px-3 py-1.5 text-white text-[11px] truncate"
                      >
                        <span className="truncate flex-1">{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="shrink-0 w-[16px] h-[16px] rounded-full bg-[#6B7B86]/50 flex items-center justify-center text-white/70 hover:bg-[#6B7B86] hover:text-white transition-colors cursor-pointer"
                        >
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 8 8"
                            fill="none"
                          >
                            <path
                              d="M1 1L7 7M7 1L1 7"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-[#EB7373] text-[11px]">{error}</p>
            )}

            {/* Action button */}
            {step === 1 ? (
              <button
                type="button"
                onClick={handleContinue}
                className="w-full bg-white border border-[#E6EAEE] rounded-[10px] px-4 py-3 text-[#16242E] text-[12px] font-semibold hover:bg-white/90 transition-colors mt-2 cursor-pointer"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-white border border-[#E6EAEE] rounded-[10px] px-4 py-3 text-[#16242E] text-[12px] font-semibold hover:bg-white/90 transition-colors mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            )}
          </div>
        </div>
      </DarkBackground>
    </>
  )
}
