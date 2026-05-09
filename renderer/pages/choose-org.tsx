import { useEffect, useState, type CSSProperties } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import DarkBackground from '../components/DarkBackground'
import PlinqLogo from '../components/PlinqLogo'
import { supabase } from '../lib/supabase'

const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

type OrgInfo = {
  id: string
  name: string
  member_count: number
}

const ORG_COLORS = ['#455E6A', '#9B3838', '#5B3D8A', '#2D5A9E', '#2F6B45']

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="#94A0AA"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ChooseOrgPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      setEmail(user.email ?? '')
      setFirstName(
        (user.user_metadata?.first_name as string) ??
          user.email?.split('@')[0] ??
          'User'
      )

      // Fetch organizations the user belongs to
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('org_id, organizations(id, name)')
        .eq('user_id', user.id)

      if (error) {
        console.error('Failed to fetch orgs:', error)
        setLoading(false)
        return
      }

      if (!memberships || memberships.length === 0) {
        router.push('/create-org')
        return
      }

      // Get member counts for each org
      const orgIds = memberships.map(
        (m) => (m.organizations as unknown as { id: string; name: string }).id
      )
      const { data: counts } = await supabase
        .from('organization_members')
        .select('org_id')
        .in('org_id', orgIds)

      const countMap: Record<string, number> = {}
      counts?.forEach((c) => {
        countMap[c.org_id] = (countMap[c.org_id] ?? 0) + 1
      })

      const orgList: OrgInfo[] = memberships.map((m) => {
        const org = m.organizations as unknown as {
          id: string
          name: string
        }
        return {
          id: org.id,
          name: org.name,
          member_count: countMap[org.id] ?? 1,
        }
      })

      setOrgs(orgList)
      setLoading(false)
    }

    fetchData()
  }, [router])

  const displayedOrgs = showAll ? orgs : orgs.slice(0, 4)
  const hiddenCount = orgs.length - 4

  const handleSelectOrg = (_orgId: string) => {
    // TODO: store selected org in context/store
    router.push('/personal-dashboard')
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>plinq - Choose Organization</title>
        </Head>
        <DarkBackground>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#94A0AA] text-[14px]">Loading...</p>
          </div>
        </DarkBackground>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>plinq - Choose Organization</title>
      </Head>
      <DarkBackground>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-10 py-16">
          {/* Logo */}
          <PlinqLogo size="medium" />

          {/* Welcome message */}
          <div className="text-center">
            <h1 className="text-[28px] leading-tight">
              <span className="text-[#EBEFF2] font-semibold">
                Welcome back,{' '}
              </span>
              <span
                className="text-[#5B7FB6] italic font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {firstName}!
              </span>
            </h1>
            <p className="text-[#94A0AA] text-[12px] mt-2">
              Choose an organization below to get started.
            </p>
          </div>

          {/* Org list card */}
          <div
            className="w-[400px] bg-white border border-[#D9D9D9] rounded-[10px] overflow-hidden"
            style={noDrag}
          >
            {/* Card header */}
            <div className="px-5 py-4">
              <p className="text-[#455E6A] text-[12px]">
                Organizations for{' '}
                <span className="font-bold">{email}</span>
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-[#E6EAEE]" />

            {/* Org rows */}
            <div>
              {displayedOrgs.map((org, index) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelectOrg(org.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8F9FA] transition-colors cursor-pointer text-left"
                >
                  {/* Colored square with first letter */}
                  <div
                    className="w-[32px] h-[32px] rounded-[6px] flex items-center justify-center text-white text-[14px] font-bold shrink-0"
                    style={{
                      backgroundColor:
                        ORG_COLORS[index % ORG_COLORS.length],
                    }}
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Org info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#16242E] text-[14px] font-semibold truncate">
                      {org.name}
                    </p>
                    <p className="text-[#94A0AA] text-[11px]">
                      {org.member_count}{' '}
                      {org.member_count === 1 ? 'member' : 'members'}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowIcon />
                </button>
              ))}
            </div>

            {/* Show more */}
            {hiddenCount > 0 && !showAll && (
              <>
                <div className="h-px bg-[#E6EAEE]" />
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full px-5 py-3 text-[#5B7FB6] text-[12px] font-medium hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                >
                  Show {hiddenCount} more organization
                  {hiddenCount > 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </DarkBackground>
    </>
  )
}
