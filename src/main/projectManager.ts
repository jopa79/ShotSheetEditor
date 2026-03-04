import fs from 'fs'
import path from 'path'
import os from 'os'

const PROJECT_SUBDIRS = ['thumbnails', 'exports', 'exports/sequences', 'exports/zip']

interface ProjectResult {
  success: boolean
  projectPath?: string
  projectName?: string
  data?: Record<string, unknown>
  path?: string
  error?: string
}

interface ValidationResult {
  valid: boolean
  error?: string
}

// Pruefen ob Pfad innerhalb des Projekts liegt
export function isInsideProject(projectPath: string, targetPath: string): boolean {
  const projectDir = path.resolve(projectPath)
  const target = path.resolve(targetPath)
  return target.startsWith(projectDir + path.sep) || target === projectDir
}

// Projektpfad-Format validieren
export function validateProjectPath(projectPath: string): ValidationResult {
  try {
    const resolved = path.resolve(projectPath)
    if (!resolved || resolved.length < 3) {
      return { valid: false, error: 'Invalid project path' }
    }
    return { valid: true }
  } catch (error) {
    return { valid: false, error: (error as Error).message }
  }
}

// Projektnamen sanitisieren (Path-Traversal verhindern)
export function sanitizeProjectName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') {
    return 'Untitled Project'
  }

  return (
    name
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\.\./g, '_')
      .substring(0, 255)
      .trim() || 'Untitled Project'
  )
}

// Neues Projekt erstellen
export function newProject(name: string, videoPath: string): ProjectResult {
  try {
    const sanitizedName = sanitizeProjectName(name)
    const projectName = `${sanitizedName}_${Date.now()}`
    const projectPath = path.join(
      process.env.HOME || process.env.USERPROFILE || os.homedir(),
      'ShotSheetProjects',
      projectName,
    )

    const validation = validateProjectPath(projectPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    if (fs.existsSync(projectPath)) {
      return { success: false, error: 'Project already exists' }
    }

    fs.mkdirSync(projectPath, { recursive: true })

    PROJECT_SUBDIRS.forEach((subdir) => {
      const subdirPath = path.join(projectPath, subdir)
      fs.mkdirSync(subdirPath, { recursive: true })
    })

    const projectData = {
      name: sanitizedName,
      version: '1.0.0',
      videoPath: videoPath || null,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      scenes: [],
      frames: [],
      settings: {
        detectionThreshold: 0.3,
        autoSave: true,
      },
    }

    const projectJsonPath = path.join(projectPath, 'project.json')
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2), 'utf8')

    return {
      success: true,
      projectPath,
      projectName,
      data: projectData,
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

// Bestehendes Projekt oeffnen
export function openProject(projectPath: string): ProjectResult {
  try {
    const validation = validateProjectPath(projectPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Pfad gegen homeDir validieren — verhindert Path-Traversal (fix #118)
    const homeDir = os.homedir()
    const resolvedPath = path.resolve(projectPath)
    if (!resolvedPath.startsWith(homeDir + path.sep)) {
      return { success: false, error: 'Access denied: project path must be within home directory' }
    }

    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project not found' }
    }

    const projectJsonPath = path.join(projectPath, 'project.json')
    if (!fs.existsSync(projectJsonPath)) {
      return { success: false, error: 'Invalid project: missing project.json' }
    }

    let projectData: Record<string, unknown>
    try {
      const content = fs.readFileSync(projectJsonPath, 'utf8')
      projectData = JSON.parse(content)
    } catch (error) {
      return { success: false, error: `Failed to parse project.json: ${(error as Error).message}` }
    }

    // Fehlende Unterverzeichnisse reparieren
    PROJECT_SUBDIRS.forEach((subdir) => {
      const subdirPath = path.join(projectPath, subdir)
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true })
      }
    })

    return {
      success: true,
      projectPath,
      projectName: path.basename(projectPath),
      data: projectData,
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

// Projekt speichern
export function saveProject(
  projectPath: string,
  data: Record<string, unknown>,
): { success: boolean; error?: string } {
  try {
    const validation = validateProjectPath(projectPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const homeDir = os.homedir()
    const resolvedPath = path.resolve(projectPath)
    if (!resolvedPath.startsWith(homeDir + path.sep)) {
      return { success: false, error: 'Project path must be within home directory' }
    }

    // Verzeichnis erstellen falls noetig (Save As in neuen Ordner)
    fs.mkdirSync(projectPath, { recursive: true })

    const projectJsonPath = path.join(projectPath, 'project.json')

    // Atomic Write: Temp-Datei schreiben, dann umbenennen
    const tempPath = `${projectJsonPath}.tmp`

    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8')
      fs.renameSync(tempPath, projectJsonPath)
      return { success: true }
    } catch (error) {
      // Fallback fuer Windows: direktes Schreiben wenn Cross-Device-Rename fehlschlaegt
      if (process.platform === 'win32') {
        fs.writeFileSync(projectJsonPath, JSON.stringify(data, null, 2), 'utf8')
        try {
          fs.unlinkSync(tempPath)
        } catch {
          // Ignorieren
        }
        return { success: true }
      }
      throw error
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

export { PROJECT_SUBDIRS }

export default {
  newProject,
  openProject,
  saveProject,
  validateProjectPath,
  sanitizeProjectName,
  isInsideProject,
  PROJECT_SUBDIRS,
}
