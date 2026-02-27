const {
  BrowserWindow,
  nativeTheme,
  app,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { WINDOW_DEFAULTS } = require('../shared/constants');

let mainWindow = null;
let windowStateSaveTimer = null;

// Get window state file path
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'windowState.json');
}

// Load saved window state
function loadWindowState() {
  try {
    const statePath = getWindowStatePath();
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      return state;
    }
  } catch (error) {
    console.warn('Failed to load window state:', error);
  }
  return null;
}

// Save window state (debounced)
function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    const bounds = mainWindow.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    };

    const statePath = getWindowStatePath();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

// Debounced save to avoid excessive writes
function debouncedSaveWindowState() {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
  }
  windowStateSaveTimer = setTimeout(saveWindowState, 1000);
}

// Get theme source from storage
function getThemeSource() {
  try {
    const themePath = path.join(app.getPath('userData'), 'theme.json');
    if (fs.existsSync(themePath)) {
      const data = JSON.parse(fs.readFileSync(themePath, 'utf8'));
      return data.theme || 'system';
    }
  } catch (error) {
    console.warn('Failed to load theme:', error);
  }
  return 'system';
}

// Save theme preference
function setThemeSource(theme) {
  try {
    const themePath = path.join(app.getPath('userData'), 'theme.json');
    fs.writeFileSync(themePath, JSON.stringify({ theme }, null, 2), 'utf8');
    nativeTheme.themeSource = theme;
  } catch (error) {
    console.error('Failed to save theme:', error);
  }
}

// Toggle theme between 'light' and 'dark'
function toggleTheme() {
  const current = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setThemeSource(next);
  return next;
}

// Create main window
async function createMainWindow() {
  return new Promise((resolve, reject) => {
    try {
      // Load saved window state or use defaults
      const savedState = loadWindowState();
      const windowOptions = {
        ...(savedState || {}),
        width: savedState?.width || WINDOW_DEFAULTS.width,
        height: savedState?.height || WINDOW_DEFAULTS.height,
        minWidth: WINDOW_DEFAULTS.minWidth,
        minHeight: WINDOW_DEFAULTS.minHeight,
        show: false,
        backgroundColor: '#0e0f11', // Prevent white flash
        webPreferences: {
          preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          enableRemoteModule: false,
        },
        icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      };

      mainWindow = new BrowserWindow(windowOptions);

      // Load HTML — no build step, load directly from src
      const htmlPath = `file://${path.join(__dirname, '..', 'renderer', 'index.html')}`;

      mainWindow.loadURL(htmlPath).catch((error) => {
        console.error('Failed to load URL:', error);
        reject(error);
      });

      // Show window when ready
      mainWindow.once('ready-to-show', () => {
        if (savedState?.isMaximized) {
          mainWindow.maximize();
        }
        mainWindow.show();
        resolve(mainWindow);
      });

      // Save window state on resize/move
      mainWindow.on('resize', debouncedSaveWindowState);
      mainWindow.on('move', debouncedSaveWindowState);

      // Cleanup on close
      mainWindow.on('closed', () => {
        saveWindowState();
        mainWindow = null;
      });

      // Setup theme
      const themeSrc = getThemeSource();
      nativeTheme.themeSource = themeSrc;

    } catch (error) {
      reject(error);
    }
  });
}

// Get main window instance
function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createMainWindow,
  getMainWindow,
  toggleTheme,
  setThemeSource,
  getThemeSource,
  saveWindowState,
};
