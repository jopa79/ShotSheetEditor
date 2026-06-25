import { app, BrowserWindow, Menu, ipcMain, type MenuItemConstructorOptions } from 'electron'
import windowManager from './windowManager'
import ipcHandlers from './ipcHandlers'
import proxyGenerator from './proxyGenerator'
import { IPC_CHANNELS, QUIT_TIMEOUT_MS } from '../shared/constants'
import sceneDetector from './sceneDetector'
import protocolHandler from './protocolHandler'
import { killAll as killAllFFmpegJobs } from './ffmpegJobManager'
import { cancelTranscription } from './transcriber'

// Scheme vor app.ready registrieren — zwingend fuer stream: true
protocolHandler.registerSchemes()

let mainWindow: BrowserWindow | undefined
let quitTimer: ReturnType<typeof setTimeout> | null = null
// IPC-Handler nur einmal registrieren — verhindert doppelte Registrierung bei activate (fix #171)
let _ipcHandlersRegistered = false

// Fenster erstellen und Handler einrichten
async function onReady(): Promise<void> {
  try {
    // IPC-Handler VOR Fenster-Erstellung registrieren — verhindert Race Condition
    // (Renderer ruft sofort getVersion/getTheme auf beim Laden)
    if (!_ipcHandlersRegistered) {
      ipcHandlers.registerIpcHandlers(() => mainWindow)
      _ipcHandlersRegistered = true
    }
    mainWindow = await windowManager.createMainWindow()
    protocolHandler.registerProtocolHandler()
    buildMenu()
  } catch (error) {
    console.error('Failed to create window:', error)
    app.quit()
  }
}

// Nachrichten an Renderer senden
function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// Einheitliche Menue-Aktion an Renderer senden
function sendMenuAction(action: string): void {
  sendToRenderer(IPC_CHANNELS.MENU_ACTION, action)
}

// Applikations-Menue erstellen
function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Video',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('file:openVideo'),
        },
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('file:new'),
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('file:open'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('file:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('file:saveAs'),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit()
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction('edit:undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendMenuAction('edit:redo'),
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => sendMenuAction('edit:selectAll'),
        },
        {
          label: 'Deselect',
          accelerator: 'CmdOrCtrl+D',
          click: () => sendMenuAction('edit:deselect'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => sendMenuAction('view:toggleTheme'),
        },
        {
          label: 'Generate Waveform',
          click: () => sendMenuAction('view:generateWaveform'),
        },
        {
          label: 'Transcribe…',
          click: () => sendMenuAction('view:transcribe'),
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => sendMenuAction('view:zoomIn'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+Minus',
          click: () => sendMenuAction('view:zoomOut'),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendMenuAction('view:zoomReset'),
        },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools()
            }
          },
        },
      ],
    },
    {
      label: 'Export',
      submenu: [
        {
          label: 'Export Sequence',
          click: () => sendMenuAction('export:sequence'),
        },
        {
          label: 'Export ZIP',
          click: () => sendMenuAction('export:zip'),
        },
        { type: 'separator' },
        {
          label: 'Export Clips (H.264)',
          click: () => sendMenuAction('export:clipsH264'),
        },
        {
          label: 'Export Clips (ProRes)',
          click: () => sendMenuAction('export:clipsProRes'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// before-quit mit Timeout-Safety behandeln
let isQuitting = false

app.on('before-quit', (event) => {
  // Alle laufenden ffmpeg-Jobs sofort abbrechen (verhindert orphaned Prozesse).
  // killAll() erfasst seit Welle 2 auch detect-Jobs (sceneDetector migriert).
  killAllFFmpegJobs()
  proxyGenerator.cancelTranscoding()
  // cancelDetection() bleibt als explizite Sicherheit (setzt _activeDetectJob=null,
  // idempotent — schadet nicht wenn killAll() den Prozess bereits beendet hat)
  sceneDetector.cancelDetection()
  cancelTranscription() // whisper laeuft mit eigenem spawn → sonst orphaned

  if (isQuitting) return

  if (mainWindow && !mainWindow.isDestroyed()) {
    event.preventDefault()

    quitTimer = setTimeout(() => {
      console.warn('Quit confirmation timeout, forcing quit')
      isQuitting = true
      app.exit(0)
    }, QUIT_TIMEOUT_MS)

    mainWindow.webContents.send(IPC_CHANNELS.APP_BEFORE_QUIT)
  }
})

// Renderer ruft dies nach Quit-Bestaetigung auf
ipcMain.handle(IPC_CHANNELS.APP_CONFIRM_QUIT, () => {
  if (quitTimer) {
    clearTimeout(quitTimer)
    quitTimer = null
  }

  try {
    // cancelDetection() als explizite Sicherheit (idempotent, killAll() erfasst detect bereits)
    sceneDetector.cancelDetection()
    cancelTranscription()
    // Alle noch laufenden ffmpeg-Jobs beenden (inkl. Frame-Extractions und detect-Jobs seit Welle 2)
    killAllFFmpegJobs()
  } catch {
    // Ignorieren falls keine Jobs laufen
  }

  isQuitting = true
  app.exit(0)
})

// Alle Fenster geschlossen
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS: Fenster neu erstellen wenn Dock-Icon geklickt wird
app.on('activate', () => {
  if (mainWindow === undefined || (mainWindow as BrowserWindow).isDestroyed()) {
    onReady()
  }
})

// App-Lifecycle
app.on('ready', onReady)

// Cleanup beim Beenden
app.on('quit', () => {
  if (quitTimer) {
    clearTimeout(quitTimer)
  }
  windowManager.cleanupWindowState()
  proxyGenerator.cleanupProxies()
})

export { sendToRenderer }
