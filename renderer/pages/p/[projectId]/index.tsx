import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function ProjectIndexRedirect() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  useEffect(() => {
    if (projectId) router.replace(`/p/${projectId}/dashboard`)
  }, [projectId, router])
  return null
}
