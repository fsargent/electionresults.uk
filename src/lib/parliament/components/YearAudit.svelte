<script lang="ts">
  // Shared audit body for a single general-election year. Rendered by
  // both /parliament (latest year) and /parliament/[year]. The year
  // heading renders as H1 by default; pages that wrap this in their
  // own editorial framing (e.g. /parliament's site-level title) pass
  // `headingLevel="h2"` to demote it.

  import { num, pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import PartyBars, { type BarSegment } from '$lib/components/PartyBars.svelte';
  import PairedBarChart, { type PairedBar } from '$lib/charts/PairedBarChart.svelte';
  import type { HexFill } from '$lib/components/HexCartogram.svelte';
  import type {
    NationalPartyTotal,
    NationalSummary,
    SourceManifest
  } from '$lib/parliament/types';
  import { gallagherDescriptor } from '../gallagher-descriptor';
  import ConstituencyHexMap from './ConstituencyHexMap.svelte';
  import ConstituencyLookup from './ConstituencyLookup.svelte';
  import LowWinningShareTable from './LowWinningShareTable.svelte';
  import NationalDistortionSummary from './NationalDistortionSummary.svelte';

  export interface PartyRow {
    party: NationalPartyTotal;
    votesPerSeat: number | null;
  }

  let {
    year,
    summary,
    partyTotals,
    partyRows,
    constituencyFills,
    constituencies,
    manifest,
    /** Heading level for the "{year} UK general election" title.
     *  Pages that supply their own H1 above this component should pass
     *  "h2" so the document outline doesn't repeat at the top level. */
    headingLevel = 'h1'
  }: {
    year: number;
    summary: NationalSummary;
    partyTotals: NationalPartyTotal[];
    partyRows: PartyRow[];
    constituencyFills: Record<string, HexFill>;
    constituencies: { slug: string; name: string }[];
    manifest: SourceManifest;
    headingLevel?: 'h1' | 'h2';
  } = $props();

  // Pick a one-sentence headline party-pair for the prologue. Both come
  // straight from the precomputed national-summary envelope; we just
  // sort defensively in case the ETL's output order drifts.
  const mostOver = $derived(
    [...summary.voteVsSeatGap].sort((a, b) => b.gap - a.gap)[0] ?? null
  );
  const mostUnder = $derived(
    [...summary.voteVsSeatGap].sort((a, b) => a.gap - b.gap)[0] ?? null
  );

  const mostOverTotals = $derived(
    mostOver ? partyTotals.find((p) => p.partyId === mostOver.partyId) : null
  );
  const mostUnderTotals = $derived(
    mostUnder ? partyTotals.find((p) => p.partyId === mostUnder.partyId) : null
  );

  // Trim the long tail of micro-parties from the visual table — 96 rows
  // including parties on <0.001% of the vote drowns the FPTP story in
  // noise. CSV exports under /parliament/data still ship every party.
  const PARTY_VISIBILITY_THRESHOLD = 0.01;
  const visibleParties = $derived(
    partyRows.filter((r) => r.party.voteShare >= PARTY_VISIBILITY_THRESHOLD)
  );
  const hiddenPartyCount = $derived(partyRows.length - visibleParties.length);

  // Top-N parties for the map legend. Anything below the visibility
  // threshold lands in "Other" — same rule the party table already uses.
  const legendParties = $derived(visibleParties.slice(0, 6));

  const gallagherLabel = $derived(gallagherDescriptor(summary.gallagher));

  // Stacked-share bars: the same party totals rendered twice, once
  // weighted by votes and once by seats. Reading them as a vertical
  // pair makes the FPTP distortion visible at a glance — long
  // Conservative/Reform votes-segment vs short seats-segment, etc.
  // Sort by vote share desc so the colour order is consistent and
  // readable across both bars.
  const sortedByVote = $derived(
    [...partyTotals].sort((a, b) => b.voteShare - a.voteShare)
  );
  const voteSegments = $derived<BarSegment[]>(
    sortedByVote.map((p) => ({
      party: p.partyDisplayName,
      share: p.voteShare,
      count: p.votes,
      total: summary.totalVotes,
      unit: 'votes'
    }))
  );
  const seatSegments = $derived<BarSegment[]>(
    sortedByVote.map((p) => ({
      party: p.partyDisplayName,
      share: p.seatShare,
      count: p.seats,
      total: summary.totalSeats,
      unit: 'seats'
    }))
  );

  // Per-party paired-bar rows for the "Vote share vs seat share by
  // party" section. Mirrors the layout on /councils/party/[slug]:
  // party header on its own row (brand-colour stripe + over/under
  // pts callout), then votes (filled) and seats (outlined) stacked
  // with left-aligned "votes" / "seats" labels. Same visibility
  // threshold as the legend — micro-parties live in the CSV downloads.
  const partyPairedBars = $derived<PairedBar[]>(
    visibleParties.map((row) => ({
      name: row.party.partyDisplayName,
      color: partyColor(row.party.partyDisplayName),
      voteShare: row.party.voteShare,
      seatShare: row.party.seatShare
    }))
  );
</script>

{#if headingLevel === 'h1'}
  <h1>{year} UK general election</h1>
{:else}
  <h2>{year} UK general election</h2>
{/if}

<div class="kpi-grid" aria-label="{year} general election headline figures">
  <div class="kpi">
    <span class="figure">{num(summary.totalSeats)}</span>
    <span class="label">
      constituencies elected
      ({num(summary.totalVotes)} valid votes)
    </span>
  </div>
  <div class="kpi">
    <span class="figure warn">{num(summary.minorityWinnerCount)}</span>
    <span class="label">
      seats won without majority support
      ({pct(summary.minorityWinnerCount / Math.max(1, summary.totalSeats))} of constituencies)
    </span>
  </div>
  <div class="kpi">
    <span class="figure figure--text warn">{gallagherLabel}</span>
    <span class="label">
      <a href="/parliament/methodology#gallagher">Gallagher index</a>
      {summary.gallagher.toFixed(1)}
    </span>
  </div>
</div>

<p>
  Under First Past the Post,
  <strong>{num(summary.minorityWinnerCount)} of
    {num(summary.totalSeats)}</strong>
  seats in this election were won without majority support &mdash; the
  candidate elected took less than half the valid votes in their
  constituency.
  {#if mostOver && mostOverTotals && mostOver.gap > 0}
    The {mostOver.partyDisplayName} turned
    <strong>{pct(mostOverTotals.voteShare, 1)}</strong>
    of votes into
    <strong>{pct(mostOverTotals.seatShare, 1)}</strong>
    of seats.
  {/if}
  {#if mostUnder && mostUnderTotals && mostUnder.gap < 0}
    The {mostUnder.partyDisplayName} took
    <strong>{pct(mostUnderTotals.voteShare, 1)}</strong>
    of votes but
    <strong>{pct(mostUnderTotals.seatShare, 1)}</strong>
    of seats.
  {/if}
  The Gallagher disproportionality index for this election was
  <strong>{summary.gallagher.toFixed(1)}</strong>
  (0 = perfectly proportional, higher = more distorted).
</p>

<ConstituencyLookup {constituencies} {year} />

<h2 id="constituency-map">Constituencies, coloured by winning party</h2>
<p class="muted">
  Every Westminster constituency under {year} boundaries, shaded by the
  party that took the seat. Hover for the winning share; click to open
  the full candidate record. Northern Ireland is included &mdash;
  Westminster elections use First Past the Post across the whole UK.
</p>
<div class="map-and-scale">
  <ConstituencyHexMap
    fills={constituencyFills}
    {year}
    title={`UK Westminster constituencies — ${year} general election, coloured by winning party`}
  />
  <div class="legend">
    <span class="legend-label">Winning party</span>
    <ul class="party-legend">
      {#each legendParties as row (row.party.partyId)}
        <li>
          <span
            class="swatch"
            style:background-color={partyColor(row.party.partyDisplayName)}
          ></span>
          {row.party.partyDisplayName}
          <span class="muted count">{num(row.party.seats)}</span>
        </li>
      {/each}
    </ul>
  </div>
</div>

<NationalDistortionSummary {summary} />

<h2>Vote share vs seat share by party</h2>

<PartyBars label="Vote share" segments={voteSegments} />
<PartyBars label="Seat share" segments={seatSegments} />

<p>
  Each party gets its own pair below: filled bar for vote share,
  outlined bar for seat share. The signed gap on the right is what
  First Past the Post produced &mdash; not what any party did wrong.
</p>
<PairedBarChart bars={partyPairedBars} />
{#if hiddenPartyCount > 0}
  <p class="muted">
    {num(hiddenPartyCount)} smaller parties (under
    {pct(PARTY_VISIBILITY_THRESHOLD, 0)} of valid votes) hidden &mdash;
    the full party-by-party totals are in the
    <a href="/parliament/data">CSV downloads</a>.
  </p>
{/if}

{#if summary.lowWinningShareLeaderboard.length > 0}
  <h2>
    Constituencies won without majority support &mdash; lowest winning
    shares
  </h2>
  <p>
    Every row here is a constituency where First Past the Post seated
    a candidate the majority of voters did not back. The winning
    candidate&rsquo;s name appears as a factual record of who took the
    seat; the subject of analysis is the voting method that produced
    the result.
  </p>
  <LowWinningShareTable rows={summary.lowWinningShareLeaderboard} {year} />
  <p class="muted">
    Sorted ascending by winning share. Click a constituency name to see
    the full candidate record.
  </p>
{/if}

<p class="muted">
  How these numbers are computed:
  <a href="/parliament/methodology">methodology</a>. Source data:
  <a href={manifest.sourceUrl} rel="external noopener"
    >{manifest.sourceName}</a>, retrieved
  {manifest.retrievalDate}, generated
  {new Date(manifest.generatedAt).toISOString().slice(0, 10)}
  ({manifest.licence}).
</p>
