// detectionState.svelte.ts — Scene-Detection-State
// Enthält: isDetecting, detectProgress, detectingSceneCount

// --- Reaktive State-Werte ---

let _isDetecting = $state(false)
let _detectProgress = $state(0)
let _detectingSceneCount = $state(0)

// --- Getter ---

export function getIsDetecting(): boolean {
  return _isDetecting
}

export function getDetectProgress(): number {
  return _detectProgress
}

export function getDetectingSceneCount(): number {
  return _detectingSceneCount
}

// --- Setter ---

export function setIsDetecting(detecting: boolean): void {
  _isDetecting = detecting
}

export function setDetectProgress(progress: number): void {
  _detectProgress = progress
}

export function setDetectingSceneCount(count: number): void {
  _detectingSceneCount = count
}

// --- Reset ---

export function resetDetectionState(): void {
  _isDetecting = false
  _detectProgress = 0
  _detectingSceneCount = 0
}
