<script lang="ts">
  import { pct } from '$lib/format';
  import CouncilHexMap from './CouncilHexMap.svelte';
  import { belowQuotaColor } from '$lib/below-quota-color';
  import type { DistortionRow } from '$lib/data';
  let {
    entries,
    incompleteCouncils = []
  }: { entries: DistortionRow[]; incompleteCouncils?: string[] } = $props();

  // Stretch the cream→red palette across the data's actual range, not
  // 0–100%. Pure-FPTP councils rarely cross 50% so a fixed-1 scale wastes
  // half the colour spread and makes the map look uniformly mild.
  const dataMax = $derived(
    entries.length > 0
      ? Math.max(...entries.map((d) => d.reallocatedShare))
      : 1
  );
  function normalise(share: number): number {
    if (dataMax <= 0) return 0;
    return Math.min(1, share / dataMax);
  }

  const fills = $derived(
    Object.fromEntries(
      entries.map((d) => [
        d.councilSlug,
        {
          color: belowQuotaColor(normalise(d.reallocatedShare)),
          href: `/${d.councilSlug}/${d.year}#party-view`,
          title:
            `${d.council} ${d.year}: ${d.reallocated} of ${d.totalSeats} seats ` +
            `(${pct(d.reallocatedShare)}) unfairly awarded — they went to a ` +
            `different party than a proportional re-count of the same votes ` +
            `would have produced`,
          primary: `${d.council} (${d.year})`,
          secondary:
            `${d.reallocated} of ${d.totalSeats} seats unfairly awarded ` +
            `(${pct(d.reallocatedShare)})`
        }
      ])
    )
  );
  // Override the fill for cohort councils whose count is incomplete:
  // their partial-data row would otherwise show a misleading colour
  // (e.g. an early-reporting Labour stronghold flashing low distortion
  // because most of its competitive wards haven't reported yet).
  const fillsWithIncomplete = $derived(
    (() => {
      const out = { ...fills };
      for (const slug of incompleteCouncils) {
        out[slug] = {
          color: '#000',
          href: `/${slug}`,
          primary: out[slug]?.primary ?? slug,
          secondary: 'Count still in progress — not enough data yet',
          title: `${out[slug]?.primary ?? slug}: count still in progress`
        };
      }
      return out;
    })()
  );

  // Tick labels reflect the same normalised scale.
  const tickPcts = $derived([0, dataMax / 2, dataMax]);
</script>

<div class="map-and-scale">
  <CouncilHexMap
    fills={fillsWithIncomplete}
    title="GB councils — shaded by share of seats unfairly awarded (went to a different party than a proportional re-count of the same votes would have)"
  />
  <div class="legend">
    <span class="legend-label">Unfairly awarded seats</span>
    <div class="legend-bar">
      {#each [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as t (t)}
        <span class="legend-cell" style:background-color={belowQuotaColor(t)}></span>
      {/each}
    </div>
    <div class="legend-ticks">
      {#each tickPcts as t (t)}
        <span>{pct(t)}</span>
      {/each}
    </div>
    {#if incompleteCouncils.length > 0}
      <div class="legend-incomplete">
        <span class="legend-incomplete-swatch" aria-hidden="true"></span>
        <span>Count still in progress ({incompleteCouncils.length})</span>
      </div>
    {/if}
    <p class="muted small">
      One hex = one council. &ldquo;Unfairly awarded&rdquo; = the seat
      went to a different party than a proportional re-count of the
      same votes (D'Hondt) would have produced. 0% = FPTP and
      proportional agreed; higher = bigger gap. Multi-member wards
      inflate the count slightly (bloc-vote caveat &mdash; see
      <a href="/methodology#distortion">methodology</a>).
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
    font-variant-numeric: tabular-nums;
  }
  .legend-incomplete {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.6rem;
    color: var(--muted);
    font-size: 0.78rem;
  }
  .legend-incomplete-swatch {
    display: inline-block;
    width: 0.9rem;
    height: 0.9rem;
    background: #000;
    border-radius: 2px;
  }
  .small { font-size: 0.78rem; }
</style>
