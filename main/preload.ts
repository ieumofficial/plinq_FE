import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const handler = {
  send<T>(channel: string, value?: T) {
    ipcRenderer.send(channel, value)
  },
  on<T>(channel: string, callback: (...args: T[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: T[]) =>
      callback(...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  /** Request a value from a main-process handler (registered via
   *  `ipcMain.handle(channel, ...)`). Mirrors `ipcRenderer.invoke`. */
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    return ipcRenderer.invoke(channel, ...args) as Promise<T>
  },
}

contextBridge.exposeInMainWorld('ipc', handler)

// Expose platform info synchronously so the renderer can render
// the right title-bar layout on first paint (no IPC round-trip).
const platform = {
  /** 'darwin' | 'win32' | 'linux' | etc. */
  os: process.platform as NodeJS.Platform,
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
}

contextBridge.exposeInMainWorld('platform', platform)

export type IpcHandler = typeof handler
export type PlatformInfo = typeof platform
