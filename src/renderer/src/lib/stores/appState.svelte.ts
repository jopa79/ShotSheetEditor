// appState.svelte.ts — Projekt- und Szenen-State
// Enthält: scenes, collections, projectPath, projectData, isDirty, threshold

import type { Scene, Collection, ProjectData } from '../../../../shared/models'
import { DETECTION_DEFAULTS } from '../../../../shared/constants'

const DEFAULT_THRESHOLD: number = DETECTION_DEFAULTS.threshold

// --- Reaktive State-Werte ---

let _scenes = $state<Scene[]>([])
let _collections = $state<Collection[]>([])
let _projectPath = $state<string | null>(null)
let _projectData = $state<ProjectData | null>(null)
let _isDirty = $state(false)
let _threshold = $state(DEFAULT_THRESHOLD)

// --- Getter ---

export function getScenes(): Scene[] {
  return _scenes
}

export function getCollections(): Collection[] {
  return _collections
}

export function getProjectPath(): string | null {
  return _projectPath
}

export function getProjectData(): ProjectData | null {
  return _projectData
}

export function getIsDirty(): boolean {
  return _isDirty
}

export function getThreshold(): number {
  return _threshold
}

// --- Setter ---

export function setScenes(scenes: Scene[]): void {
  _scenes = scenes
}

export function setCollections(collections: Collection[]): void {
  _collections = collections
}

export function setProjectPath(path: string | null): void {
  _projectPath = path
}

export function setProjectData(data: ProjectData | null): void {
  _projectData = data
}

export function setIsDirty(dirty: boolean): void {
  _isDirty = dirty
}

export function setThreshold(threshold: number): void {
  _threshold = threshold
}

// --- Reset ---

export function resetAppState(): void {
  _scenes = []
  _collections = []
  _projectPath = null
  _projectData = null
  _isDirty = false
  _threshold = DEFAULT_THRESHOLD
}
