import { dialog, type BrowserWindow } from 'electron'
import path from 'path'
import { SUPPORTED_FORMATS } from '../shared/constants'

// Video-Oeffnen Dialog — parentWindow fuer macOS Sheet-Modal (fix #164)
export function showOpenVideoDialog(parentWindow?: BrowserWindow) {
  const options = {
    properties: ['openFile'] as const,
    filters: [
      {
        name: 'Video Files',
        extensions: SUPPORTED_FORMATS.map((fmt) => fmt.replace('.', '')),
      },
      {
        name: 'All Files',
        extensions: ['*'],
      },
    ],
  }
  return parentWindow
    ? dialog.showOpenDialog(parentWindow, options)
    : dialog.showOpenDialog(options)
}

// Projekt-Speichern Dialog
export function showSaveProjectDialog(parentWindow?: BrowserWindow) {
  const options = {
    title: 'Save Project',
    defaultPath: path.join(process.env.HOME || process.env.USERPROFILE || '', 'ShotSheetProjects'),
    filters: [
      {
        name: 'Project Folder',
        extensions: [] as string[],
      },
    ],
  }
  return parentWindow
    ? dialog.showSaveDialog(parentWindow, options)
    : dialog.showSaveDialog(options)
}

// Projekt-Oeffnen Dialog
export function showOpenProjectDialog(parentWindow?: BrowserWindow) {
  const options = {
    title: 'Open Project',
    defaultPath: path.join(process.env.HOME || process.env.USERPROFILE || '', 'ShotSheetProjects'),
    properties: ['openDirectory'] as const,
  }
  return parentWindow
    ? dialog.showOpenDialog(parentWindow, options)
    : dialog.showOpenDialog(options)
}

// Export-Verzeichnis Dialog
export function showExportDirDialog(parentWindow?: BrowserWindow) {
  const options = {
    title: 'Select Export Directory',
    properties: ['openDirectory', 'createDirectory'] as const,
  }
  return parentWindow
    ? dialog.showOpenDialog(parentWindow, options)
    : dialog.showOpenDialog(options)
}

// Ungespeicherte Aenderungen Dialog
// Gibt zurueck: 'save' | 'discard' | 'cancel'
export function showUnsavedChangesDialog(parentWindow?: BrowserWindow): Promise<string> {
  const options = {
    type: 'question' as const,
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Do you want to save them?',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  }
  const promise = parentWindow
    ? dialog.showMessageBox(parentWindow, options)
    : dialog.showMessageBox(options)
  return promise.then((result) => {
    const responses = ['save', 'discard', 'cancel']
    return responses[result.response]
  })
}

// Fehler-Dialog
export function showErrorDialog(title: string, message: string): void {
  dialog.showErrorBox(title, message)
}

// Info-Dialog
export function showInfoDialog(title: string, message: string, parentWindow?: BrowserWindow) {
  const options = {
    type: 'info' as const,
    title,
    message,
    buttons: ['OK'],
  }
  return parentWindow
    ? dialog.showMessageBox(parentWindow, options)
    : dialog.showMessageBox(options)
}

export default {
  showOpenVideoDialog,
  showSaveProjectDialog,
  showOpenProjectDialog,
  showExportDirDialog,
  showUnsavedChangesDialog,
  showErrorDialog,
  showInfoDialog,
}
