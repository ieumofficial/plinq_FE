import Head from 'next/head'
import AuthLayout from '../components/AuthLayout'

const today = new Date()
const year = today.getFullYear()
const month = today.getMonth()

const monthName = today.toLocaleString('en-US', { month: 'long' })

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getCalendarDays(y: number, m: number) {
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const daysInPrevMonth = new Date(y, m, 0).getDate()
  const cells: { day: number; current: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false })
  }
  return cells
}

const calendarDays = getCalendarDays(year, month)

export default function CalendarPage() {
  return (
    <>
      <Head>
        <title>Calendar - Plow</title>
      </Head>
      <AuthLayout>
        <div className="absolute top-[51px] left-[36px] right-[36px] flex flex-col gap-[30px]">
          {/* Page header */}
          <div className="flex items-baseline justify-between w-full">
            <h1 className="font-sans font-medium text-[50px] leading-[24px] tracking-[0.2px] text-black">
              Calendar
            </h1>
            <p className="font-sans text-[50px] leading-[24px] tracking-[0.2px] text-black text-right">
              <span className="font-bold">{monthName}</span>
              <span className="font-medium">, {year}</span>
            </p>
          </div>

          {/* Calendar grid */}
          <div className="w-full bg-white border-2 border-[#afb1b6] rounded-lg p-[20px]">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-[2px] mb-[8px]">
              {daysOfWeek.map((d) => (
                <div
                  key={d}
                  className="text-center font-sans font-medium text-[14px] leading-[20px] text-[#61646b] py-[4px]"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-[2px]">
              {calendarDays.map((cell, idx) => {
                const isToday = cell.current && cell.day === today.getDate()
                return (
                  <div
                    key={idx}
                    className={`h-[100px] bg-[#efeff0] border border-[#afb1b6] rounded-[4px] p-[6px] text-left ${
                      !cell.current ? 'opacity-40' : ''
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-[24px] h-[24px] font-sans text-[13px] leading-[16px] ${
                        isToday
                          ? 'bg-[#4764c5] text-white rounded-full font-medium'
                          : 'text-[#19191b] font-normal'
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  )
}
