import { BrowserWindow, nativeTheme, app, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { WINDOW_DEFAULTS } from '../shared/constants'

let mainWindow: BrowserWindow | null = null
let windowStateSaveTimer: ReturnType<typeof setTimeout> | null = null

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

// Window-State Dateipfad
function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'windowState.json')
}

// Gespeicherten Window-State laden
function loadWindowState(): WindowState | null {
  try {
    const statePath = getWindowStatePath()
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      return state
    }
  } catch (error) {
    console.warn('Failed to load window state:', error)
  }
  return null
}

// Window-State speichern
function saveWindowState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  try {
    const bounds = mainWindow.getBounds()
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    }

    const statePath = getWindowStatePath()
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8')
  } catch (error) {
    console.error('Failed to save window state:', error)
  }
}

// Debounced Save — vermeidet exzessives Schreiben
function debouncedSaveWindowState(): void {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer)
  }
  windowStateSaveTimer = setTimeout(saveWindowState, 1000)
}

// Theme-Quelle aus Storage laden
export function getThemeSource(): string {
  try {
    const themePath = path.join(app.getPath('userData'), 'theme.json')
    if (fs.existsSync(themePath)) {
      const data = JSON.parse(fs.readFileSync(themePath, 'utf8'))
      return data.theme || 'system'
    }
  } catch (error) {
    console.warn('Failed to load theme:', error)
  }
  return 'system'
}

// Theme-Praeferenz speichern
export function setThemeSource(theme: string): void {
  try {
    const themePath = path.join(app.getPath('userData'), 'theme.json')
    fs.writeFileSync(themePath, JSON.stringify({ theme }, null, 2), 'utf8')
    nativeTheme.themeSource = theme as 'dark' | 'light' | 'system'
  } catch (error) {
    console.error('Failed to save theme:', error)
  }
}

// Theme umschalten (dark <-> light)
export function toggleTheme(): string {
  const current = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  setThemeSource(next)
  return next
}

// Hauptfenster erstellen
export async function createMainWindow(): Promise<BrowserWindow> {
  return new Promise((resolve, reject) => {
    try {
      const savedState = loadWindowState()

      // Fenster-Position validieren — verhindert off-screen nach Monitor-Trennung (fix #113)
      if (savedState && (savedState.x !== undefined || savedState.y !== undefined)) {
        const displays = screen.getAllDisplays()
        const isOnScreen = displays.some((display) => {
          const bounds = display.bounds
          return (
            (savedState.x ?? 0) >= bounds.x - 100 &&
            (savedState.y ?? 0) >= bounds.y - 100 &&
            (savedState.x ?? 0) < bounds.x + bounds.width &&
            (savedState.y ?? 0) < bounds.y + bounds.height
          )
        })
        if (!isOnScreen) {
          delete savedState.x
          delete savedState.y
        }
      }

      const windowOptions = {
        ...(savedState || {}),
        width: savedState?.width || WINDOW_DEFAULTS.width,
        height: savedState?.height || WINDOW_DEFAULTS.height,
        minWidth: WINDOW_DEFAULTS.minWidth,
        minHeight: WINDOW_DEFAULTS.minHeight,
        show: false,
        backgroundColor: '#0e0f11',
        webPreferences: {
          preload: path.join(__dirname, '..', 'preload', 'index.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          enableRemoteModule: false,
        },
        icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      }

      mainWindow = new BrowserWindow(windowOptions)

      // electron-vite: Dev -> Vite Dev-Server, Prod -> kompilierter Output
      if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL).catch((error) => {
          console.error('Failed to load dev URL:', error)
          reject(error)
        })
      } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html')).catch((error) => {
          console.error('Failed to load file:', error)
          reject(error)
        })
      }

      // Fallback: ready-to-show Timeout nach 10s (fix #102)
      const showTimeout = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
          console.warn('WindowManager: ready-to-show timeout, forcing show')
          mainWindow.show()
          resolve(mainWindow)
        }
      }, 10000)

      // Navigation ausserhalb der App verhindern
      mainWindow.webContents.on('will-navigate', (event) => {
        event.preventDefault()
      })

      // Neue Fenster/Popups verhindern
      mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' }
      })

      // Fenster anzeigen wenn bereit
      mainWindow.once('ready-to-show', () => {
        clearTimeout(showTimeout)
        if (savedState?.isMaximized) {
          mainWindow!.maximize()
        }
        mainWindow!.show()
        resolve(mainWindow!)
      })

      // Window-State bei Resize/Move speichern
      mainWindow.on('resize', debouncedSaveWindowState)
      mainWindow.on('move', debouncedSaveWindowState)

      // Aufraumen beim Schliessen
      mainWindow.on('closed', () => {
        saveWindowState()
        mainWindow = null
      })

      // Theme einrichten
      const themeSrc = getThemeSource()
      nativeTheme.themeSource = themeSrc as 'dark' | 'light' | 'system'
    } catch (error) {
      reject(error)
    }
  })
}

// Hauptfenster-Instanz zurueckgeben
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// Timer aufraeumen — verhindert Memory Leak beim App-Quit (fix #158)
export function cleanupWindowState(): void {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer)
    windowStateSaveTimer = null
  }
}

export default {
  createMainWindow,
  getMainWindow,
  toggleTheme,
  setThemeSource,
  getThemeSource,
  saveWindowState,
  cleanupWindowState,
}
