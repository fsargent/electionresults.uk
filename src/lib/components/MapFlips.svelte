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
    incompleteCouncils?: string[];
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
        return [
          f.councilSlug,
          {
            color: partyColor(f.toParty),
            href: `/${f.councilSlug}`,
            title: `${f.council}: ${fromName} → ${toName} (${f.yearFrom} → ${f.yearTo})`,
            primary: `${f.council} (${f.yearFrom} → ${f.yearTo})`,
            secondary: `${fromName} → ${toName} · ${pts(f.seatSwingNew)} seat shift on ${pts(f.voteSwingNew)} vote shift`
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
          href: `/${slug}`,
          secondary: 'Polled this cycle — leading party unchanged'
        };
      }
      for (const slug of incompleteCouncils) {
        out[slug] = {
          color: '#000',
          href: `/${slug}`,
          primary: out[slug]?.primary ?? slug,
          secondary: 'Count still in progress — flip not yet known',
          title: `${out[slug]?.primary ?? slug}: count still in progress`
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
      <li><span class="swatch" style:background-color={partyColor('Labour Party')}></span> Labour</li>
      <li><span class="swatch" style:background-color={partyColor('Conservative Party')}></span> Conservative</li>
      <li><span class="swatch" style:background-color={partyColor('Liberal Democrats')}></span> Liberal Democrats</li>
      <li><span class="swatch" style:background-color={partyColor('Reform UK')}></span> Reform UK</li>
      <li><span class="swatch" style:background-color={partyColor('Green Party')}></span> Green</li>
      <li><span class="swatch" style:background-color={partyColor('Independent')}></span> Independent / other</li>
      {#if polledNoFlipCouncils.length > 0}
        <li><span class="swatch polled-no-flip"></span> Polled, no change ({polledNoFlipCouncils.length})</li>
        <li><span class="swatch grey"></span> No election this cycle</li>
      {:else}
        <li><span class="swatch grey"></span> No flip in our data</li>
      {/if}
      {#if incompleteCouncils.length > 0}
        <li><span class="swatch black"></span> Count still in progress ({incompleteCouncils.length})</li>
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
  .party-legend .swatch.black { background: #000; }
  @media (prefers-color-scheme: dark) {
    .party-legend .swatch { border-color: rgba(255, 255, 255, 0.25); }
  }
</style>
