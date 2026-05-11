import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell from '../../../components/ProjectAppShell'
import { useProject } from '../../../lib/hooks'

export default function TimelinePage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  const { data: project } = useProject(projectId)

  if (!projectId) return null

  return (
    <>
      <Head>
        <title>plinq · Timeline</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="timeline">
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-[5px]">
            <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
              {(project?.name ?? '').toUpperCase()} · TIMELINE
            </p>
            <h1 className="text-black text-[28px] font-semibold leading-tight">
              12 tracks toward{' '}
              <em
                className="italic text-blue-main font-medium"
                style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
              >
                cutover.
              </em>
            </h1>
          </div>
          <div className="bg-white-white border border-gray-border-light rounded-[10px] p-12 text-center">
            <p className="text-gray-secondary text-[14px]">Timeline coming soon.</p>
          </div>
        </div>
      </ProjectAppShell>
    </>
  )
}
