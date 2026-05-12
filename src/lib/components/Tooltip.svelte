<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Visible label that triggers the tooltip. */
    children: Snippet;
    /** Tooltip body. Plain string, or a snippet for richer content. */
    body: string | Snippet;
    /** Where the tooltip sits relative to the trigger. */
    placement?: 'top' | 'bottom';
    /** When true, render an inline ⓘ icon next to children. */
    icon?: boolean;
  }

  let { children, body, placement = 'top', icon = false }: Props = $props();
</script>

<span class="tt-wrap">
  <span class="tt-trigger" tabindex="0" role="button" aria-describedby="tt"
    >{@render children()}{#if icon}<span class="tt-icon" aria-hidden="true">&nbsp;ⓘ</span>{/if}</span
  >
  <span class="tt-bubble" class:bottom={placement === 'bottom'} role="tooltip">
    {#if typeof body === 'string'}
      {body}
    {:else}
      {@render body()}
    {/if}
  </span>
</span>

<style>
  .tt-wrap {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    gap: 0.2em;
  }
  .tt-trigger {
    cursor: help;
    border-bottom: 1px dotted currentColor;
    outline: none;
    white-space: nowrap;
  }
  .tt-trigger:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 2px;
  }
  .tt-icon {
    font-size: 0.78em;
    color: var(--muted);
    margin-left: 0.15em;
  }
  .tt-bubble {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 16rem;
    max-width: 24rem;
    padding: 0.6rem 0.75rem;
    background: var(--fg);
    color: var(--bg);
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 400;
    line-height: 1.4;
    text-transform: none;
    letter-spacing: normal;
    text-align: left;
    white-space: normal;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    opacity: 0;
    visibility: hidden;
    transition: opacity 120ms ease-out, visibility 120ms;
    z-index: 100;
    pointer-events: none;
  }
  .tt-bubble::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--fg);
  }
  .tt-bubble.bottom {
    bottom: auto;
    top: calc(100% + 8px);
  }
  .tt-bubble.bottom::after {
    top: auto;
    bottom: 100%;
    border-top-color: transparent;
    border-bottom-color: var(--fg);
  }
  .tt-wrap:hover .tt-bubble,
  .tt-wrap:focus-within .tt-bubble {
    opacity: 1;
    visibility: visible;
  }
  /* On narrow screens, anchor to viewport edges instead of overflowing. */
  @media (max-width: 480px) {
    .tt-bubble {
      left: 0;
      transform: none;
      min-width: 14rem;
      max-width: calc(100vw - 2rem);
    }
    .tt-bubble::after {
      left: 1rem;
      transform: none;
    }
  }
</style>
