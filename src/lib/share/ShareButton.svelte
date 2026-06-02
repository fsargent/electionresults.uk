<script lang="ts">
  import { exportChartAsPng } from './exportChart';

  // Bottom-right "save as image" affordance for charts. Invisible until
  // the visitor hovers (or tab-focuses) the parent — parent must be
  // `position: relative` for the absolute positioning to anchor.
  //
  // The `source` prop is the node to rasterise. Pass it via `bind:this`
  // on whichever element wraps the chart's renderable content (typically
  // the chart's <svg> or <figure>).

  let {
    source,
    title,
    subtitle,
    filename
  }: {
    source: HTMLElement | SVGElement | null | undefined;
    title: string;
    subtitle?: string;
    filename: string;
  } = $props();

  let busy = $state(false);
  let errored = $state(false);

  async function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!source || busy) return;
    busy = true;
    errored = false;
    try {
      await exportChartAsPng({ source, subtitle, filename });
    } catch (err) {
      console.error('chart export failed', err);
      errored = true;
      setTimeout(() => (errored = false), 2400);
    } finally {
      busy = false;
    }
  }
</script>

<button
  type="button"
  class="share-btn"
  class:busy
  class:errored
  onclick={onClick}
  aria-label={errored
    ? `Could not save ${title}`
    : busy
      ? `Saving ${title}…`
      : `Save ${title} as image`}
  title={errored ? 'Save failed — try again' : 'Save as image (PNG)'}
>
  {#if busy}
    <svg viewBox="0 0 16 16" aria-hidden="true" class="spin">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="9 28" />
    </svg>
  {:else if errored}
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>
  {:else}
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2 V10 M5 7 L8 10 L11 7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M3 12 V13 A1 1 0 0 0 4 14 H12 A1 1 0 0 0 13 13 V12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {/if}
</button>

<style>
  .share-btn {
    position: absolute;
    bottom: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: var(--bg);
    color: var(--muted);
    border: 1px solid var(--rule);
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transform: translateY(2px);
    transition: opacity 120ms ease, transform 120ms ease, color 120ms ease, border-color 120ms ease;
    z-index: 5;
  }
  /* Reveal when any ancestor with the .share-host class is hovered or
     focused-within. Lets each chart opt in by adding that class to its
     outer wrapper without coupling this button to a specific layout. */
  :global(.share-host:hover) .share-btn,
  :global(.share-host:focus-within) .share-btn,
  .share-btn:focus-visible {
    opacity: 1;
    transform: translateY(0);
  }
  .share-btn:hover {
    color: var(--fg);
    border-color: var(--fg);
  }
  .share-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .share-btn.busy {
    cursor: progress;
    opacity: 1;
  }
  .share-btn.errored {
    color: var(--warn);
    border-color: var(--warn);
    opacity: 1;
  }
  .share-btn svg {
    width: 16px;
    height: 16px;
    display: block;
  }
  .spin {
    animation: share-spin 0.9s linear infinite;
  }
  @keyframes share-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .spin { animation: none; }
  }
  /* Touch-only devices: the hover-to-reveal trick fails. Always show. */
  @media (hover: none) {
    .share-btn {
      opacity: 1;
      transform: none;
    }
  }
</style>
