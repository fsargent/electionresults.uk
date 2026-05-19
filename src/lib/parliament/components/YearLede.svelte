<script lang="ts">
  // One editorial lede paragraph per general-election year. Names the
  // worst minority-winner contest in the cycle (same rhetorical move
  // as the home-page lede), then folds in the headline scale figure
  // (minority winners + share), the most over- and most
  // under-represented parties (vote→seat distortion), and the
  // Gallagher index. Replaces the older "Under FPTP, X of Y..."
  // paragraph that lived inside YearAudit — same facts, single
  // narrative pass, with a click-through into the actual constituency
  // so the reader can verify the story themselves.
  //
  // Rendered inside YearAudit so /parliament and /parliament/[year]
  // both get it without each page reassembling the prose.

  import { num, pct } from '$lib/format';
  import type {
    NationalPartyTotal,
    NationalSummary
  } from '$lib/parliament/types';

  let {
    year,
    summary,
    partyTotals
  }: {
    year: number;
    summary: NationalSummary;
    partyTotals: NationalPartyTotal[];
  } = $props();

  // Worst minority-winner contest in the cycle. Leaderboard is sorted
  // ascending by winning share upstream, so [0] is the smallest
  // mandate. Null when the ETL didn't surface any low-share rows
  // (e.g. an entirely uncontested set, which would be a data bug).
  const worst = $derived(summary.lowWinningShareLeaderboard[0] ?? null);

  const minorityShare = $derived(
    summary.minorityWinnerCount / Math.max(1, summary.totalSeats)
  );

  // Most over- and most under-represented parties by signed
  // vote-vs-seat gap (gap = seatShare - voteShare). The summary
  // already ships voteVsSeatGap; we sort defensively in case the ETL
  // output order drifts.
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
</script>

<p class="lede">
  {#if worst}
    The most extreme case in the {year} general election: an MP elected
    on
    <strong>{pct(worst.winningShare, 1)}</strong>
    of the vote in
    <a href={`/parliament/${year}/${worst.constituencySlug}`}
      ><strong>{worst.constituencyName}</strong></a
    >
    &mdash; meaning
    <strong>{pct(1 - worst.winningShare, 1)}</strong>
    of people who voted there chose someone else, and they still won
    the seat.
  {/if}
  Under First Past the Post that&rsquo;s how every Westminster contest
  works: a candidate wins by being top of the poll, regardless of
  share, with no minimum threshold. Across the whole {year} cycle that
  produced
  <strong>{num(summary.minorityWinnerCount)}</strong>
  MPs who took less than half the votes in their constituency
  ({pct(minorityShare)} of the
  <strong>{num(summary.totalSeats)}</strong> seats).
  {#if mostOver && mostOverTotals && mostOver.gap > 0.01}
    The {mostOver.partyDisplayName} turned
    <strong>{pct(mostOverTotals.voteShare, 1)}</strong>
    of votes into
    <strong>{pct(mostOverTotals.seatShare, 1)}</strong>
    of seats;
  {/if}
  {#if mostUnder && mostUnderTotals && mostUnder.gap < -0.01}
    {mostUnder.partyDisplayName} took
    <strong>{pct(mostUnderTotals.voteShare, 1)}</strong>
    of votes but
    <strong>{pct(mostUnderTotals.seatShare, 1)}</strong>
    of seats.
  {/if}
  The Gallagher disproportionality index for this election was
  <strong>{summary.gallagher.toFixed(1)}</strong>
  &mdash; <a href="/parliament/methodology#gallagher">methodology</a>.
</p>

<p class="call-to-action">
  Want a fix? Back the call for a
  <a
    href="https://www.open-britain.co.uk/ncer"
    rel="external noopener"
    >National Commission on Electoral Representation</a
  >.
</p>

<style>
  .lede {
    font-size: 1.15rem;
    max-width: 72ch;
    margin: 1rem 0 0.6rem;
  }
  .call-to-action {
    max-width: 72ch;
    margin: 0 0 1.5rem;
    padding: 0.7rem 1rem;
    background: rgba(11, 61, 46, 0.05);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    font-size: 1rem;
  }
</style>
