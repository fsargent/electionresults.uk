<script lang="ts">
  import { pct } from '$lib/format';
  import CouncilHexMap from './CouncilHexMap.svelte';
  import { belowQuotaColor } from '$lib/below-quota-color';
  import type { CouncilSummary } from '$lib/types';
  let { councils }: { councils: CouncilSummary[] } = $props();

  const fills = $derived(
    Object.fromEntries(
      councils.map((c) => [
        c.councilSlug,
        {
          color: belowQuotaColor(c.belowQuotaShare),
          href: `/${c.councilSlug}`,
          title: `${c.council} — ${c.year}: ${pct(c.belowQuotaShare)} of seats below quota (${c.belowQuotaSeatCount} of ${c.totalSeatCount})`,
          primary: `${c.council} (${c.year})`,
          secondary: `${pct(c.belowQuotaShare)} of seats below quota — ${c.belowQuotaSeatCount} of ${c.totalSeatCount}`
        }
      ])
    )
  );
</script>

<div class="map-and-scale">
  <CouncilHexMap
    {fills}
    title="UK councils — most recent poll, shaded by % of seats below the proportional quota"
  />
  <div class="legend">
    <span class="legend-label">% below quota</span>
    <div class="legend-bar">
      {#each [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as t (t)}
        <span class="legend-cell" style:background-color={belowQuotaColor(t)}></span>
      {/each}
    </div>
    <div class="legend-ticks">
      <span>0%</span><span>50%</span><span>100%</span>
    </div>
    <p class="muted small">
      One hex = one council. Geographic position is approximate (cartogram —
      each council gets equal space, regardless of size). A council that
      polled in 2025 shows 2025; a London Borough that last polled in 2022
      shows 2022.
    </p>
  </div>
</div>

<style>
  .map-and-scale {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(8rem, 12rem);
    gap: 1.25rem;
    align-items: start;
    margin: 0.5rem 0 2rem;
  }
  @media (max-width: 640px) {
    .map-and-scale { grid-template-columns: 1fr; }
  }
  .legend { font-size: 0.85rem; }
  .legend-label {
    display: block;
    color: var(--muted);
    text-transform: uppercase;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    margin-bottom: 0.4rem;
  }
  .legend-bar {
    display: flex;
    width: 100%;
    height: 0.9rem;
    border: 1px solid var(--rule);
    border-radius: 2px;
    overflow: hidden;
  }
  .legend-cell { display: block; flex: 1; }
  .legend-ticks {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: 0.78rem;
    margin-top: 0.2rem;
  }
  .small { font-size: 0.78rem; }
</style>
