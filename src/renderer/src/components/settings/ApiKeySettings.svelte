<script lang="ts">
  // ApiKeySettings.svelte — Dialog zum Eingeben/Entfernen der API-Keys.
  // Keys werden via safeStorage (Main-Process) verschluesselt gespeichert.

  import Modal from '../shared/Modal.svelte'
  import Button from '../shared/Button.svelte'
  import * as apiKeyActions from '../../lib/actions/apiKeyActions'
  import type { ApiKeyProvider } from '../../../../shared/models'

  interface Props {
    open: boolean
    onclose?: () => void
  }

  let { open, onclose }: Props = $props()

  const providers: { id: ApiKeyProvider; label: string }[] = [
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'elevenlabs', label: 'ElevenLabs' },
  ]

  let inputs = $state<Record<string, string>>({ openai: '', anthropic: '', elevenlabs: '' })
  let hasKey = $state<Record<string, boolean>>({ openai: false, anthropic: false, elevenlabs: false })

  // Status aktualisieren wenn der Dialog geoeffnet wird
  $effect(() => {
    if (open) void refreshStatus()
  })

  async function refreshStatus(): Promise<void> {
    for (const p of providers) {
      hasKey[p.id] = await apiKeyActions.checkApiKey(p.id)
    }
  }

  async function save(provider: ApiKeyProvider): Promise<void> {
    const key = inputs[provider].trim()
    if (!key) return
    const ok = await apiKeyActions.saveApiKey(provider, key)
    if (ok) {
      inputs[provider] = ''
      hasKey[provider] = true
    }
  }

  async function remove(provider: ApiKeyProvider): Promise<void> {
    const ok = await apiKeyActions.removeApiKey(provider)
    if (ok) hasKey[provider] = false
  }
</script>

<Modal {open} {onclose}>
  <div class="api-keys">
    <h2>API Keys</h2>
    <p class="hint">Stored encrypted via your OS keychain (safeStorage).</p>

    {#each providers as p (p.id)}
      <div class="row">
        <div class="label">
          <span>{p.label}</span>
          <span class="status" class:set={hasKey[p.id]}>{hasKey[p.id] ? 'set' : 'not set'}</span>
        </div>
        <input
          type="password"
          placeholder="Enter API key…"
          bind:value={inputs[p.id]}
          autocomplete="off"
        />
        <Button size="sm" onclick={() => save(p.id)} disabled={!inputs[p.id].trim()}>Save</Button>
        <Button size="sm" variant="ghost" onclick={() => remove(p.id)} disabled={!hasKey[p.id]}>
          Remove
        </Button>
      </div>
    {/each}
  </div>
</Modal>

<style>
  .api-keys {
    min-width: 460px;
    padding: var(--sp-md);
  }
  .api-keys h2 {
    margin: 0 0 var(--sp-xs);
    font-size: var(--fs-heading);
  }
  .hint {
    margin: 0 0 var(--sp-lg);
    font-size: var(--fs-secondary);
    color: var(--text-2);
  }
  .row {
    display: grid;
    grid-template-columns: 120px 1fr auto auto;
    align-items: center;
    gap: var(--sp-sm);
    margin-bottom: var(--sp-sm);
  }
  .label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .status {
    font-size: var(--fs-secondary);
    color: var(--text-2);
  }
  .status.set {
    color: var(--green);
  }
  input {
    padding: 6px 8px;
    background: var(--bg-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font: inherit;
  }
</style>
