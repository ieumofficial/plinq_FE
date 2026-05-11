export type Member = {
  name: string
  avatarUrl?: string
  /** Background color for the initial-letter fallback. */
  color?: string
}

type Props = {
  members: Member[]
  /** Max avatars to render before showing a "+N" overflow chip. */
  max?: number
  /** Avatar diameter in px. */
  size?: number
  /** Avatar border color (use white when overlapping a non-white bg). */
  borderColor?: string
  /** Color theme for the "+N" overflow chip. */
  overflowVariant?: 'gray' | 'blue'
}

const FALLBACK_COLORS = [
  '#5B7FB6', // blue-med
  '#588F6E', // green-med
  '#B68A48', // brown-med
  '#5B3D8A', // purple-main
  '#9B3838', // red-main
  '#455E6A', // primary-main
]

function colorFor(name: string, override?: string) {
  if (override) return override
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length]
}

function Avatar({
  member,
  size,
  borderColor,
}: {
  member: Member
  size: number
  borderColor: string
}) {
  const style = {
    width: size,
    height: size,
    borderColor,
  }
  if (member.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatarUrl}
        alt={member.name}
        style={style}
        className="rounded-full border border-solid object-cover -mr-[5px] last:mr-0 shrink-0 bg-white-secondary"
      />
    )
  }
  return (
    <span
      style={{ ...style, backgroundColor: colorFor(member.name, member.color) }}
      className="rounded-full border border-solid -mr-[5px] last:mr-0 shrink-0 inline-flex items-center justify-center text-white font-semibold uppercase select-none"
    >
      <span style={{ fontSize: Math.max(8, size * 0.5) }}>{member.name[0]}</span>
    </span>
  )
}

export default function UserGroup({
  members,
  max = 5,
  size = 15,
  borderColor = '#E6EAEE',
  overflowVariant = 'gray',
}: Props) {
  const visible = members.slice(0, max)
  const overflow = members.length - visible.length

  const overflowBg = overflowVariant === 'blue' ? '#DDE7F4' : '#ECEEF1'
  const overflowColor = overflowVariant === 'blue' ? '#2D5A9E' : '#94A0AA'

  return (
    <div className="inline-flex items-center">
      {visible.map((m, i) => (
        <Avatar key={`${m.name}-${i}`} member={m} size={size} borderColor={borderColor} />
      ))}
      {overflow > 0 && (
        <span
          style={{
            width: size,
            height: size,
            backgroundColor: overflowBg,
            borderColor,
            color: overflowColor,
            fontSize: Math.max(10, Math.round(size * 0.67)),
          }}
          className="rounded-full border border-solid inline-flex items-center justify-center font-sans select-none shrink-0"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
