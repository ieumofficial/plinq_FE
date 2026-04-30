import Head from 'next/head'
import { useState } from 'react'
import ProjectLayout from '../components/ProjectLayout'
import { ArrowRightIcon, PlusIcon } from '../components/icons'

type Meeting = {
  id: number
  name: string
  date: string
  status: 'upcoming' | 'past'
}

const meetings: Meeting[] = [
  { id: 1, name: 'Meeting Name', date: 'DATE', status: 'upcoming' },
  { id: 2, name: 'Meeting Name', date: 'DATE', status: 'upcoming' },
  { id: 3, name: 'Meeting Name', date: 'DATE', status: 'upcoming' },
  { id: 4, name: 'Meeting Name', date: 'DATE', status: 'upcoming' },
  { id: 5, name: 'Meeting Name', date: 'DATE', status: 'past' },
  { id: 6, name: 'Meeting Name', date: 'DATE', status: 'past' },
]

type Tab = 'upcoming' | 'past'

export default function ProjectMeetingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const visible = meetings.filter((m) => m.status === activeTab)

  return (
    <>
      <Head>
        <title>Meetings - Plow</title>
      </Head>
      <ProjectLayout projectName="Project 1">
        <div className="px-[36px] py-[54px] flex flex-col gap-[24px] min-w-[1000px]">
          {/* Title row */}
          <div className="flex items-start justify-between">
            <h1 className="font-sans font-semibold text-[40px] leading-[48px] tracking-[0.2px] text-black">
              Meetings
            </h1>
            <button
              type="button"
              aria-label="New meeting"
              className="w-[45px] h-[45px] rounded-full bg-black flex items-center justify-center cursor-pointer p-0 border-0"
            >
              <PlusIcon className="w-[24px] h-[24px] text-white" />
            </button>
          </div>

          {/* Tabs row + filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[16px]">
              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`font-sans font-medium text-[24px] leading-[28px] tracking-[0.2px] bg-transparent border-0 p-0 cursor-pointer ${
                  activeTab === 'upcoming' ? 'text-black' : 'text-[#afb1b6]'
                }`}
              >
                Upcoming
              </button>
              <span className="font-sans font-medium text-[24px] leading-[28px] tracking-[0.2px] text-[#afb1b6]">
                |
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('past')}
                className={`font-sans font-medium text-[24px] leading-[28px] tracking-[0.2px] bg-transparent border-0 p-0 cursor-pointer ${
                  activeTab === 'past' ? 'text-black' : 'text-[#afb1b6]'
                }`}
              >
                Past
              </button>
            </div>
            <button
              type="button"
              className="font-sans font-medium text-[14px] leading-[20px] tracking-[1px] text-[#61646b] bg-transparent border-0 p-0 cursor-pointer uppercase"
            >
              Filter
            </button>
          </div>

          {/* Meeting rows */}
          <div className="flex flex-col gap-[20px]">
            {visible.map((m) => (
              <button
                key={m.id}
                type="button"
                className="w-full h-[77px] bg-white border border-[#afb1b6] rounded-md flex items-center px-[31px] cursor-pointer text-left"
              >
                <span className="font-sans font-medium text-[18px] leading-[24px] tracking-[0.2px] text-black">
                  {m.name}
                </span>
                <ArrowRightIcon className="w-[24px] h-[24px] text-black ml-[10px]" />
                <span className="ml-auto font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] text-[#61646b]">
                  {m.date}
                </span>
              </button>
            ))}
            {visible.length === 0 && (
              <p className="font-sans text-[16px] leading-[24px] tracking-[0.2px] text-[#61646b]">
                No {activeTab} meetings.
              </p>
            )}
          </div>
        </div>
      </ProjectLayout>
    </>
  )
}
