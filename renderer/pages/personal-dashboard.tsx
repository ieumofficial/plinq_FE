import Head from 'next/head'
import AuthLayout from '../components/AuthLayout'
import PlaceholderCross from '../components/PlaceholderCross'

type Project = { id: number; name: string }
type ActionItem = { id: number; title: string; due: string; project: string }

const projects: Project[] = [
  { id: 1, name: 'Project 1' },
  { id: 2, name: 'Project 2' },
  { id: 3, name: 'Project 3' },
]

const actionItems: ActionItem[] = [
  { id: 1, title: 'Action Item 1', due: 'DUE DATE', project: 'PROJECT NAME' },
  { id: 2, title: 'Action Item 2', due: 'DUE DATE', project: 'PROJECT NAME' },
  { id: 3, title: 'Action Item 3', due: 'DUE DATE', project: 'PROJECT NAME' },
  { id: 4, title: 'Action Item 4', due: 'DUE DATE', project: 'PROJECT NAME' },
]

/**
 * Personal Dashboard — Figma node 122:608.
 *
 * The page sits inside <main> from AuthLayout, whose origin is at
 * (left=300, top=103) of the window (right of Sidebar, below Header).
 * All offsets here are therefore Figma's pixel values minus those origins:
 *   left = figmaLeft - 300, top = figmaTop - 103.
 */
export default function PersonalDashboardPage() {
  return (
    <>
      <Head>
        <title>Personal Dashboard · Plow</title>
      </Head>
      <AuthLayout>
        {/* Left column: Projects Overview + Pending Action Items
            Figma: top=133, left=354 → main-relative: top=30, left=54 */}
        <div className="absolute top-[30px] left-[54px] w-[693px] flex flex-col gap-[40px] items-start">
          {/* Projects Overview */}
          <section className="w-full flex flex-col items-start">
            <div className="flex items-center justify-between w-full">
              <h2 className="font-sans font-medium text-[20px] leading-[24px] tracking-[0.2px] text-black">
                Projects Overview
              </h2>
              <a
                href="#"
                className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black whitespace-nowrap cursor-pointer"
              >
                VIEW ALL
              </a>
            </div>
            <div className="mt-[5px] w-full flex items-center justify-center gap-[20px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[50px] py-[30px]">
              {projects.map((p) => (
                <div key={p.id} className="flex-1 flex flex-col gap-[10px] items-start justify-center">
                  <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black whitespace-nowrap">
                    {p.name}
                  </p>
                  <div className="w-full h-[222px] bg-white border-2 border-[#afb1b6] rounded-lg" />
                </div>
              ))}
            </div>
          </section>

          {/* Pending Action Items */}
          <section className="w-full flex flex-col items-start">
            <div className="flex items-center justify-between w-full">
              <h2 className="font-sans font-medium text-[20px] leading-[24px] tracking-[0.2px] text-black">
                Pending Action Items
              </h2>
              <a
                href="#"
                className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-black whitespace-nowrap cursor-pointer"
              >
                VIEW ALL
              </a>
            </div>
            <div className="mt-[5px] w-full h-[462px] flex flex-col gap-[17px] items-start bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg px-[30px] py-[28px] overflow-hidden">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="relative w-full h-[89px] bg-white border-2 border-[#afb1b6] rounded-lg overflow-hidden"
                >
                  <div className="absolute left-[13px] top-[13px] flex items-center gap-[15px] p-[4px]">
                    <input
                      type="checkbox"
                      className="w-[20px] h-[20px] accent-black border-2 border-[#afb1b6] rounded-[4px] shrink-0"
                    />
                    <div className="flex flex-col">
                      <p className="font-sans font-medium text-[20px] leading-[24px] tracking-[0.2px] text-[#19191b] whitespace-nowrap">
                        {item.title}
                      </p>
                      <p className="font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-[#7d7d7d] whitespace-nowrap">
                        {item.due} | {item.project}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column: Calendar + AI Follow-up
            Figma: top=133, left=1096 → main-relative: top=30, left=796 */}
        <div className="absolute top-[30px] left-[796px] w-[592px] flex flex-col gap-[40px] items-start">
          {/* Calendar */}
          <section className="w-full h-[577px] flex flex-col gap-[20px] items-start">
            <h2 className="font-sans font-medium text-[20px] leading-[24px] tracking-[0.2px] text-black">
              Calendar
            </h2>
            <PlaceholderCross className="w-full flex-1" />
          </section>

          {/* AI Follow-up */}
          <section className="w-full h-[304px] flex flex-col gap-[20px] items-start">
            <h2 className="font-sans font-medium text-[20px] leading-[24px] tracking-[0.2px] text-black">
              AI Follow-up
            </h2>
            <div className="w-full flex-1 bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg" />
          </section>
        </div>
      </AuthLayout>
    </>
  )
}
