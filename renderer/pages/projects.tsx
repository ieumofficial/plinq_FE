import Head from 'next/head'
import { useRouter } from 'next/router'
import AuthLayout from '../components/AuthLayout'

type Team = {
  id: number
  name: string
  active: boolean
}

type Project = {
  id: number
  name: string
  teamTag: string
  teamTagBg: string
  members: number
  totalTasks: number
  progress: number
}

const teams: Team[] = [
  { id: 1, name: 'Team A', active: true },
  { id: 2, name: 'Team B', active: false },
  { id: 3, name: '', active: false },
  { id: 4, name: '', active: false },
]

const projects: Project[] = [
  { id: 1, name: 'Project 1', teamTag: '# teamA', teamTagBg: '#ffffff', members: 4, totalTasks: 20, progress: 80 },
  { id: 2, name: 'Project 1', teamTag: '# teamB', teamTagBg: '#c9c9c9', members: 4, totalTasks: 20, progress: 80 },
  { id: 3, name: 'Project 1', teamTag: '# teamB', teamTagBg: '#c9c9c9', members: 4, totalTasks: 20, progress: 80 },
]

function ProfileAvatar({ className }: { className?: string }) {
  return (
    <div
      className={`w-[35px] h-[36px] bg-white border border-black rounded-full flex items-center justify-center ${className || ''}`}
    >
      <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
        <circle cx="9" cy="6" r="5.5" stroke="black" strokeWidth="1.1" />
        <path d="M0.5 21C0.5 17.4 4.3 14.5 9 14.5C13.7 14.5 17.5 17.4 17.5 21" stroke="black" strokeWidth="1.1" />
      </svg>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  return (
    <>
      <Head>
        <title>Projects - Plow</title>
      </Head>
      <AuthLayout>
        <div className="absolute top-[46px] left-[36px] right-[36px] flex flex-col gap-[30px]">
          {/* Page title */}
          <h1 className="font-sans font-medium text-[50px] leading-[24px] tracking-[0.2px] text-black">
            Projects
          </h1>

          {/* Team filter tabs */}
          <div className="flex items-center gap-[16px]">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                className={`w-[183px] h-[71px] rounded-lg border-2 border-[#afb1b6] font-sans font-medium text-[20px] leading-[24px] tracking-[0.2px] text-black text-center cursor-pointer ${
                  team.active
                    ? 'bg-white'
                    : team.name
                      ? 'bg-[#c9c9c9]'
                      : 'bg-[#efeff0]'
                }`}
              >
                {team.name}
              </button>
            ))}
          </div>

          {/* Project list */}
          <div className="flex flex-col gap-[28px]">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push('/project-dashboard')}
                className="w-full h-[99px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg flex items-center px-[29px] relative cursor-pointer"
              >
                {/* Project name + arrow */}
                <div className="flex items-center gap-[5px]">
                  <span className="font-sans font-medium text-[24px] leading-[24px] tracking-[0.2px] text-black whitespace-nowrap">
                    {project.name}
                  </span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path d="M9 6L15 12L9 18" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Member avatars */}
                <div className="flex items-center ml-[200px] -space-x-[13px]">
                  {Array.from({ length: Math.min(project.members, 4) }).map((_, i) => (
                    <ProfileAvatar key={i} />
                  ))}
                </div>

                {/* Progress section */}
                <div className="flex flex-col gap-[3px] ml-auto mr-[180px] w-[456px]">
                  <span className="font-sans font-medium text-[16px] leading-[normal] tracking-[0.2px] text-black">
                    {project.totalTasks} Tasks | {project.progress}%
                  </span>
                  <div className="relative w-full h-[21px] bg-[#d9d9d9]">
                    <div
                      className="absolute left-0 top-0 h-full bg-black"
                      style={{ width: `${(project.progress / 100) * 456}px` }}
                    />
                  </div>
                </div>

                {/* Team tag */}
                <div
                  className="absolute right-[40px] top-1/2 -translate-y-1/2 w-[114px] h-[40px] rounded-[30px] flex items-center justify-center"
                  style={{ backgroundColor: project.teamTagBg }}
                >
                  <span className="font-sans font-medium text-[14px] leading-[24px] tracking-[0.2px] text-[#414040]">
                    {project.teamTag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AuthLayout>
    </>
  )
}
