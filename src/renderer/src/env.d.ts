/// <reference types="svelte" />
/// <reference types="vite/client" />

// Typisiertes window.electronAPI — importiert aus Preload
import type { ElectronAPI } from '../../preload/types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
