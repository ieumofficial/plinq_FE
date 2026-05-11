/**
 * React Query hooks wrapping the data layer in lib/queries.ts.
 * Pages should use these instead of calling getXxx() in useEffect, so that
 *   - results are cached across navigations (no flicker on revisit)
 *   - background refetches keep data fresh after staleTime
 *   - mutations can target precise keys for invalidation
 */
import { useQuery } from '@tanstack/react-query'
import {
  getCurrentUser,
  getOrgMembers,
  getProjectMembers,
  getUserActionItems,
  getUserCalendarEvents,
  getUserProjects,
  getUserUpcomingMeetings,
  type ProjectWithStats,
} from './queries'
import { supabase } from './supabase'
import { queryKeys } from './queryKeys'
import type { ProjectRow } from './types'

// ─── User / org ─────────────────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000, // user info rarely changes
  })
}

export type MyOrg = { id: string; name: string } | null

export function useMyOrg(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myOrg(userId),
    queryFn: async (): Promise<MyOrg> => {
      if (!userId) return null
      const { data } = await supabase
        .from('organization_members')
        .select('organizations(id, name)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      const org = (data as { organizations: { id: string; name: string } | null } | null)
        ?.organizations
      return org ?? null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Projects ───────────────────────────────────────────────────────────────

export function useUserProjects(
  userId: string | undefined,
  opts?: { statuses?: ProjectRow['status'][]; limit?: number }
) {
  return useQuery<ProjectWithStats[]>({
    queryKey: queryKeys.projects.list(userId ?? '', opts),
    queryFn: () => getUserProjects(userId!, opts),
    enabled: !!userId,
  })
}

// ─── Action items / tasks ───────────────────────────────────────────────────

export function useUserActionItems(
  userId: string | undefined,
  opts?: { includeDone?: boolean; limit?: number }
) {
  return useQuery({
    queryKey: queryKeys.tasks.actionItems(userId ?? '', opts),
    queryFn: () => getUserActionItems(userId!, opts),
    enabled: !!userId,
  })
}

// ─── Meetings ───────────────────────────────────────────────────────────────

export function useUserUpcomingMeetings(
  userId: string | undefined,
  opts?: { from?: Date; to?: Date; limit?: number }
) {
  const fromIso = opts?.from?.toISOString()
  const toIso = opts?.to?.toISOString()
  return useQuery({
    queryKey: queryKeys.meetings.upcoming(userId ?? '', {
      fromIso,
      toIso,
      limit: opts?.limit,
    }),
    queryFn: () => getUserUpcomingMeetings(userId!, opts),
    enabled: !!userId,
  })
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export function useUserCalendarEvents(
  userId: string | undefined,
  from: Date | null,
  to: Date | null
) {
  return useQuery({
    queryKey: queryKeys.calendar.range(
      userId ?? '',
      from?.toISOString() ?? '',
      to?.toISOString() ?? ''
    ),
    queryFn: () => getUserCalendarEvents(userId!, from!, to!),
    enabled: !!userId && !!from && !!to,
  })
}

// ─── Members ────────────────────────────────────────────────────────────────

export function useOrgMembers(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.members.org(orgId ?? ''),
    queryFn: () => getOrgMembers(orgId!),
    enabled: !!orgId,
    staleTime: 60 * 1000,
  })
}

export function useProjectMembers(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.members.project(projectId ?? ''),
    queryFn: () => getProjectMembers(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000,
  })
}
