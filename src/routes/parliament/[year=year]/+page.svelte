<script lang="ts">
  import { num, pct } from '$lib/format';
  import NationalDistortionSummary from '$lib/parliament/components/NationalDistortionSummary.svelte';
  import PartyVoteSeatBar from '$lib/parliament/components/PartyVoteSeatBar.svelte';
  import LowWinningShareTable from '$lib/parliament/components/LowWinningShareTable.svelte';

  let { data } = $props();

  // Pick a one-sentence headline party-pair for the prologue. Both come
  // straight from the precomputed national-summary envelope; we just
  // sort defensively in case the ETL's output order drifts.
  const mostOver = $derived(
    [...data.summary.voteVsSeatGap].sort((a, b) => b.gap - a.gap)[0] ?? null
  );
  const mostUnder = $derived(
    [...data.summary.voteVsSeatGap].sort((a, b) => a.gap - b.gap)[0] ?? null
  );

  const mostOverTotals = $derived(
    mostOver
      ? data.partyTotals.find((p) => p.partyId === mostOver.partyId)
      : null
  );
  const mostUnderTotals = $derived(
    mostUnder
      ? data.partyTotals.find((p) => p.partyId === mostUnder.partyId)
      : null
  );

  // Trim the long tail of micro-parties from the visual table — 96 rows
  // including parties on <0.001% of the vote drowns the FPTP story in
  // noise. CSV exports under /parliament/data still ship every party.
  const PARTY_VISIBILITY_THRESHOLD = 0.01;
  const visibleParties = $derived(
    data.partyRows.filter(
      (r) => r.party.voteShare >= PARTY_VISIBILITY_THRESHOLD
    )
  );
  const hiddenPartyCount = $derived(
    data.partyRows.length - visibleParties.length
  );
</script>

<svelte:head>
  <title>{data.year} UK general election — FPTP audit — electionresults.uk</title>
  <meta
    name="description"
    content={`First Past the Post audit of the ${data.year} UK general election: ${num(data.summary.minorityWinnerCount)} of ${num(data.summary.totalSeats)} seats won without majority support, Gallagher disproportionality ${data.summary.gallagher.toFixed(1)}.`}
  />
  <link rel="canonical" href={`https://electionresults.uk/parliament/${data.year}`} />
</svelte:head>

<main class="wide">
  <h1>{data.year} UK general election &mdash; FPTP audit</h1>

  <p>
    Under First Past the Post,
    <strong>{num(data.summary.minorityWinnerCount)} of
      {num(data.summary.totalSeats)}</strong>
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
    <strong>{data.summary.gallagher.toFixed(1)}</strong>
    (0 = perfectly proportional, higher = more distorted).
  </p>

  <NationalDistortionSummary summary={data.summary} />

  <h2>Vote share vs seat share by party</h2>
  <p>
    Each row pairs the party&rsquo;s national vote share (filled bar)
    with its national seat share (outlined bar) on the same axis. The
    gap is what First Past the Post produced &mdash; not what any
    party did wrong.
  </p>
  <table>
    <thead>
      <tr>
        <th scope="col">Party</th>
        <th scope="col">Vote share vs seat share</th>
        <th scope="col" class="num">Votes per seat</th>
      </tr>
    </thead>
    <tbody>
      {#each visibleParties as row (row.party.partyId)}
        <PartyVoteSeatBar party={row.party} votesPerSeat={row.votesPerSeat} />
      {/each}
    </tbody>
  </table>
  {#if hiddenPartyCount > 0}
    <p class="muted">
      {num(hiddenPartyCount)} smaller parties (under
      {pct(PARTY_VISIBILITY_THRESHOLD, 0)} of valid votes) hidden &mdash;
      the full party-by-party totals are in the
      <a href="/parliament/data">CSV downloads</a>.
    </p>
  {/if}
  <p class="muted">
    Votes-per-seat is total votes the party received nationally divided
    by the seats it won. Parties with no seats show
    &ldquo;no seats won&rdquo; rather than a divide-by-zero result.
  </p>

  {#if data.summary.lowWinningShareLeaderboard.length > 0}
    <h2>
      Constituencies won without majority support &mdash; lowest winning
      shares
    </h2>
    <p>
      Every row here is a constituency where First Past the Post seated
      a candidate the majority of voters did not back. The winning
      candidate&rsquo;s name appears as a factual record of who took
      the seat; the subject of analysis is the voting method that
      produced the result.
    </p>
    <LowWinningShareTable
      rows={data.summary.lowWinningShareLeaderboard}
      year={data.year}
    />
    <p class="muted">
      Sorted ascending by winning share. Click a constituency name to
      see the full candidate record.
    </p>
  {/if}

  <p class="muted">
    How these numbers are computed:
    <a href="/parliament/methodology">methodology</a>. Source data:
    <a href={data.manifest.sourceUrl} rel="external noopener"
      >{data.manifest.sourceName}</a>, retrieved
    {data.manifest.retrievalDate}, generated
    {new Date(data.manifest.generatedAt).toISOString().slice(0, 10)}
    ({data.manifest.licence}).
  </p>
</main>
