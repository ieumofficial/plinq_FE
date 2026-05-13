import path from 'path'
import { readdir, readFile, stat } from 'fs/promises'
import { app, ipcMain, shell, BrowserWindow } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers/create-window'

type FindZoomResult =
  | {
      found: true
      filename: string
      bytes: Buffer
      mime: string
      folder: string
      scannedPath: string
    }
  | {
      found: false
      scannedPath: string
      reason:
        | 'no-zoom-folder'
        | 'no-subfolders'
        | 'no-audio-files'
        | 'all-too-small'
      /** Up to 5 most-recent subfolders with the audio files we saw inside. */
      checkedFolders: { folder: string; files: string[] }[]
    }

/**
 * Locate the audio (or video) file from the most recent Zoom recording
 * the user has on disk. Zoom saves under `<Documents>/Zoom/<timestamp>
 * <topic>/audio_only.m4a` — Electron's `app.getPath('documents')`
 * resolves the OS-, locale-, and OneDrive-redirection-correct Documents
 * folder. Returns a structured result that tells the renderer which
 * directory was actually scanned so the user can sanity-check.
 */
async function findLatestZoomRecording(): Promise<FindZoomResult> {
  const baseDir = path.join(app.getPath('documents'), 'Zoom')
  try {
    const s = await stat(baseDir)
    if (!s.isDirectory()) {
      return { found: false, scannedPath: baseDir, reason: 'no-zoom-folder', checkedFolders: [] }
    }
  } catch {
    return { found: false, scannedPath: baseDir, reason: 'no-zoom-folder', checkedFolders: [] }
  }

  const entries = await readdir(baseDir, { withFileTypes: true })
  const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  if (folders.length === 0) {
    return { found: false, scannedPath: baseDir, reason: 'no-subfolders', checkedFolders: [] }
  }
  const folderStats = await Promise.all(
    folders.map(async (name) => {
      const p = path.join(baseDir, name)
      const s = await stat(p)
      return { name, path: p, mtime: s.mtimeMs }
    }),
  )
  folderStats.sort((a, b) => b.mtime - a.mtime)

  const checked: { folder: string; files: string[] }[] = []
  let sawAudioButTooSmall = false

  // Check up to 10 most-recent subfolders so we cover Zoom restarting
  // numbering, in-progress folders, and folders without audio.
  for (const folder of folderStats.slice(0, 10)) {
    let files: string[] = []
    try {
      files = await readdir(folder.path)
    } catch {
      continue
    }
    checked.push({ folder: folder.name, files })
    // Prefer audio-only m4a (cheap to transcribe). Fall back to mp4.
    const m4a = files.find((f) => f.toLowerCase().endsWith('.m4a'))
    const mp4 =
      files.find((f) => /audio.*\.mp4$/i.test(f)) ??
      files.find((f) => f.toLowerCase().endsWith('.mp4'))
    const target = m4a ?? mp4
    if (!target) continue
    const filePath = path.join(folder.path, target)
    const s = await stat(filePath)
    // Skip files Zoom is still writing — but the old 100KB threshold
    // ruled out very short test recordings. 10KB still excludes a
    // half-finished header while letting <30 sec audio through.
    if (s.size < 10 * 1024) {
      sawAudioButTooSmall = true
      continue
    }
    const bytes = await readFile(filePath)
    const ext = path.extname(target).toLowerCase()
    const mime = ext === '.m4a' || ext === '.mp4' ? 'audio/mp4' : 'audio/mpeg'
    return {
      found: true,
      filename: target,
      bytes,
      mime,
      folder: folder.path,
      scannedPath: baseDir,
    }
  }
  return {
    found: false,
    scannedPath: baseDir,
    reason: sawAudioButTooSmall ? 'all-too-small' : 'no-audio-files',
    checkedFolders: checked.slice(0, 5),
  }
}

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

// Register custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('plinq', process.execPath, [
      path.resolve(process.argv[1]),
    ])
  }
} else {
  app.setAsDefaultProtocolClient('plinq')
}

let mainWindow: BrowserWindow | null = null

function handleDeepLink(url: string) {
  console.log('[plinq] Deep link received:', url)
  try {
    const parsed = new URL(url)
    console.log('[plinq] Parsed hostname:', parsed.hostname, 'pathname:', parsed.pathname)
    if (parsed.hostname === 'auth') {
      const accessToken = parsed.searchParams.get('access_token')
      const refreshToken = parsed.searchParams.get('refresh_token')
      console.log('[plinq] Tokens found:', !!accessToken, !!refreshToken, 'mainWindow:', !!mainWindow)
      if (accessToken && refreshToken && mainWindow) {
        mainWindow.webContents.send('auth-callback', {
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        mainWindow.focus()
        console.log('[plinq] Auth callback sent to renderer')
      }
    }
  } catch (e) {
    console.error('[plinq] Failed to handle deep link:', e)
  }
}

// macOS: catch deep link when app is already running
app.on('open-url', (event, url) => {
  console.log('[plinq] open-url event:', url)
  event.preventDefault()
  handleDeepLink(url)
})

;(async () => {
  // Windows/Linux: handle second instance with deep link
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }

  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith('plinq://'))
    if (url) handleDeepLink(url)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  await app.whenReady()

  // macOS: hiddenInset draws traffic lights inside our custom header.
  // Windows/Linux: frameless so we can render our own caption controls.
  const isMac = process.platform === 'darwin'
  mainWindow = createWindow('main', {
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    frame: isMac, // Windows/Linux: frameless
    // Center traffic lights vertically in the 64px header (lights are ~14px tall).
    trafficLightPosition: isMac ? { x: 16, y: 25 } : undefined,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./')
  } else {
    const port = process.argv[2]
    const devUrl = `http://localhost:${port}/`
    // If Next dev isn't quite ready yet (or has a transient compile
    // error), Chrome drops the renderer onto `chrome-error://chromewebdata/`
    // and stays stuck there — Ctrl+R reloads the error page itself.
    // Listen for the failure and re-issue the original loadURL after a
    // short delay so we recover automatically.
    mainWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, _errorDescription, validatedURL) => {
        if (errorCode === -3) return // navigation cancelled intentionally
        if (!mainWindow) return
        if (
          validatedURL === devUrl ||
          validatedURL.startsWith('chrome-error://')
        ) {
          setTimeout(() => {
            mainWindow?.loadURL(devUrl).catch(() => {
              /* will retry again on the next did-fail-load */
            })
          }, 1500)
        }
      },
    )
    await mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

// IPC: open URL in system browser
ipcMain.on('open-external', (_event, url: string) => {
  shell.openExternal(url)
})

// IPC: locate + read the most recent Zoom local recording so the renderer
// can upload it without a manual file picker. Returns the raw bytes plus
// the original filename/MIME the renderer needs to POST it.
ipcMain.handle('import-latest-zoom-recording', async () => {
  try {
    return await findLatestZoomRecording()
  } catch (e) {
    return {
      found: false as const,
      scannedPath: '',
      reason: 'no-zoom-folder' as const,
      checkedFolders: [],
      error: (e as Error).message,
    }
  }
})

// IPC: window controls (used by custom Windows caption buttons)
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on('window-close', () => {
  mainWindow?.close()
})

// IPC: open login in a separate BrowserWindow (fallback for deep link issues)
ipcMain.on('open-login-window', (_event, url: string) => {
  const loginWindow = new BrowserWindow({
    width: 500,
    height: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  loginWindow.loadURL(url)

  // Watch for plinq:// deep link redirect
  loginWindow.webContents.on('will-navigate', (_e, navUrl) => {
    if (navUrl.startsWith('plinq://')) {
      _e.preventDefault()
      handleDeepLink(navUrl)
      loginWindow.close()
    }
  })

  // Also catch redirect via will-redirect
  loginWindow.webContents.on('will-redirect', (_e, navUrl) => {
    if (navUrl.startsWith('plinq://')) {
      _e.preventDefault()
      handleDeepLink(navUrl)
      loginWindow.close()
    }
  })
})
