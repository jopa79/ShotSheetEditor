<script lang="ts">
  // Button.svelte — Styled Button Component

  import type { Snippet } from 'svelte'

  interface Props {
    onclick?: (e: MouseEvent) => void
    disabled?: boolean
    variant?: 'default' | 'primary' | 'danger' | 'ghost'
    size?: 'sm' | 'md'
    title?: string
    children: Snippet
  }

  let {
    onclick,
    disabled = false,
    variant = 'default',
    size = 'md',
    title,
    children,
  }: Props = $props()
</script>

<button
  class="btn btn-{variant} btn-{size}"
  {disabled}
  {title}
  onclick={onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-sm);
    border-radius: var(--radius-md);
    font-size: var(--fs-content);
    color: var(--text-1);
    transition: all var(--transition-fast);
    white-space: nowrap;
    -webkit-app-region: no-drag;
  }

  .btn-md {
    padding: var(--sp-sm) var(--sp-md);
    height: 26px;
  }

  .btn-sm {
    padding: var(--sp-xs) var(--sp-sm);
    height: 22px;
    font-size: var(--fs-secondary);
  }

  .btn-default:hover:not(:disabled) {
    color: var(--text-0);
    background: var(--bg-3);
  }

  .btn-primary {
    background: var(--accent-dim);
    color: var(--accent);
    border: 1px solid transparent;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent);
    color: #fff;
  }

  .btn-danger {
    color: var(--red);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--red-dim);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--bg-3);
    color: var(--text-0);
  }
</style>
