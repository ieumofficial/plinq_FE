/**
 * React Query hooks wrapping the data layer in lib/queries.ts.
 * Pages should use these instead of calling getXxx() in useEffect, so that
 *   - results are cached across navigations (no flicker on revisit)
 *   - background refetches keep data fresh after staleTime
 *   - mutations can target precise keys for invalidation
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createKnowledgeDoc,
  deleteChatSession,
  deleteKnowledgeDoc,
  deleteProject,
  deleteTask,
  // toggleDocPin removed — pin state lives in localStorage for now (see lib/pinPref.ts)
  getChatMessages,
  getChatSessionMembers,
  getChatSessions,
  getCurrentUser,
  getMyOrgsWithStats,
  getOrgMembers,
  getOrgMembersWithRoles,
  inviteToOrganization,
  inviteToProject,
  updateCurrentUser,
  getProject,
  getProjectCounts,
  getProjectDocs,
  getProjectMeetings,
  getProjectMembers,
  getProjectMembersWithRoles,
  getProjectTasks,
  getOrgProjects,
  getUserActionItems,
  getUserCalendarEvents,
  getUserProjects,
  getUserUpcomingMeetings,
  updateProject,
  type NewDocInput,
  type ProjectPatch,
  type ProjectWithStats,
  type UserProfilePatch,
} from './queries'
import { supabase } from './supabase'
import { queryKeys } from './queryKeys'
import type { OrgRoleDb, ProjectRoleDb, ProjectRow, TaskStatusDb } from './types'
import { aiFetch } from './aiClient'

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

/** Current user's role in their (single) organization. Returns null if the
 *  user has no org membership yet. Used to gate "owner-only" UI like the
 *  Organization sidebar entry. */
export function useMyOrgRole(userId: string | undefined) {
  return useQuery({
    queryKey: ['myOrgRole', userId ?? null] as const,
    queryFn: async (): Promise<OrgRoleDb | null> => {
      if (!userId) return null
      const { data } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      return (data as { role: OrgRoleDb } | null)?.role ?? null
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

/** All projects in an org (Organization Space view, ignores membership). */
export function useOrgProjects(
  orgId: string | null | undefined,
  opts?: { statuses?: ProjectRow['status'][]; limit?: number }
) {
  return useQuery<ProjectWithStats[]>({
    queryKey: queryKeys.projects.orgList(orgId ?? '', opts),
    queryFn: () => getOrgProjects(orgId!, opts),
    enabled: !!orgId,
  })
}

/** Delete a project. Invalidates project caches on success. */
export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await deleteProject(projectId)
      if ('error' in result) throw new Error(result.error)
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

/** Delete a task and its assignees. Invalidates task/calendar/project caches. */
export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await deleteTask(taskId)
      if ('error' in result) throw new Error(result.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all })
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
      qc.invalidateQueries({ queryKey: queryKeys.projects.all })
      qc.invalidateQueries({ queryKey: ['project'] })
    },
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

export type TaskPatch = {
  title?: string
  description?: string | null
  status?: TaskStatusDb
  priority?: import('./types').TaskPriorityDb
  due_date?: string | null
  start_date?: string | null
}

/** Patch arbitrary task fields. Invalidates the same caches as status updates. */
export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, patch }: { taskId: string; patch: TaskPatch }) => {
      const { error } = await supabase
        .from('tasks')
        .update(patch)
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

/** All orgs the current user belongs to, with member/project totals. */
export function useMyOrgsWithStats(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['myOrgs', 'withStats', userId ?? null] as const,
    queryFn: () => getMyOrgsWithStats(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
}

/** Patch the current user's profile (display name fields, role/job title). */
export function useUpdateCurrentUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: UserProfilePatch) => {
      const result = await updateCurrentUser(patch)
      if ('error' in result) throw new Error(result.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.currentUser() })
      qc.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

export function useOrgMembersWithRoles(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.members.orgWithRoles(orgId ?? ''),
    queryFn: () => getOrgMembersWithRoles(orgId!),
    enabled: !!orgId,
    staleTime: 60 * 1000,
  })
}

/** Add an existing user to the org by email. */
export function useInviteToOrg(orgId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; role: OrgRoleDb }) => {
      if (!orgId) throw new Error('orgId required')
      const result = await inviteToOrganization({
        org_id: orgId,
        email: input.email,
        role: input.role,
      })
      if ('error' in result) {
        if (result.error === 'not_found') {
          throw new Error(
            "We couldn't find a registered user with that email. Ask them to sign up first."
          )
        }
        if (result.error === 'already_member') {
          throw new Error('That user is already in this organization.')
        }
        throw new Error(result.error)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

/** Update a member's org role (owner/admin/member). */
export function useUpdateOrgMemberRole(orgId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { userId: string; role: OrgRoleDb }) => {
      if (!orgId) throw new Error('orgId required')
      // `.select()` so an RLS-filtered update (caller is not admin/owner)
      // is surfaced as 0 returned rows instead of a silent no-op.
      const { data, error } = await supabase
        .from('organization_members')
        .update({ role: input.role })
        .eq('org_id', orgId)
        .eq('user_id', input.userId)
        .select('user_id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) {
        throw new Error(
          "Couldn't change the role — you may not have permission. Only an admin or owner can change member roles."
        )
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

/** Remove a user from an organization's membership. Invalidates member caches. */
export function useRemoveOrgMember(orgId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!orgId) throw new Error('orgId required')
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

/** Update a project member's role (editor / admin / readonly). Use `.select()`
 *  so RLS-filtered rows surface as "0 affected" → caller can show a perm error. */
export function useUpdateProjectMemberRole(projectId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      userId: string
      role: import('./types').ProjectRoleDb
    }) => {
      if (!projectId) throw new Error('projectId required')
      const { data, error } = await supabase
        .from('project_members')
        .update({ role: input.role })
        .eq('project_id', projectId)
        .eq('user_id', input.userId)
        .select('user_id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) {
        throw new Error(
          "Couldn't update permission — you may not have access. Only the project lead or an admin can change roles."
        )
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

/** Remove a user from a project. Same RLS caveat as useUpdateProjectMemberRole. */
export function useRemoveProjectMember(projectId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) throw new Error('projectId required')
      const { data, error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select('user_id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) {
        throw new Error(
          "Couldn't remove member — you may not have access. Only the project lead or an admin can remove members."
        )
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all })
    },
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

/** Invite a user to a project by email. Adds them directly to
 *  `project_members` if their email is already registered, otherwise creates
 *  a pending row in `project_invites`. */
export function useInviteToProject(projectId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; role: ProjectRoleDb }) => {
      if (!projectId) throw new Error('projectId required')
      const result = await inviteToProject({
        project_id: projectId,
        email: input.email,
        role: input.role,
      })
      if ('error' in result) {
        if (result.error === 'already_member') {
          throw new Error('That user is already a member of this project.')
        }
        throw new Error(result.error)
      }
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all })
    },
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

// ─── Knowledge docs ─────────────────────────────────────────────────────────

export function useCreateKnowledgeDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewDocInput) => {
      const r = await createKnowledgeDoc(input)
      if ('error' in r) throw new Error(r.error)
      return r
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.project.docs(variables.project_id) })
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { projectId: string; patch: ProjectPatch }) => {
      const r = await updateProject(input.projectId, input.patch)
      if ('error' in r) throw new Error(r.error)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.project.one(variables.projectId) })
      qc.invalidateQueries({ queryKey: queryKeys.projects.all })
    },
  })
}

export function useDeleteKnowledgeDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { docId: string; projectId: string }) => {
      const r = await deleteKnowledgeDoc(input.docId)
      if ('error' in r) throw new Error(r.error)
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.project.docs(variables.projectId) })
    },
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

// ─── AI agent conversations ────────────────────────────────────────────────

export type AgentConversation = {
  id: string
  org_id: string | null
  project_id: string | null
  title: string | null
  created_at: string
}

export type AgentMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  created_at: string
}

/** List the user's recent AI conversations in an org. Sessions are no longer
 *  partitioned by project — context is per-message via the panel's chips. */
export function useAgentConversations(scope: {
  orgId?: string | null
  enabled?: boolean
}) {
  const orgId = scope.orgId ?? null
  return useQuery({
    queryKey: queryKeys.agentChats.list(orgId, null),
    enabled: scope.enabled !== false,
    queryFn: async (): Promise<AgentConversation[]> => {
      const params = new URLSearchParams({ limit: '50' })
      if (orgId) params.set('org_id', orgId)
      const r = await aiFetch(`/agent/conversations?${params.toString()}`, {
        method: 'GET',
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      return j.conversations as AgentConversation[]
    },
  })
}

/** Fetch one conversation's messages. */
export function useAgentMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.agentChats.messages(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async (): Promise<{
      conversation: AgentConversation
      messages: AgentMessage[]
    }> => {
      const r = await aiFetch(
        `/agent/conversations/${conversationId}/messages?limit=200`,
        { method: 'GET' },
      )
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    },
  })
}

/** Delete an AI conversation. Invalidates the list cache. */
export function useDeleteAgentConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const r = await aiFetch(`/agent/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (!r.ok) {
        let detail = `HTTP ${r.status}`
        try {
          const j = await r.json()
          detail = typeof j.detail === 'string' ? j.detail : detail
        } catch {
          /* keep status */
        }
        throw new Error(detail)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentChats.all })
    },
  })
}
