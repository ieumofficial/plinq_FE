import { IpcHandler, PlatformInfo } from '../main/preload'

declare global {
  interface Window {
    ipc: IpcHandler
    platform: PlatformInfo
  }
}
