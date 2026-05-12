import StatusLabelBig, { type Status } from './StatusLabelBig'
import UserGroup, { type Member } from './UserGroup'
import Icon from './Icon'

type Props = {
  name: string
  description: string
  /** Project lifecycle status — shown as a colored chip in the card header. */
  status?: Status
  /** 0–100 */
  progress: number
  members?: Member[]
  onOpen?: () => void
}

export default function ProjectCard({
  name,
  description,
  status,
  progress,
  members,
  onOpen,
}: Props) {
  const pct = Math.max(0, Math.min(100, progress))
  return (
    <div className="bg-white-item rounded-[5px] flex flex-col justify-between p-[10px] w-[170px] h-[225px]">
      <div className="flex flex-col gap-[10px] w-full">
        <div className="flex items-center justify-between w-full">
          {status ? <StatusLabelBig status={status} size="md" /> : <span />}
          <span className="font-sans text-[14px] font-semibold text-black">{pct}%</span>
        </div>
        <h3 className="font-sans text-[16px] font-semibold text-black leading-tight">{name}</h3>
        <p
          className="text-[10px] text-gray-main leading-[1.2] line-clamp-3"
          style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
        >
          {description}
        </p>
      </div>
      <div className="flex flex-col gap-[9px] w-full">
        <div className="bg-gray-progress h-[3.5px] rounded-full overflow-hidden w-full">
          <div className="bg-blue-med h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between w-full">
          {members && members.length > 0 ? (
            <UserGroup members={members} size={15} borderColor="#FFFFFF" overflowVariant="blue" />
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center pl-[10px] py-[5px] rounded-[5px] text-gray-main hover:bg-gray-extra-light transition-colors"
          >
            <span
              className="capitalize text-[10px]"
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              Open
            </span>
            <Icon name="ArrowRight" size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
