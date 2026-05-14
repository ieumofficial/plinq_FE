/**
 * App-wide host for the project preview modal. Any page can call
 * `useProjectPreview().open(projectId)` to surface the modal instead of
 * routing straight to the project's dashboard.
 *
 * Mount once at the top of the tree (`_app.tsx`).
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import ProjectPreviewModal from './ProjectPreviewModal'

type Api = {
  /** Open the preview for the given project id. */
  open: (projectId: string) => void
  /** Force-close the preview (rarely needed — modal closes itself). */
  close: () => void
}

const Ctx = createContext<Api | null>(null)

/** Hook for any descendant — open the preview for a given project. Falls
 *  back to a no-op outside the provider so callers don't have to null-check. */
export function useProjectPreview(): Api {
  const ctx = useContext(Ctx)
  if (ctx) return ctx
  return {
    open: () => {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.warn('useProjectPreview used outside provider — ignoring')
      }
    },
    close: () => {},
  }
}

export default function ProjectPreviewProvider({
  children,
}: {
  children: ReactNode
}) {
  const [projectId, setProjectId] = useState<string | null>(null)

  const open = useCallback((id: string) => setProjectId(id), [])
  const close = useCallback(() => setProjectId(null), [])

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <ProjectPreviewModal
        open={projectId !== null}
        projectId={projectId}
        onClose={close}
      />
    </Ctx.Provider>
  )
}
