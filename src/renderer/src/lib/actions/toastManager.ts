// toastManager.ts — Globaler Toast-Manager
// Actions rufen showToast() auf, Toast.svelte registriert den Callback

export type ToastType = 'success' | 'error' | 'warning' | 'info'
export type ToastCallback = (message: string, type: ToastType) => void

let _toastCallback: ToastCallback | null = null

/**
 * Toast.svelte registriert hier seinen Callback.
 * Wird beim Mount aufgerufen.
 */
export function registerToastHandler(callback: ToastCallback): void {
  _toastCallback = callback
}

/**
 * Toast anzeigen — kann von jeder Action aufgerufen werden
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  if (_toastCallback) {
    _toastCallback(message, type)
  } else {
    // Fallback wenn Toast.svelte noch nicht gemountet
    console.log(`[Toast:${type}] ${message}`)
  }
}
