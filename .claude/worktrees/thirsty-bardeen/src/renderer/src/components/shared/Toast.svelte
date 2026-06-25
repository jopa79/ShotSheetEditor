<script lang="ts">
  // Toast.svelte — Queue-basierte Toast-Benachrichtigungen
  // Registriert sich beim toastManager für globale Nutzung

  import { registerToastHandler, type ToastType } from '../../lib/actions/toastManager'

  interface ToastItem {
    id: number
    message: string
    type: ToastType
    fadingOut: boolean
  }

  let toasts = $state<ToastItem[]>([])
  let nextId = 0

  function addToast(message: string, type: ToastType) {
    const id = nextId++
    toasts = [...toasts, { id, message, type, fadingOut: false }]

    // Auto-dismiss nach 3s
    setTimeout(() => {
      toasts = toasts.map((t) => (t.id === id ? { ...t, fadingOut: true } : t))
      // Nach Fade-Out-Animation entfernen
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id)
      }, 300)
    }, 3000)
  }

  // Beim Mount: globalen Handler registrieren
  $effect(() => {
    registerToastHandler(addToast)
  })
</script>

<div class="toasts-container" role="status" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <div
      class="toast {toast.type}"
      class:fade-out={toast.fadingOut}
      role="alert"
    >
      {toast.message}
    </div>
  {/each}
</div>

<style>
  .toasts-container {
    position: fixed;
    top: var(--sp-xl);
    right: var(--sp-xl);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    pointer-events: none;
  }

  .toast {
    padding: var(--sp-md) var(--sp-lg);
    border-radius: var(--radius-md);
    font-size: var(--fs-content);
    color: var(--text-0);
    background: var(--bg-3);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    pointer-events: auto;
    animation: toast-in 0.2s ease-out;
    max-width: 360px;
  }

  .toast.success {
    border-color: var(--green);
    background: var(--green-dim);
  }

  .toast.error {
    border-color: var(--red);
    background: var(--red-dim);
  }

  .toast.warning {
    border-color: var(--amber);
    background: var(--amber-dim);
  }

  .toast.info {
    border-color: var(--accent);
    background: var(--accent-glow);
  }

  .toast.fade-out {
    animation: toast-out 0.3s ease-in forwards;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes toast-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-8px);
    }
  }
</style>
