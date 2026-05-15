/**
 * App-wide action feedback ("toast") system.
 *
 *   const toast = useToast()
 *   toast.success('Project created')
 *   toast.error('Couldn't save changes', 'Please try again.')
 *
 * Visual language matches the rest of the app: white card, 1px
 * gray-border-light border, rounded-[10px], shadow-md, Wanted Sans,
 * 12px text, and the same green/red/blue `-light` + `-main` colour pairs
 * used by DeleteConfirmModal / status chips.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Icon from '../components/ui/Icon'

type Variant = 'success' | 'error' | 'info'

type Toast = {
  id: number
  variant: Variant
  title: string
  description?: string
}

type ToastApi = {
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Errors linger longer than confirmations so they aren't missed. */
const DURATION: Record<Variant, number> = {
  success: 3200,
  info: 3600,
  error: 5200,
}

const VARIANT_STYLE: Record<
  Variant,
  { chipBg: string; chipFg: string }
> = {
  success: { chipBg: 'bg-green-light', chipFg: 'text-green-main' },
  error: { chipBg: 'bg-red-light', chipFg: 'text-red-main' },
  info: { chipBg: 'bg-blue-light', chipFg: 'text-blue-main' },
}

function VariantIcon({ variant }: { variant: Variant }) {
  if (variant === 'error') return <Icon name="Warning" size={15} />
  if (variant === 'info') return <Icon name="Notification" size={15} />
  // No "check" glyph in the icon set — use an inline tick matching the
  // stroke style used elsewhere in the app (e.g. the action-item check).
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 7L6 10L11 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: number) => void
}) {
  const s = VARIANT_STYLE[toast.variant]
  return (
    <div
      role="status"
      className="bg-white-white border border-solid border-gray-border-light rounded-[10px] shadow-md px-[15px] py-[12px] flex items-start gap-[10px] w-[320px] max-w-[calc(100vw-32px)] pointer-events-auto"
    >
      <span
        className={`${s.chipBg} ${s.chipFg} rounded-[5px] w-[28px] h-[28px] inline-flex items-center justify-center shrink-0`}
      >
        <VariantIcon variant={toast.variant} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-[2px] pt-[2px]">
        <p className="text-black text-[12px] font-semibold leading-snug">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-gray-main text-[12px] leading-snug">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="text-gray-secondary hover:text-black shrink-0 -mr-[4px] -mt-[2px] p-[2px]"
      >
        <Icon name="Cross" size={12} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const tm = timers.current.get(id)
    if (tm) {
      clearTimeout(tm)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (variant: Variant, title: string, description?: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, variant, title, description }])
      const tm = setTimeout(() => dismiss(id), DURATION[variant])
      timers.current.set(id, tm)
    },
    [dismiss]
  )

  const api = useRef<ToastApi>({
    success: (t, d) => push('success', t, d),
    error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d),
  })
  // Keep closures current (push identity is stable, but be safe).
  api.current = {
    success: (t, d) => push('success', t, d),
    error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d),
  }

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      {/* Above modals (z-50/60). Bottom-right stack, newest on top. */}
      <div className="fixed bottom-[16px] right-[16px] z-[100] flex flex-col-reverse gap-[10px] pointer-events-none">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Returns the toast api. Safe to call anywhere under <ToastProvider>; if the
 *  provider is somehow missing it no-ops rather than throwing, so a missing
 *  wrapper never crashes an action handler. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (ctx) return ctx
  return {
    success: () => {},
    error: () => {},
    info: () => {},
  }
}
