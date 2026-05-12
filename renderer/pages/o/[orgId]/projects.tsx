import Head from 'next/head'
import { useRouter } from 'next/router'
import OrganizationAppShell from '../../../components/OrganizationAppShell'

export default function OrgProjectsPage() {
  const router = useRouter()
  const orgId = router.query.orgId as string | undefined
  if (!orgId) return null
  return (
    <>
      <Head>
        <title>plinq · Organization · Projects</title>
      </Head>
      <OrganizationAppShell orgId={orgId} active="projects">
        <div className="p-6 flex flex-col gap-[10px]">
          <h1 className="text-black text-[28px] font-semibold">Projects</h1>
          <p className="text-gray-secondary text-[12px]">Coming soon.</p>
        </div>
      </OrganizationAppShell>
    </>
  )
}
