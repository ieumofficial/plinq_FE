import type { ExtractedMeeting } from '../lib/aiAnalyze'

type Props = {
  data: ExtractedMeeting
}

/**
 * Renders the four AI-extracted sections from a meeting transcript:
 * key decisions, action items, follow-ups, unresolved items.
 * Ported from plow_FE — same structure + section labels in Korean,
 * restyled with plinq's design tokens (gray-border, primary-main, …).
 */
export default function MeetingInsights({ data }: Props) {
  const showSummary = !!data.summary?.trim()
  const empty =
    !showSummary &&
    data.keyDecisions.length === 0 &&
    data.actionItems.length === 0 &&
    data.followUps.length === 0 &&
    data.unresolved.length === 0
  if (empty) {
    return (
      <p className="text-gray-secondary text-[12px] italic">
        분석 결과가 비어 있습니다 — 트랜스크립트가 너무 짧을 수 있어요.
      </p>
    )
  }
  return (
    <div className="bg-white-item border border-gray-border-light rounded-[8px] p-[15px] flex flex-col gap-[15px]">
      {showSummary && (
        <div>
          <p className="text-gray-main text-[10px] font-semibold uppercase tracking-[1.5px] mb-[6px]">
            Summary
          </p>
          <p className="text-black text-[13px] leading-[20px]">
            {data.summary}
          </p>
        </div>
      )}
      <Section
        title="핵심 결정사항"
        accent="#2F6B45"
        items={data.keyDecisions.map((t) => ({ text: t }))}
      />
      <Section
        title="액션 아이템"
        accent="#2D5A9E"
        items={data.actionItems.map((a) => ({
          text: a.task,
          meta: [a.owner, a.dueDate].filter(Boolean).join(' · '),
        }))}
      />
      <Section
        title="후속 조치"
        accent="#8A5A1E"
        items={data.followUps.map((t) => ({ text: t }))}
      />
      <Section
        title="미해결 안건"
        accent="#9B3838"
        items={data.unresolved.map((t) => ({ text: t }))}
      />
    </div>
  )
}

function Section({
  title,
  accent,
  items,
}: {
  title: string
  accent: string
  items: { text: string; meta?: string }[]
}) {
  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-[1.5px] mb-[8px]"
        style={{ color: accent }}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-gray-secondary text-[12px] italic">없음</p>
      ) : (
        <ul className="flex flex-col gap-[6px]">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-[8px]">
              <span
                className="w-[6px] h-[6px] rounded-full mt-[7px] shrink-0"
                style={{ backgroundColor: accent }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-black text-[13px] leading-[20px]">
                  {it.text}
                </p>
                {it.meta && (
                  <p className="text-gray-main text-[11px] leading-[16px] mt-[2px]">
                    {it.meta}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
