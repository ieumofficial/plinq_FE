import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectLayout from '../components/ProjectLayout'
import { ArrowDownIcon } from '../components/icons'

type MeetingItem = {
  id: number
  name: string
  date: string
  group: string
  groupBg: string
}

type MemberItem = {
  id: number
  name: string
  role: string
  progress: number
  expanded?: boolean
  inProgress?: { task: string; project: string }[]
  completed?: { task: string; project: string }[]
}

const upcomingMeetings: MeetingItem[] = [
  { id: 1, name: 'Meeting Name', date: 'DATE', group: '# GroupA', groupBg: '#ffffff' },
  { id: 2, name: 'Meeting Name', date: 'DATE', group: '# GroupA', groupBg: '#ffffff' },
]

const pastMeetings: MeetingItem[] = [
  { id: 3, name: 'Meeting Name', date: 'DATE', group: '# GroupA', groupBg: '#ffffff' },
  { id: 4, name: 'Meeting Name', date: 'DATE', group: '# GroupA', groupBg: '#ffffff' },
]

const members: MemberItem[] = [
  {
    id: 1,
    name: 'Jane Doe',
    role: 'UX Designer',
    progress: 80,
    expanded: true,
    inProgress: [
      { task: 'TaskA', project: 'Project1' },
      { task: 'TaskB', project: 'Project2' },
    ],
    completed: [
      { task: 'TaskC', project: 'Project1' },
      { task: 'TaskD', project: 'Project2' },
    ],
  },
  { id: 2, name: 'Jane Doe', role: 'UX Designer', progress: 80 },
  { id: 3, name: 'Jane Doe', role: 'UX Designer', progress: 80 },
  { id: 4, name: 'Jane Doe', role: 'UX Designer', progress: 80 },
]

function ProfileAvatar({ size = 30 }: { size?: number }) {
  return (
    <div
      className="rounded-full border border-black bg-white flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.4} height={size * 0.5} viewBox="0 0 18 22" fill="none">
        <circle cx="9" cy="6" r="5.5" stroke="black" strokeWidth="1.1" />
        <path d="M0.5 21C0.5 17.4 4.3 14.5 9 14.5C13.7 14.5 17.5 17.4 17.5 21" stroke="black" strokeWidth="1.1" />
      </svg>
    </div>
  )
}

function DonutChart({ percent }: { percent: number }) {
  const size = 224
  const stroke = 35
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - percent / 100)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#d9d9d9"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#000"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="butt"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sans font-semibold text-[36px] leading-[41px] tracking-[0.2px] text-black">
          {percent}%
        </span>
        <span className="font-sans font-medium text-[12px] leading-[14px] tracking-[0.2px] text-black mt-[2px]">
          Completed
        </span>
      </div>
    </div>
  )
}

function MeetingRow({ meeting, onClick }: { meeting: MeetingItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-[74px] bg-white border border-[#afb1b6] rounded-md flex items-center px-[20px] cursor-pointer text-left"
    >
      <div className="flex flex-col gap-[2px]">
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          {meeting.name}
        </span>
        <span className="font-sans font-medium text-[12px] leading-[16px] tracking-[0.2px] text-[#61646b]">
          {meeting.date}
        </span>
      </div>
      <div
        className="ml-auto h-[40px] w-[114px] rounded-[30px] border border-[#afb1b6] flex items-center justify-center"
        style={{ backgroundColor: meeting.groupBg }}
      >
        <span className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.2px] text-[#414040]">
          {meeting.group}
        </span>
      </div>
    </button>
  )
}

function MemberCard({ member }: { member: MemberItem }) {
  return (
    <div className="w-full bg-white border border-[#afb1b6] rounded-md p-[15px]">
      <div className="flex items-center gap-[8px]">
        <ProfileAvatar size={30} />
        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
          {member.name}
        </span>
        <span className="font-sans font-medium text-[14px] leading-[24px] tracking-[0.2px] text-[#61646b]">
          | {member.role}
        </span>
        <div className="ml-auto flex items-center gap-[10px]">
          <span className="font-sans font-medium text-[12px] leading-[14px] tracking-[0.2px] text-black">
            {member.progress}%
          </span>
          <ArrowDownIcon
            className={`w-[24px] h-[24px] text-black transition-transform ${
              member.expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>
      {member.expanded && (
        <div className="mt-[15px] flex gap-[30px]">
          <div className="flex-1">
            <p className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.2px] text-black mb-[4px]">
              In Progress
            </p>
            <ul className="space-y-[2px]">
              {member.inProgress?.map((t, i) => (
                <li
                  key={i}
                  className="font-sans text-[14px] leading-[20px] tracking-[0.2px] text-black"
                >
                  • {t.task} <span className="text-[#61646b]">| {t.project}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-px bg-[#afb1b6]" />
          <div className="flex-1">
            <p className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.2px] text-black mb-[4px]">
              Completed
            </p>
            <ul className="space-y-[2px]">
              {member.completed?.map((t, i) => (
                <li
                  key={i}
                  className="font-sans text-[14px] leading-[20px] tracking-[0.2px] text-black"
                >
                  • {t.task} <span className="text-[#61646b]">| {t.project}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjectDashboardPage() {
  const router = useRouter()
  return (
    <>
      <Head>
        <title>Project Dashboard - Plow</title>
      </Head>
      <ProjectLayout projectName="Project 1">
        <div className="px-[36px] py-[54px] flex flex-col gap-[42px] min-w-[1200px]">
          {/* Title */}
          <h1 className="font-sans font-semibold text-[40px] leading-[48px] tracking-[0.2px] text-black">
            Project 1
          </h1>

          {/* Top row: Kanban/Timeline placeholders + Overall Progress */}
          <div className="flex gap-[40px]">
            <div className="flex-1 flex flex-col gap-[16px]">
              <h2 className="font-sans font-medium text-[18px] leading-[24px] tracking-[0.2px] text-black">
                Kanban Board <span className="text-[#afb1b6]">|</span> Timeline
              </h2>
              <div className="bg-white border-2 border-[#afb1b6] rounded-lg p-[20px] flex gap-[10px] h-[300px]">
                <div className="flex-1 bg-[#d9d9d9] rounded-md" />
                <div className="flex-1 bg-[#d9d9d9] rounded-md" />
                <div className="flex-1 bg-[#d9d9d9] rounded-md" />
              </div>
            </div>

            <div className="w-[300px] flex flex-col gap-[16px]">
              <h2 className="font-sans font-medium text-[18px] leading-[24px] tracking-[0.2px] text-black">
                Overall Progress
              </h2>
              <div className="bg-white border-2 border-[#afb1b6] rounded-lg p-[20px] flex flex-col items-center gap-[20px] h-[300px]">
                <DonutChart percent={72} />
                <div className="flex items-end justify-between w-full px-[10px]">
                  <div className="flex flex-col">
                    <span className="font-sans font-semibold text-[20px] leading-[28px] tracking-[0.2px] text-black">
                      95
                    </span>
                    <span className="font-sans font-medium text-[12px] leading-[14px] tracking-[0.2px] text-[#61646b]">
                      Total Tasks
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-sans font-semibold text-[20px] leading-[28px] tracking-[0.2px] text-black">
                      26
                    </span>
                    <span className="font-sans font-medium text-[12px] leading-[14px] tracking-[0.2px] text-[#61646b]">
                      Completed
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-sans font-semibold text-[20px] leading-[28px] tracking-[0.2px] text-black">
                      30
                    </span>
                    <span className="font-sans font-medium text-[12px] leading-[14px] tracking-[0.2px] text-[#61646b]">
                      Ongoing
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row: Meetings + Members */}
          <div className="flex gap-[40px]">
            {/* Meetings */}
            <div className="flex-1 flex flex-col gap-[16px]">
              <div className="flex items-center justify-between">
                <h2 className="font-sans font-medium text-[18px] leading-[24px] tracking-[0.2px] text-black">
                  Meetings
                </h2>
                <button
                  type="button"
                  onClick={() => router.push('/project-meetings')}
                  className="font-sans font-medium text-[14px] leading-[20px] tracking-[1px] text-[#61646b] bg-transparent border-0 p-0 cursor-pointer uppercase"
                >
                  View All
                </button>
              </div>
              <div className="bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg p-[17px] flex flex-col gap-[7px]">
                <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black">
                  Upcoming
                </p>
                {upcomingMeetings.map((m) => (
                  <MeetingRow key={m.id} meeting={m} onClick={() => router.push('/project-meetings')} />
                ))}
                <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black mt-[7px]">
                  Past
                </p>
                {pastMeetings.map((m) => (
                  <MeetingRow key={m.id} meeting={m} onClick={() => router.push('/project-meetings')} />
                ))}
              </div>
            </div>

            {/* Members */}
            <div className="w-[480px] flex flex-col gap-[16px]">
              <div className="flex items-center justify-between">
                <h2 className="font-sans font-medium text-[18px] leading-[24px] tracking-[0.2px] text-black">
                  Members
                </h2>
                <button
                  type="button"
                  className="font-sans font-medium text-[14px] leading-[20px] tracking-[1px] text-[#61646b] bg-transparent border-0 p-0 cursor-pointer uppercase"
                >
                  View All
                </button>
              </div>
              <div className="bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg p-[20px] flex flex-col gap-[10px]">
                {members.map((m) => (
                  <MemberCard key={m.id} member={m} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </ProjectLayout>
    </>
  )
}
