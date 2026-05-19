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

  type Tooltip = {
    x: number;
    y: number;
    party: string;
    color: string;
    share: number;
    count: number | null;
    total: number | null;
    unit: string;
  };
  let tooltip: Tooltip | null = $state(null);

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
    tooltip = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
      party: seg.party,
      color: partyColor(seg.party),
      share: seg.share,
      count: seg.count ?? null,
      total: seg.total ?? null,
      unit: seg.unit ?? ''
    };
  }

  function unitLabel(unit: string): string {
    if (!unit) return 'Count';
    return unit.charAt(0).toUpperCase() + unit.slice(1);
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
    <div class="primary">
      <span class="swatch" style:background-color={tooltip.color}></span>
      {tooltip.party}
    </div>
    <dl class="stats">
      <dt>Share</dt>
      <dd>{(tooltip.share * 100).toFixed(1)}%</dd>
      {#if tooltip.count != null && tooltip.total != null}
        <dt>{unitLabel(tooltip.unit)}</dt>
        <dd>
          {tooltip.count.toLocaleString('en-GB')}
          <span class="of">of</span>
          {tooltip.total.toLocaleString('en-GB')}
        </dd>
      {:else if tooltip.count != null}
        <dt>{unitLabel(tooltip.unit)}</dt>
        <dd>{tooltip.count.toLocaleString('en-GB')}</dd>
      {/if}
    </dl>
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
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    font-size: 0.85rem;
    line-height: 1.25;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
    z-index: 10;
    min-width: 11rem;
    max-width: 18rem;
  }
  .bar-tooltip .primary {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    padding-bottom: 0.35rem;
    margin-bottom: 0.35rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.18);
  }
  .bar-tooltip .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
  }
  .bar-tooltip .stats {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.7rem;
    row-gap: 0.15rem;
    margin: 0;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  .bar-tooltip .stats dt {
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.7rem;
    align-self: center;
  }
  .bar-tooltip .stats dd {
    margin: 0;
    text-align: right;
    font-weight: 500;
  }
  .bar-tooltip .stats .of {
    opacity: 0.55;
    font-weight: 400;
    margin: 0 0.15rem;
  }
  @media (hover: none) {
    .bar-tooltip { display: none; }
  }
</style>
