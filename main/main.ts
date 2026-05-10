import path from 'path'
import { app, ipcMain, shell, BrowserWindow } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers/create-window'

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
    await mainWindow.loadURL(`http://localhost:${port}/`)
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
