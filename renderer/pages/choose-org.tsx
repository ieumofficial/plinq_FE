import { useEffect, useState, type CSSProperties } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useQueryClient } from '@tanstack/react-query'
import DarkBackground from '../components/DarkBackground'
import Logo from '../components/ui/Logo'
import Icon from '../components/ui/Icon'
import { supabase } from '../lib/supabase'
import { setActiveOrgId } from '../lib/activeOrgStore'
import { queryKeys } from '../lib/queryKeys'

const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

type OrgInfo = {
  id: string
  name: string
  member_count: number
}

const ORG_COLORS = ['#455E6A', '#9B3838', '#5B3D8A', '#2D5A9E', '#2F6B45']

export default function ChooseOrgPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [orgs, setOrgs] = useState<OrgInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function fetchData() {
      // The login page does setSession() then router.replace() — depending
      // on where supabase-js writes its storage, the new page can land
      // here before the session is observable. Retry briefly before
      // giving up and bouncing back to the landing page.
      let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
      for (let i = 0; i < 6; i++) {
        const { data } = await supabase.auth.getUser()
        if (data.user) {
          user = data.user
          break
        }
        await new Promise((r) => setTimeout(r, 150))
      }
      if (!user) {
        // eslint-disable-next-line no-console
        console.warn('[choose-org] no auth session after retries — sending back to /')
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

  const handleSelectOrg = async (orgId: string) => {
    // 1. Persist the choice so Personal Space pages know which org to scope to.
    setActiveOrgId(orgId)
    // 2. Make sure the auth session is actually live before navigating. The
    //    next page reads useCurrentUser, which on a re-login can still be
    //    holding a cached null from the previous signout — that triggers
    //    PersonalAppShell's "no user → /" bounce.
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session?.user) {
      console.warn('[choose-org] no live session at handleSelectOrg — back to /')
      router.replace('/')
      return
    }
    // 3. Drop the stale currentUser cache so PersonalAppShell does a fresh
    //    fetch instead of reading a cached null.
    queryClient.removeQueries({ queryKey: queryKeys.currentUser() })
    // 4. replace() so the back button doesn't return to choose-org mid-session.
    router.replace('/personal-dashboard')
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>plinq - Choose Organization</title>
        </Head>
        <DarkBackground>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-secondary text-[14px]">Loading...</p>
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
          <Logo variant="on-dark" size={32} />

          {/* Welcome message */}
          <div className="text-center">
            <h1 className="text-[28px] leading-tight">
              <span className="text-gray-extra-light font-semibold">
                Welcome back,{' '}
              </span>
              <span
                className="text-blue-med italic font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {firstName}!
              </span>
            </h1>
            <p className="text-gray-secondary text-[12px] mt-2">
              Choose an organization below to get started.
            </p>
          </div>

          {/* Org list card */}
          <div
            className="w-[400px] bg-white-white border border-gray-border rounded-[10px] overflow-hidden"
            style={noDrag}
          >
            {/* Card header */}
            <div className="px-5 py-4">
              <p className="text-primary-main text-[12px]">
                Organizations for{' '}
                <span className="font-bold">{email}</span>
              </p>
            </div>

            <div className="h-px bg-gray-border-light" />

            {/* Org rows */}
            <div>
              {displayedOrgs.map((org, index) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelectOrg(org.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white-main transition-colors cursor-pointer text-left"
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
                    <p className="text-black text-[14px] font-semibold truncate">
                      {org.name}
                    </p>
                    <p className="text-gray-secondary text-[11px]">
                      {org.member_count}{' '}
                      {org.member_count === 1 ? 'member' : 'members'}
                    </p>
                  </div>

                  <span className="text-gray-secondary">
                    <Icon name="ArrowRight" size={15} />
                  </span>
                </button>
              ))}
            </div>

            {/* Show more */}
            {hiddenCount > 0 && !showAll && (
              <>
                <div className="h-px bg-gray-border-light" />
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full px-5 py-3 text-blue-med text-[12px] font-medium hover:bg-white-main transition-colors cursor-pointer"
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
