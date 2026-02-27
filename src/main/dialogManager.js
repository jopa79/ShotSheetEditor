const { dialog } = require('electron');
const path = require('path');
const { SUPPORTED_FORMATS } = require('../shared/constants');

// Show open video dialog
function showOpenVideoDialog() {
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
  });
}

// Show save project dialog
function showSaveProjectDialog() {
  return dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: path.join(process.env.HOME || process.env.USERPROFILE, 'ShotSheetProjects'),
    filters: [
      {
        name: 'Project Folder',
        extensions: [],
      },
    ],
  });
}

// Show open project dialog
function showOpenProjectDialog() {
  return dialog.showOpenDialog({
    title: 'Open Project',
    defaultPath: path.join(process.env.HOME || process.env.USERPROFILE, 'ShotSheetProjects'),
    properties: ['openDirectory'],
  });
}

// Show export directory dialog
function showExportDirDialog() {
  return dialog.showOpenDialog({
    title: 'Select Export Directory',
    properties: ['openDirectory', 'createDirectory'],
  });
}

// Show unsaved changes dialog
// Returns: 'save' | 'discard' | 'cancel'
function showUnsavedChangesDialog() {
  return dialog.showMessageBox({
    type: 'question',
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Do you want to save them?',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  }).then((result) => {
    const responses = ['save', 'discard', 'cancel'];
    return responses[result.response];
  });
}

// Show error dialog
function showErrorDialog(title, message) {
  return dialog.showErrorBox(title, message);
}

// Show info dialog
function showInfoDialog(title, message) {
  return dialog.showMessageBox({
    type: 'info',
    title,
    message,
    buttons: ['OK'],
  });
}

module.exports = {
  showOpenVideoDialog,
  showSaveProjectDialog,
  showOpenProjectDialog,
  showExportDirDialog,
  showUnsavedChangesDialog,
  showErrorDialog,
  showInfoDialog,
};
