import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useCurrentUser, useMyOrg } from '../lib/hooks'

/**
 * Legacy path /organization — redirects to /o/{myOrgId}/dashboard.
 * Kept for back-compat with any bookmarks; new code should route directly.
 */
export default function OrganizationRedirect() {
  const router = useRouter()
  const { data: user, isFetched: userFetched } = useCurrentUser()
  const { data: org, isFetched: orgFetched } = useMyOrg(user?.id)

  useEffect(() => {
    if (!userFetched) return
    if (!user) {
      router.replace('/')
      return
    }
    if (!orgFetched) return
    if (org?.id) {
      router.replace(`/o/${org.id}/dashboard`)
    } else {
      router.replace('/choose-org')
    }
  }, [userFetched, user, orgFetched, org, router])

  return null
}
