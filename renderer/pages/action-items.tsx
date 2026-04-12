import Head from 'next/head'
import AuthLayout from '../components/AuthLayout'

type ActionItem = {
  id: number
  title: string
  dueDate: string
  dueRemaining: string
  stage: string
  priority: string
}

type ProjectGroup = {
  projectName: string
  items: ActionItem[]
}

const projectGroups: ProjectGroup[] = [
  {
    projectName: 'Project 1',
    items: [
      { id: 1, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
      { id: 2, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
      { id: 3, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
    ],
  },
  {
    projectName: 'Project 2',
    items: [
      { id: 4, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
      { id: 5, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
      { id: 6, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
    ],
  },
  {
    projectName: 'Project 3',
    items: [
      { id: 7, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
      { id: 8, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
      { id: 9, title: 'Update Wireframe', dueDate: '04.12', dueRemaining: '2 days', stage: 'Backlog', priority: 'High' },
    ],
  },
]

type FilterStatus = 'Planned' | 'In Progress' | 'Delayed' | 'Completed'

const filters: { label: FilterStatus; active: boolean }[] = [
  { label: 'Planned', active: false },
  { label: 'In Progress', active: true },
  { label: 'Delayed', active: false },
  { label: 'Completed', active: false },
]

const totalItems = 100

export default function ActionItemsPage() {
  return (
    <>
      <Head>
        <title>Action Items - Plow</title>
      </Head>
      <AuthLayout>
        <div className="absolute top-[29px] left-[36px] right-[36px] flex flex-col gap-[20px]">
          {/* Page header */}
          <div className="flex items-center justify-between w-full">
            <h1 className="font-sans font-medium text-[50px] leading-[24px] tracking-[0.2px] text-black">
              Action Items
            </h1>
            <button
              type="button"
              className="px-[20px] py-[16px] bg-black text-white font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] rounded-[16px] cursor-pointer border-0 whitespace-nowrap"
            >
              Add new
            </button>
          </div>

          {/* Search + Filter row */}
          <div className="flex items-center gap-[20px]">
            {/* Search input */}
            <div className="w-[390px] h-[44px] bg-white border border-[#afb1b6] rounded-[10px] flex items-center px-[12px]">
              <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-[#afb1b6]">
                Search
              </span>
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-[10px]">
              {filters.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  className={`h-[16px] flex items-center justify-center px-[8px] py-px font-sans font-medium text-[12px] leading-[normal] tracking-[0.2px] cursor-pointer ${
                    f.active
                      ? 'bg-black text-white border-0'
                      : 'bg-transparent text-black border border-black'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="font-sans font-medium text-[12px] leading-[normal] tracking-[0.2px] text-black">
                | {totalItems} total
              </span>
            </div>
          </div>

          {/* Table column headers */}
          <div className="flex items-center justify-end px-[20px] gap-[50px] font-sans font-semibold text-[16px] leading-[normal] tracking-[0.2px] text-black text-center">
            <span className="w-[150px]">Due Date</span>
            <span className="w-[150px]">Stage</span>
            <span className="w-[150px]">Priority</span>
          </div>

          {/* Project groups */}
          {projectGroups.map((group) => (
            <div key={group.projectName} className="flex flex-col gap-[0px]">
              {/* Project header bar */}
              <div className="w-[135px] h-[35px] bg-black flex items-center justify-center">
                <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-white text-center">
                  {group.projectName}
                </span>
              </div>

              {/* Action item rows */}
              <div className="flex flex-col">
                {group.items.map((item) => (
                  <div key={item.id}>
                    {/* Divider line */}
                    <div className="w-full h-[1px] bg-[#afb1b6]" />
                    {/* Row content */}
                    <div className="flex items-center justify-between px-[20px] py-[22px]">
                      <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black w-[240px]">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-[50px]">
                        <span className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black text-center w-[150px]">
                          {item.dueDate} ({item.dueRemaining})
                        </span>
                        <span className="w-[150px] h-[21px] border border-black flex items-center justify-center font-sans font-medium text-[16px] leading-[normal] tracking-[0.2px] text-black">
                          {item.stage}
                        </span>
                        <span className="w-[150px] h-[21px] border border-black flex items-center justify-center font-sans font-medium text-[16px] leading-[normal] tracking-[0.2px] text-black">
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AuthLayout>
    </>
  )
}
