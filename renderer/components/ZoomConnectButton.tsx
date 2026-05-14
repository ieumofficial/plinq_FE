import { useEffect, useRef, useState } from 'react'
import { zoomBackend, type ZoomStatus } from '../lib/zoomBackend'

type Props = {
  onChange?: (connected: boolean) => void
}

/**
 * Drives the Zoom OAuth flow:
 *   1. Asks Supabase Edge Function for an authorize URL
 *   2. Opens it externally (system browser via Electron IPC, fallback popup
 *      when running in a plain browser preview)
 *   3. Polls `zoom-status` every 2s until tokens land (or 5min timeout)
 *
 * Ported from plow_FE/renderer/components/ZoomConnectButton.tsx — the only
 * differences are the backend client (`zoomBackend` over Supabase Functions
 * instead of `backend` over Express) and the external-link mechanism
 * (Electron IPC when available).
 */
export default function ZoomConnectButton({ onChange: _onChange }: Props) {
  // Zoom integration is parked until the backend (zoom-* endpoints in
  // plinq_ai) lands in Phase 3.5. Render a disabled stub so the slot
  // stays in the layout — full implementation below this guard.
  return (
    <button
      type="button"
      disabled
      title="Zoom integration coming in a future release"
      className="px-[12px] py-[6px] rounded-md bg-[#2D8CFF]/40 text-white font-medium text-[13px] leading-[20px] tracking-[0.2px] cursor-not-allowed inline-flex items-center gap-[6px]"
    >
      Connect Zoom
      <span className="text-[10px] uppercase tracking-[1px] bg-white/30 rounded px-[5px] py-[1px]">
        Soon
      </span>
    </button>
  )

  // ─── Original implementation (re-enable in Phase 3.5) ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-unreachable-code, @typescript-eslint/no-unused-vars
  const [status, setStatus] = useState<ZoomStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  async function refresh() {
    try {
      const s = await zoomBackend.status()
      setStatus(s)
      onChange?.(s.connected)
    } catch (e) {
      setError(`Zoom status failed: ${(e as Error).message}`)
    }
  }

  useEffect(() => {
    refresh()
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openExternal(url: string) {
    // In the Electron renderer the preload script exposes window.ipc;
    // outside Electron (browser preview) fall back to window.open.
    if (typeof window !== 'undefined' && window.ipc) {
      window.ipc.send('open-external', url)
    } else {
      window.open(url, '_blank', 'width=560,height=720')
    }
  }

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await zoomBackend.authUrl()
      openExternal(url)
      // Poll for connected status every 2s for up to 5 min.
      const startedAt = Date.now()
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await zoomBackend.status()
          if (s.connected) {
            window.clearInterval(pollRef.current!)
            pollRef.current = null
            setStatus(s)
            onChange?.(true)
            setBusy(false)
          } else if (Date.now() - startedAt > 5 * 60 * 1000) {
            window.clearInterval(pollRef.current!)
            pollRef.current = null
            setBusy(false)
          }
        } catch {
          // ignore intermittent failures
        }
      }, 2000) as unknown as number
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await zoomBackend.disconnect()
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <span className="text-[12px] text-gray-main">Checking Zoom…</span>
    )
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-[10px]">
        <span className="inline-flex items-center gap-[6px] px-[10px] py-[4px] rounded-full bg-green-light text-green-main text-[12px] font-medium">
          ● Zoom Connected
        </span>
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="text-[12px] text-gray-main underline bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-[8px]">
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="px-[12px] py-[6px] rounded-md bg-[#2D8CFF] text-white font-medium text-[13px] leading-[20px] tracking-[0.2px] cursor-pointer disabled:opacity-50"
      >
        {busy ? 'Waiting…' : 'Connect Zoom'}
      </button>
      {error && (
        <span className="text-[12px] text-red-med">{error}</span>
      )}
    </div>
  )
}
