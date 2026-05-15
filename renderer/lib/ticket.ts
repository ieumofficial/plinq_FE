/**
 * Jira-style task ticket ids: `<PROJECT CODE>-<3-digit sequence>`.
 *
 * The sequence is the task's creation rank *within its project* (base 100),
 * so it is stable and identical no matter which page, sort, or filter renders
 * it — unlike a list-position index. This is the single source of truth;
 * every surface (rows, detail modal) must derive ids through here.
 */

/** First letter of up to the first 3 words, uppercased. "Design System v2"
 *  → "DSV". Falls back to "TSK" when the name yields nothing. */
export function projectCode(projectName: string): string {
  const prefix = projectName
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return prefix || 'TSK'
}

type Rankable = { id: string; created_at: string }

/**
 * Stable ticket id for a task. `tasks` is the task's project task list (any
 * order). Returns null when the task isn't in the list yet (e.g. the list is
 * still loading) so callers can show a fallback rather than a wrong number.
 */
export function taskTicketId(
  projectName: string,
  tasks: Rankable[],
  taskId: string
): string | null {
  const ordered = [...tasks].sort((a, b) => {
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? -1 : 1
    }
    return a.id < b.id ? -1 : 1 // deterministic tiebreaker
  })
  const idx = ordered.findIndex((t) => t.id === taskId)
  if (idx < 0) return null
  const seq = 100 + idx
  return `${projectCode(projectName)}-${seq.toString().padStart(3, '0')}`
}
