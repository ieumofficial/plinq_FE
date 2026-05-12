import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function OrgIndexRedirect() {
  const router = useRouter()
  const orgId = router.query.orgId as string | undefined
  useEffect(() => {
    if (orgId) router.replace(`/o/${orgId}/dashboard`)
  }, [orgId, router])
  return null
}
