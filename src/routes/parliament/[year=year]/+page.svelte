<script lang="ts">
  import { num, pct } from '$lib/format';
  import NationalDistortionSummary from '$lib/parliament/components/NationalDistortionSummary.svelte';
  import PartyVoteSeatBar from '$lib/parliament/components/PartyVoteSeatBar.svelte';

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
</script>

<svelte:head>
  <title>{data.year} UK general election — FPTP audit — electionresults.uk</title>
  <meta
    name="description"
    content={`First Past the Post audit of the ${data.year} UK general election: ${num(data.summary.minorityWinnerCount)} of ${num(data.summary.totalSeats)} seats won without majority support, Gallagher disproportionality ${data.summary.gallagher.toFixed(1)}.`}
  />
  <link rel="canonical" href={`https://electionresults.uk/parliament/${data.year}`} />
</svelte:head>

<main>
  <p class="badge" aria-label="Section: Parliament">Parliament</p>
  <h1>{data.year} UK general election &mdash; FPTP audit</h1>

  <p class="prologue">
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

  <section aria-labelledby="party-bars-heading" class="party-section">
    <h2 id="party-bars-heading">Vote share vs seat share by party</h2>
    <p>
      Each row pairs the party&rsquo;s national vote share (filled bar)
      with its national seat share (outlined bar) on the same axis. The
      gap is what First Past the Post produced &mdash; not what any
      party did wrong.
    </p>
    <div class="table-scroll">
      <table class="party-bars">
        <caption class="visually-hidden">
          Vote share, seat share, FPTP outcome, and votes per seat for
          every party that contested the {data.year} UK general election,
          ordered by vote share descending.
        </caption>
        <thead>
          <tr>
            <th scope="col">Party</th>
            <th scope="col">Vote share vs seat share</th>
            <th scope="col" class="num">Votes per seat</th>
          </tr>
        </thead>
        <tbody>
          {#each data.partyRows as row (row.party.partyId)}
            <PartyVoteSeatBar
              party={row.party}
              votesPerSeat={row.votesPerSeat}
            />
          {/each}
        </tbody>
      </table>
    </div>
    <p class="muted">
      Votes-per-seat is a rough efficiency measure: total votes the
      party received nationally divided by the seats it won. Parties
      with no seats show &ldquo;no seats won&rdquo; rather than a
      divide-by-zero result.
    </p>
  </section>

  <footer class="page-footer">
    <p class="muted">
      How these numbers are computed:
      <a href="/parliament/methodology">methodology</a>. Source data:
      <a href={data.manifest.sourceUrl} rel="external noopener"
        >{data.manifest.sourceName}</a
      >, retrieved {data.manifest.retrievalDate}, generated
      {new Date(data.manifest.generatedAt).toISOString().slice(0, 10)}
      ({data.manifest.licence}).
    </p>
  </footer>
</main>

<style>
  .badge {
    display: inline-block;
    margin: 0 0 0.25rem;
    padding: 0.15rem 0.55rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent-fg);
    background: var(--accent);
    border-radius: 3px;
  }

  .prologue {
    font-size: 1.05rem;
  }

  .party-section {
    margin: 2rem 0;
  }

  /* Horizontal scroll for the bars table on narrow viewports — same
     pattern as global tables (see global.css). Bars cell is at least
     8rem (set on .bars in the component) so the visualisation never
     collapses to a sliver. */
  .table-scroll {
    overflow-x: auto;
  }

  table.party-bars {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
    font-size: 0.95rem;
  }

  /* tbody cells live in PartyVoteSeatBar; :global() reaches across the
     component boundary so the table owns its own row spacing. */
  table.party-bars thead th,
  table.party-bars :global(tbody th),
  table.party-bars :global(tbody td) {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--rule);
    vertical-align: top;
  }

  table.party-bars thead th {
    text-align: left;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--muted);
    border-bottom: 2px solid var(--rule);
  }

  table.party-bars .num {
    text-align: right;
    white-space: nowrap;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .page-footer {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
  }
</style>
