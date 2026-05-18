<script lang="ts">
  import { pts } from '$lib/format';
  import CouncilHexMap, { type CouncilFill } from './CouncilHexMap.svelte';
  import { partyColor, partyDisplayName } from '$lib/party-colors';
  import type { CouncilFlip } from '$lib/types';
  let {
    entries,
    incompleteCouncils = [],
    polledNoFlipCouncils = []
  }: {
    entries: CouncilFlip[];
    /** Cohort councils whose count is still in progress, with per-council
     *  ward coverage. Maps render these with a dashed-outline highlight
     *  on top of whatever fill the council already has — so a flip we
     *  can already determine from the counted wards still surfaces. */
    incompleteCouncils?: { councilSlug: string; wardsCounted: number; wardsExpected: number }[];
    /** Cohort councils that polled this cycle but didn't flip — distinct
     *  from "didn't poll this cycle" so the map can tell the two apart.
     *  Pass [] in the all-cycles view (the distinction is meaningless
     *  there). */
    polledNoFlipCouncils?: string[];
  } = $props();

  // Darker than the default neutral fill (#e5e3d6) so polled-no-flip
  // councils read as "election happened, no change" rather than
  // collapsing into the "not in this cycle" greyscale.
  const POLLED_NO_FLIP_FILL = '#c7c4b3';

  const fills = $derived(
    Object.fromEntries(
      entries.map((f) => {
        const fromName = partyDisplayName(f.fromParty);
        const toName = partyDisplayName(f.toParty);
        const toColor = partyColor(f.toParty);
        return [
          f.councilSlug,
          {
            color: toColor,
            href: `/councils/${f.councilSlug}`,
            title: `${f.council}: ${fromName} → ${toName} (${f.yearFrom} → ${f.yearTo})`,
            primary: `${f.council} (${f.yearFrom} → ${f.yearTo})`,
            secondary: `${fromName} → ${toName} · ${pts(f.seatSwingNew)} seat shift on ${pts(f.voteSwingNew)} vote shift`,
            swatchColor: toColor
          }
        ];
      })
    )
  );
  const fillsWithIncomplete = $derived(
    (() => {
      const out: Record<string, CouncilFill> = { ...fills };
      for (const slug of polledNoFlipCouncils) {
        if (out[slug]) continue; // a flip wins over no-flip
        // Omit primary/title so CouncilHexMap falls back to its hex
        // data council name (the slug isn't a display label).
        out[slug] = {
          color: POLLED_NO_FLIP_FILL,
          href: `/councils/${slug}`,
          secondary: 'Polled this cycle — leading party unchanged'
        };
      }
      for (const c of incompleteCouncils) {
        const existing = out[c.councilSlug];
        // Keep whatever fill we already have (flip color, polled-no-flip
        // grey, or nothing). The dashed outline + tooltip ward count is
        // the highlight; we don't overwrite the colour.
        out[c.councilSlug] = {
          ...existing,
          href: existing?.href ?? `/councils/${c.councilSlug}`,
          color: existing?.color ?? POLLED_NO_FLIP_FILL,
          incomplete: {
            wardsCounted: c.wardsCounted,
            wardsExpected: c.wardsExpected
          }
        };
      }
      return out;
    })()
  );
</script>

<div class="map-and-scale">
  <CouncilHexMap
    fills={fillsWithIncomplete}
    title="GB councils — most recent party-control flip, coloured by the incoming party"
  />
  <div class="legend">
    <span class="legend-label">Incoming party (latest flip)</span>
    <ul class="party-legend">
      <li><span class="swatch" style:background-color={partyColor('Labour Party')}></span> <a href="/councils/party/labour">Labour</a></li>
      <li><span class="swatch" style:background-color={partyColor('Conservative Party')}></span> <a href="/councils/party/conservative">Conservative</a></li>
      <li><span class="swatch" style:background-color={partyColor('Liberal Democrats')}></span> <a href="/councils/party/liberal-democrats">Liberal Democrats</a></li>
      <li><span class="swatch" style:background-color={partyColor('Reform UK')}></span> <a href="/councils/party/reform">Reform UK</a></li>
      <li><span class="swatch" style:background-color={partyColor('Green Party')}></span> <a href="/councils/party/green">Green</a></li>
      <li><span class="swatch" style:background-color={partyColor('Independent')}></span> Independent / other</li>
      {#if polledNoFlipCouncils.length > 0}
        <li><span class="swatch polled-no-flip"></span> Polled, no change ({polledNoFlipCouncils.length})</li>
        <li><span class="swatch grey"></span> No election this cycle</li>
      {:else}
        <li><span class="swatch grey"></span> No flip in our data</li>
      {/if}
      {#if incompleteCouncils.length > 0}
        <li><span class="swatch dashed"></span> Count still in progress ({incompleteCouncils.length})</li>
      {/if}
    </ul>
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
  .party-legend {
    list-style: none;
    padding: 0;
    margin: 0.4rem 0 0;
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  .party-legend .swatch {
    display: inline-block;
    width: 0.8em;
    height: 0.8em;
    margin-right: 0.4em;
    border-radius: 2px;
    vertical-align: -0.05em;
    border: 1px solid rgba(0, 0, 0, 0.18);
  }
  .party-legend .swatch.grey { background: #e5e3d6; }
  .party-legend .swatch.polled-no-flip { background: #c7c4b3; }
  /* Dashed outline matches the in-progress hex highlight. The fill is
     transparent because the highlight rides on top of whichever color
     the council already has. */
  .party-legend .swatch.dashed {
    background: transparent;
    border: 1.5px dashed #1f2330;
  }
  @media (prefers-color-scheme: dark) {
    .party-legend .swatch { border-color: rgba(255, 255, 255, 0.25); }
    .party-legend .swatch.dashed { border-color: rgba(255, 255, 255, 0.85); }
  }
</style>
