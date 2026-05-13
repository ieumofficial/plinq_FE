/**
 * React Query hooks wrapping the data layer in lib/queries.ts.
 * Pages should use these instead of calling getXxx() in useEffect, so that
 *   - results are cached across navigations (no flicker on revisit)
 *   - background refetches keep data fresh after staleTime
 *   - mutations can target precise keys for invalidation
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteChatSession,
  getChatMessages,
  getChatSessionMembers,
  getChatSessions,
  getCurrentUser,
  getOrgMembers,
  getProject,
  getProjectCounts,
  getProjectDocs,
  getProjectMeetings,
  getProjectMembers,
  getProjectMembersWithRoles,
  getProjectTasks,
  getUserActionItems,
  getUserCalendarEvents,
  getUserProjects,
  getUserUpcomingMeetings,
  type ProjectWithStats,
} from './queries'
import { supabase } from './supabase'
import { queryKeys } from './queryKeys'
import type { ProjectRow, TaskStatusDb } from './types'

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

/** Delete a project. Invalidates project caches on success. */
export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all })
      qc.invalidateQueries({ queryKey: ['project'] })
    },
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

/** Update a task's status. Invalidates task/calendar/project caches on success. */
export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatusDb }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all })
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.projects.all })
      qc.invalidateQueries({ queryKey: ['project'] })
    },
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

// ─── Single project (header info, nav counts, page data) ───────────────────

export function useProject(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.project.one(projectId ?? ''),
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000,
  })
}

export function useProjectCounts(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.project.counts(projectId ?? ''),
    queryFn: () => getProjectCounts(projectId!),
    enabled: !!projectId,
  })
}

export function useProjectTasks(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.project.tasks(projectId ?? ''),
    queryFn: () => getProjectTasks(projectId!),
    enabled: !!projectId,
  })
}

export function useProjectMeetings(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.project.meetings(projectId ?? ''),
    queryFn: () => getProjectMeetings(projectId!),
    enabled: !!projectId,
  })
}

export function useProjectMembersWithRoles(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.members.projectWithRoles(projectId ?? ''),
    queryFn: () => getProjectMembersWithRoles(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000,
  })
}

export function useProjectDocs(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.project.docs(projectId ?? ''),
    queryFn: () => getProjectDocs(projectId!),
    enabled: !!projectId,
  })
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export function useChatSessions(
  userId: string | null | undefined,
  orgId: string | null | undefined
) {
  return useQuery({
    queryKey: queryKeys.chat.sessions(userId ?? '', orgId ?? ''),
    queryFn: () => getChatSessions(userId!, orgId!),
    enabled: !!userId && !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useChatSessionMembers(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.chat.members(sessionId ?? ''),
    queryFn: () => getChatSessionMembers(sessionId!),
    enabled: !!sessionId,
    staleTime: 60 * 1000,
  })
}

export function useChatMessages(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.chat.messages(sessionId ?? ''),
    queryFn: () => getChatMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 10 * 1000,
  })
}

/** Delete a chat session. Invalidates chat caches on success. */
export function useDeleteChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const result = await deleteChatSession(sessionId)
      if ('error' in result) throw new Error(result.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.chat.all })
    },
  })
}
