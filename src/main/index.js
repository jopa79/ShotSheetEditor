const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
} = require('electron');
const path = require('path');
const windowManager = require('./windowManager');
const ipcHandlers = require('./ipcHandlers');
const proxyGenerator = require('./proxyGenerator');
const { IPC_CHANNELS, QUIT_TIMEOUT_MS } = require('../shared/constants');

let mainWindow;
let quitTimer = null;

// Create window and setup handlers
async function onReady() {
  try {
    mainWindow = await windowManager.createMainWindow();
    ipcHandlers.registerIpcHandlers(mainWindow);
    buildMenu();
  } catch (error) {
    console.error('Failed to create window:', error);
    app.quit();
  }
}

// Helper to send messages to renderer
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// Helper: Send unified menu action to renderer
function sendMenuAction(action) {
  sendToRenderer(IPC_CHANNELS.MENU_ACTION, action);
}

// Build application menu
function buildMenu() {
  const template = [
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
            app.quit();
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
              mainWindow.webContents.toggleDevTools();
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
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle before-quit with timeout safety
// Notify renderer so it can prompt the user if needed
let isQuitting = false;

app.on('before-quit', (event) => {
  // Laufendes Transcoding sofort abbrechen
  proxyGenerator.cancelTranscoding();

  if (isQuitting) return; // Already confirmed, allow quit

  if (mainWindow && !mainWindow.isDestroyed()) {
    event.preventDefault();

    // Set a timeout to force quit if renderer doesn't respond
    quitTimer = setTimeout(() => {
      console.warn('Quit confirmation timeout, forcing quit');
      isQuitting = true;
      app.exit(0);
    }, QUIT_TIMEOUT_MS);

    // Tell renderer we're about to quit — it will call confirmQuit IPC
    mainWindow.webContents.send(IPC_CHANNELS.APP_BEFORE_QUIT);
  }
});

// Renderer calls this after handling quit confirmation
ipcMain.handle(IPC_CHANNELS.APP_CONFIRM_QUIT, (_event) => {
  if (quitTimer) {
    clearTimeout(quitTimer);
    quitTimer = null;
  }

  // Cancel any in-flight operations before exiting
  try {
    const sceneDetector = require('./sceneDetector');
    sceneDetector.cancelDetection();
  } catch (_e) {
    // Ignore if module not loaded
  }

  isQuitting = true;
  app.exit(0);
});

// Handle window closed
app.on('window-all-closed', () => {
  // macOS: Keep app running until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: Re-create window when dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    onReady();
  }
});

// App lifecycle
app.on('ready', onReady);

// Cleanup on quit — Proxy-Dateien aufräumen
app.on('quit', () => {
  if (quitTimer) {
    clearTimeout(quitTimer);
  }
  proxyGenerator.cleanupProxies();
});

// Expose sendToRenderer for handlers
module.exports = { sendToRenderer };
