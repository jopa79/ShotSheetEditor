import { dialog } from 'electron'
import path from 'path'
import { SUPPORTED_FORMATS } from '../shared/constants'

// Video-Oeffnen Dialog
export function showOpenVideoDialog() {
  return dialog.showOpenDialog({
    properties: ['openFile'],
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
  })
}

// Projekt-Speichern Dialog
export function showSaveProjectDialog() {
  return dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: path.join(process.env.HOME || process.env.USERPROFILE || '', 'ShotSheetProjects'),
    filters: [
      {
        name: 'Project Folder',
        extensions: [],
      },
    ],
  })
}

// Projekt-Oeffnen Dialog
export function showOpenProjectDialog() {
  return dialog.showOpenDialog({
    title: 'Open Project',
    defaultPath: path.join(process.env.HOME || process.env.USERPROFILE || '', 'ShotSheetProjects'),
    properties: ['openDirectory'],
  })
}

// Export-Verzeichnis Dialog
export function showExportDirDialog() {
  return dialog.showOpenDialog({
    title: 'Select Export Directory',
    properties: ['openDirectory', 'createDirectory'],
  })
}

// Ungespeicherte Aenderungen Dialog
// Gibt zurueck: 'save' | 'discard' | 'cancel'
export function showUnsavedChangesDialog(): Promise<string> {
  return dialog
    .showMessageBox({
      type: 'question',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to save them?',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    })
    .then((result) => {
      const responses = ['save', 'discard', 'cancel']
      return responses[result.response]
    })
}

// Fehler-Dialog
export function showErrorDialog(title: string, message: string): void {
  dialog.showErrorBox(title, message)
}

// Info-Dialog
export function showInfoDialog(title: string, message: string) {
  return dialog.showMessageBox({
    type: 'info',
    title,
    message,
    buttons: ['OK'],
  })
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
