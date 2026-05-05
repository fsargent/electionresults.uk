<script lang="ts">
  import { partyColor } from '$lib/party-colors';

  export interface BarSegment {
    party: string;
    /** Width as a fraction of the bar (0..1). */
    share: number;
    /** Optional raw value (votes, seats, etc.) shown in the tooltip. */
    count?: number;
    /** Optional total this segment is part of, for tooltip context. */
    total?: number;
    /** Word for what `count` represents (e.g. 'votes', 'seats'). */
    unit?: string;
  }

  let {
    label,
    segments,
    height = '1.4rem'
  }: { label?: string; segments: BarSegment[]; height?: string } = $props();

  type Tooltip = { x: number; y: number; primary: string; secondary: string };
  let tooltip: Tooltip | null = $state(null);

  function tooltipFor(seg: BarSegment): { primary: string; secondary: string } {
    const pctStr = `${(seg.share * 100).toFixed(1)}%`;
    let secondary = pctStr;
    if (seg.count != null) {
      const n = seg.count.toLocaleString('en-GB');
      const unit = seg.unit ?? '';
      secondary = seg.total != null
        ? `${pctStr} · ${n} of ${seg.total.toLocaleString('en-GB')} ${unit}`.trim()
        : `${pctStr} · ${n} ${unit}`.trim();
    }
    return { primary: seg.party, secondary };
  }

  function findSegment(target: EventTarget | null): BarSegment | null {
    if (!(target instanceof Element)) return null;
    const el = target.closest('[data-seg-idx]');
    if (!el) return null;
    const idx = Number(el.getAttribute('data-seg-idx'));
    return segments[idx] ?? null;
  }

  function onMove(event: PointerEvent) {
    const seg = findSegment(event.target);
    if (!seg) {
      tooltip = null;
      return;
    }
    const t = tooltipFor(seg);
    tooltip = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
      primary: t.primary,
      secondary: t.secondary
    };
  }

  function onLeave() {
    tooltip = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="bar-row" onpointermove={onMove} onpointerleave={onLeave}>
  {#if label}
    <span class="bar-label">{label}</span>
  {/if}
  <div class="bar" style:height>
    {#each segments as seg, i (i + ':' + seg.party)}
      {#if seg.share > 0}
        <span
          class="seg"
          data-seg-idx={i}
          style:width={`${seg.share * 100}%`}
          style:background-color={partyColor(seg.party)}
        ></span>
      {/if}
    {/each}
  </div>
</div>

{#if tooltip}
  <div
    class="bar-tooltip"
    style:left={`${tooltip.x}px`}
    style:top={`${tooltip.y}px`}
    role="tooltip"
  >
    <div class="primary">{tooltip.primary}</div>
    <div class="secondary">{tooltip.secondary}</div>
  </div>
{/if}

<style>
  .bar-row {
    display: grid;
    grid-template-columns: minmax(7rem, 11rem) 1fr;
    gap: 0.6rem;
    align-items: center;
    margin: 0.3rem 0;
  }
  .bar-row:has(.bar-label:empty) {
    grid-template-columns: 1fr;
  }
  .bar-label {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .bar {
    display: flex;
    height: 1.4rem;
    border: 1px solid var(--rule);
    border-radius: 3px;
    overflow: hidden;
    background: var(--bg);
  }
  .seg {
    display: block;
    height: 100%;
  }
  .bar-tooltip {
    position: absolute;
    pointer-events: none;
    transform: translate(0.9rem, -100%);
    margin-top: -0.4rem;
    background: var(--fg);
    color: var(--bg);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    line-height: 1.25;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
    max-width: 18rem;
  }
  .bar-tooltip .primary {
    font-weight: 600;
  }
  .bar-tooltip .secondary {
    opacity: 0.85;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  @media (hover: none) {
    .bar-tooltip { display: none; }
  }
</style>
