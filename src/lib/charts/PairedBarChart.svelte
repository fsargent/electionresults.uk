<script lang="ts">
  import { pct, pts } from '$lib/format';

  export interface PairedBar {
    /** Row label — typically a party name. */
    name: string;
    /** Optional href; the row label becomes a link when set. */
    href?: string;
    /** Brand colour for the filled vote bar and the row stripe. */
    color: string;
    voteShare: number;
    seatShare: number;
  }

  let {
    bars,
    /** Cap for the shared horizontal axis. Auto-scaled to a 5%-rounded
     *  cushion above the largest value when omitted. */
    maxValue,
    /** Optional caption above the panel. */
    caption
  }: {
    bars: PairedBar[];
    maxValue?: number;
    caption?: string;
  } = $props();

  const computedMax = $derived.by(() => {
    if (maxValue != null) return maxValue;
    let raw = 0;
    for (const b of bars) {
      if (b.voteShare > raw) raw = b.voteShare;
      if (b.seatShare > raw) raw = b.seatShare;
    }
    if (raw <= 0) return 0.1;
    return Math.min(1, Math.ceil(raw * 20) / 20);
  });

  function widthPct(v: number): string {
    return `${(v / computedMax) * 100}%`;
  }
</script>

<div class="paired-bars">
  {#if caption}
    <p class="caption">{caption}</p>
  {/if}
  <ul>
    {#each bars as b (b.name)}
      {@const gap = b.seatShare - b.voteShare}
      <li style:--row-color={b.color}>
        <div class="row-header">
          {#if b.href}
            <a class="label" href={b.href}>{b.name}</a>
          {:else}
            <span class="label">{b.name}</span>
          {/if}
          <span
            class="gap"
            class:over={gap > 0.005}
            class:under={gap < -0.005}
            title="Seat share minus vote share"
          >{pts(gap, 0)}</span>
        </div>
        <div class="bar-row">
          <span class="kind">votes</span>
          <span class="track">
            <span class="bar votes" style:width={widthPct(b.voteShare)}></span>
          </span>
          <span class="value">{pct(b.voteShare, 0)}</span>
        </div>
        <div class="bar-row">
          <span class="kind">seats</span>
          <span class="track">
            <span class="bar seats" style:width={widthPct(b.seatShare)}></span>
          </span>
          <span class="value">{pct(b.seatShare, 0)}</span>
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  .paired-bars {
    margin: 0;
  }
  .caption {
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .paired-bars > ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .paired-bars > ul > li {
    padding: 0.5rem 0 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .paired-bars > ul > li:last-child {
    border-bottom: none;
  }
  .row-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    margin-bottom: 0.35rem;
    border-left: 3px solid var(--row-color, var(--accent));
    padding-left: 0.5rem;
  }
  .label {
    font-size: 0.95rem;
    font-weight: 600;
    color: inherit;
    text-decoration: none;
  }
  a.label:hover {
    text-decoration: underline;
    text-decoration-color: var(--row-color, var(--accent));
  }
  .gap {
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }
  .gap.under {
    color: var(--warn);
  }
  .gap.over {
    color: #1c7a3a;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 3.2rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    padding-left: 0.5rem;
    margin-top: 0.18rem;
  }
  .kind {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: lowercase;
    text-align: right;
    letter-spacing: 0.02em;
  }
  .track {
    position: relative;
    display: block;
    height: 0.85rem;
    background: transparent;
  }
  .bar {
    display: block;
    height: 100%;
    border-radius: 2px;
    min-width: 1px;
  }
  .bar.votes {
    background: var(--row-color, var(--accent));
  }
  .bar.seats {
    background: transparent;
    border: 2px solid var(--row-color, var(--accent));
  }
  .value {
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    color: var(--fg);
    font-weight: 500;
    min-width: 2.5rem;
    text-align: right;
  }
  @media (max-width: 540px) {
    .bar-row {
      grid-template-columns: 2.8rem minmax(0, 1fr) auto;
      gap: 0.4rem;
    }
  }
</style>
