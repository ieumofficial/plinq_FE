/**
 * Centralized React Query keys.
 * Use the helpers below in useQuery({ queryKey: keys.X(...) }) and
 * queryClient.invalidateQueries({ queryKey: keys.X.partial }) so spelling
 * mistakes can't break invalidation.
 */

export const queryKeys = {
  currentUser: () => ['currentUser'] as const,

  myOrg: (userId: string | null | undefined) => ['myOrg', userId ?? null] as const,

  projects: {
    all: ['projects'] as const,
    list: (
      userId: string,
      opts?: { statuses?: string[]; limit?: number }
    ) => ['projects', 'list', userId, opts ?? null] as const,
  },

  tasks: {
    all: ['tasks'] as const,
    actionItems: (
      userId: string,
      opts?: { includeDone?: boolean; limit?: number }
    ) => ['tasks', 'actionItems', userId, opts ?? null] as const,
  },

  meetings: {
    all: ['meetings'] as const,
    upcoming: (
      userId: string,
      opts?: { fromIso?: string; toIso?: string; limit?: number }
    ) => ['meetings', 'upcoming', userId, opts ?? null] as const,
  },

  calendar: {
    all: ['calendar'] as const,
    range: (userId: string, fromIso: string, toIso: string) =>
      ['calendar', 'range', userId, fromIso, toIso] as const,
  },

  members: {
    org: (orgId: string) => ['members', 'org', orgId] as const,
    project: (projectId: string) => ['members', 'project', projectId] as const,
    projectWithRoles: (projectId: string) =>
      ['members', 'project', projectId, 'roles'] as const,
  },

  project: {
    one: (projectId: string) => ['project', projectId] as const,
    counts: (projectId: string) => ['project', projectId, 'counts'] as const,
    tasks: (projectId: string) => ['project', projectId, 'tasks'] as const,
    meetings: (projectId: string) => ['project', projectId, 'meetings'] as const,
    docs: (projectId: string) => ['project', projectId, 'docs'] as const,
  },

  chat: {
    all: ['chat'] as const,
    sessions: (userId: string, orgId: string) =>
      ['chat', 'sessions', userId, orgId] as const,
    messages: (sessionId: string) => ['chat', 'messages', sessionId] as const,
  },
}
