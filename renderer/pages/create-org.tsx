import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import DarkBackground from '../components/DarkBackground'
import Logo from '../components/ui/Logo'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
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
          <Logo variant="on-dark" size={32} />

          <div className="text-center">
            <h1 className="text-[28px] leading-tight">
              <span className="text-gray-extra-light font-semibold">
                Looks like you&rsquo;re{' '}
              </span>
              <span
                className="text-blue-med italic font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                new!
              </span>
            </h1>
            <p className="text-gray-secondary text-[12px] mt-2">
              Create an organization to get started.
            </p>
          </div>

          {/* Form */}
          <div className="w-full max-w-[380px] flex flex-col gap-4">
            <Input
              label="ORGANIZATION NAME"
              variant="translucent"
              placeholder="Enter organization name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              autoFocus
            />

            {/* Step 2: Add Members */}
            {step === 2 && (
              <div className="flex flex-col gap-1.5">
                <Input
                  label="ADD MEMBERS"
                  type="email"
                  variant="translucent"
                  placeholder="Type an email and press Enter"
                  value={memberEmail}
                  onChange={(e) => {
                    setMemberEmail(e.target.value)
                    setError('')
                  }}
                  onKeyDown={handleAddEmail}
                  autoFocus
                />

                {/* Email tags */}
                {memberEmails.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {memberEmails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center gap-2 bg-white/10 border border-gray-extra-light/30 rounded-full px-3 py-1.5 text-white text-[11px] truncate"
                      >
                        <span className="truncate flex-1">{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="shrink-0 w-[16px] h-[16px] rounded-full bg-gray-main/50 flex items-center justify-center text-white/70 hover:bg-gray-main hover:text-white transition-colors cursor-pointer"
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

            {error && (
              <p className="text-red-dark-mode text-[11px]">{error}</p>
            )}

            {/* Action button */}
            {step === 1 ? (
              <Button
                variant="secondary"
                onClick={handleContinue}
                className="w-full mt-2"
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={handleCreate}
                disabled={loading}
                className="w-full mt-2"
              >
                {loading ? 'Creating...' : 'Create'}
              </Button>
            )}
          </div>
        </div>
      </DarkBackground>
    </>
  )
}
