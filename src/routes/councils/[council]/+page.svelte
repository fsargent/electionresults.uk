<script lang="ts">
  import { pct, num } from '$lib/format';
  import { partyColor, partyDisplayName } from '$lib/party-colors';
  import SeatChart from '$lib/components/SeatChart.svelte';
  import PartyViewBlock from '$lib/components/PartyViewBlock.svelte';
  let { data } = $props();
  const history = $derived(data.history);
  const aggregateDistortion = $derived(data.aggregateDistortion);
  const aggregateBelowQuota = $derived(data.aggregateBelowQuota);
  // composition is the opencouncildata truth-set snapshot when we have
  // one (preferred); compositionApprox is the fallback sum-across-cycles
  // approximation for councils oncd doesn't cover for that year.
  const composition = $derived(data.composition);
  const compositionApprox = $derived(data.compositionApprox);
  // Build a SeatChart-shaped row list from a composition snapshot.
  // Prefer the per-councillor breakdown (partiesDetailed) when we have
  // it — that gives every square its actual party label (Ashfield
  // Independents, Aspire, Independent / Other, etc.) instead of
  // collapsing everything to a generic "Other" bucket. Falls back to
  // the named-parties + Other split from the summary CSV when no
  // per-councillor snapshot exists for this (council, year).
  function compositionSegments(comp: typeof composition) {
    if (!comp) return [];
    if (comp.partiesDetailed) {
      return Object.entries(comp.partiesDetailed)
        .filter(([, n]) => n > 0)
        .map(([party, seats]) => ({ party, seats }))
        .sort((a, b) => b.seats - a.seats);
    }
    return [
      ...Object.entries(comp.parties)
        .filter(([, n]) => n > 0)
        .map(([party, seats]) => ({ party, seats })),
      ...(comp.otherSeats > 0
        ? [{ party: 'Other', seats: comp.otherSeats }]
        : [])
    ].sort((a, b) => b.seats - a.seats);
  }
  const truthRows = $derived(compositionSegments(composition));
  // Year-by-year timeline, newest → oldest. Includes the latest year
  // even though the headline "Council composition as of {year}" snapshot
  // shows the same data — gapping the most recent row out of the
  // timeline reads as missing data, not deduplication.
  const compositionHistoryEntries = $derived(
    [...data.compositionHistory].sort((a, b) => b.year - a.year)
  );
</script>

<svelte:head>
  <title>{history.council} — election results audit | electionresults.uk</title>
  <meta
    name="description"
    content={`${history.council}: every cycle we have data for, with vote share vs seats won for the most recent election.`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/councils/${history.councilSlug}`}
  />
  <!-- Social-share preview: vote share vs FPTP vs proportional, latest
       cycle. Generated build-time by scripts/build-og.mjs. -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content={`${history.council} — election results audit`} />
  <meta
    property="og:description"
    content={`${history.council}: vote share vs seats won, ${data.latestCycle?.year ?? ''} cycle.`}
  />
  <meta
    property="og:image"
    content={`https://electionresults.uk/og/${history.councilSlug}.png`}
  />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:image"
    content={`https://electionresults.uk/og/${history.councilSlug}.png`}
  />
</svelte:head>

<main class="wide">
  <p class="muted"><a href="/">← All councils</a></p>
  <h1>{history.council}</h1>
  <p class="muted">
    Every election cycle we have data for, most recent first.
  </p>

  <div class="summary">
    <div class="kpi">
      <span class="figure">{num(history.cycles.length)}</span>
      <span class="label">
        cycle{history.cycles.length === 1 ? '' : 's'} in our data
      </span>
    </div>
    {#if aggregateBelowQuota && aggregateBelowQuota.belowQuotaSeats > 0}
      <div class="kpi">
        <span class="figure pct warn">{pct(aggregateBelowQuota.share)}</span>
        <span class="label">
          all-time seats elected below the quota
          ({num(aggregateBelowQuota.belowQuotaSeats)} of
          {num(aggregateBelowQuota.totalSeats)})
        </span>
      </div>
    {/if}
    {#if aggregateDistortion}
      <div class="kpi">
        <span class="figure pct" class:warn={aggregateDistortion.share > 0}>
          {pct(aggregateDistortion.share)}
        </span>
        <span class="label">
          all-time seats unfairly awarded
          ({num(aggregateDistortion.reallocated)} of
          {num(aggregateDistortion.totalSeats)} across
          {num(aggregateDistortion.cycleCount)}
          cycle{aggregateDistortion.cycleCount === 1 ? '' : 's'})
        </span>
      </div>
    {/if}
  </div>

  {#if data.reorganisation}
    {@const r = data.reorganisation}
    <aside class="reorg-flag">
      <h2 class="reorg-h">⚠ Council reorganisation in {r.year}</h2>
      {#if r.event === 'created'}
        <p>
          <strong>{r.councilName}</strong> was created on {r.date} as a
          new unitary authority, replacing the previous councils:
          {r.counterparts.join(', ')}. Cycles before {r.year} on this
          page belong to those predecessor councils where they polled
          on the same date; the {r.year}+ cycles are this new
          authority. Year-over-year comparisons across the boundary
          should be read with that in mind.
        </p>
      {:else}
        <p>
          <strong>{r.councilName}</strong> was abolished on {r.date}
          and replaced by {r.counterparts.join(', ')}. Cycles up to and
          including {r.year} on this page belong to this council; later
          cycles, where they exist, belong to the successor authority.
        </p>
      {/if}
    </aside>
  {/if}

  <h2>Cycles</h2>
  <ul class="cycle-list">
    {#each history.cycles as c (c.year)}
      <li>
        <a class="cycle" href={`/councils/${history.councilSlug}/${c.year}`}>
          <span class="cycle-year">{c.year}</span>
          <span class="cycle-stats">
            {num(c.raceCount)} race{c.raceCount === 1 ? '' : 's'} ·
            {num(c.totalSeatCount)} seat{c.totalSeatCount === 1 ? '' : 's'}
          </span>
          <span class="cycle-quota">
            <span class="warn">{pct(c.belowQuotaShare)}</span>
            <span class="muted">below quota</span>
          </span>
        </a>
      </li>
    {/each}
  </ul>

  {#if composition && composition.totalSeats > 0}
    <h2>Council composition <span class="muted approx">as of {composition.year}</span></h2>
    <p class="muted">
      {num(composition.totalSeats)} councillors, by party. One square per seat.
      Source:
      <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
      annual snapshot &mdash; reflects the council at the end of {composition.year}
      (after that year's elections, by-elections and defections). Hover
      any seat for the party.
    </p>
    <div class="council-seats">
      <SeatChart segments={truthRows} minSize={18} />
    </div>
  {:else if compositionApprox && compositionApprox.totalSeats > 0}
    <h2>Council composition <span class="muted approx">(approx.)</span></h2>
    <p class="muted">
      No opencouncildata snapshot for this council yet &mdash; falling back to
      our approximation: {num(compositionApprox.totalSeats)} councillors elected
      across cycles
      {compositionApprox.yearsCovered.length === 1
        ? compositionApprox.yearsCovered[0]
        : compositionApprox.yearsCovered.join(', ')}, summed by party.
      <strong>Approximate</strong>: by-thirds councils mid-term, boundary
      reviews, and partial-cycle elections all mean this can be a few seats off
      the live council count. Hover any seat for the party.
    </p>
    <div class="council-seats">
      <SeatChart segments={compositionApprox.rows} minSize={18} />
    </div>
  {/if}

  {#if data.latestPartyView && data.latestPartyView.rows.length > 1 && data.latestCycle}
    {@const view = data.latestPartyView}
    {@const cycle = data.latestCycle}
    <h2 id="latest-election">Most recent election ({cycle.year})</h2>
    <p>
      In {cycle.year}, {num(cycle.totalSeatCount)} seat{cycle.totalSeatCount === 1 ? '' : 's'}
      {cycle.totalSeatCount === 1 ? 'was' : 'were'} up across
      {num(cycle.raceCount)} ward{cycle.raceCount === 1 ? '' : 's'}. The table
      below shows what each party actually won &mdash; alongside what they
      would have won if the {view.totalSeats} seat{view.totalSeats === 1 ? '' : 's'}
      had been shared in proportion to votes received
      (<a href="/councils/methodology">how, with caveats</a>). The
      <strong>Δ</strong> column is the actual seat count minus the
      proportional seat count &mdash; positive numbers are parties
      First-Past-the-Post over-represented; negative are parties it
      under-represented.
    </p>

    <PartyViewBlock {view} />

    <p class="muted">
      <a href="/councils/{history.councilSlug}/{cycle.year}">Full ward-by-ward results for {cycle.year} →</a>
    </p>
  {/if}

  {#if compositionHistoryEntries.length > 0}
    <h2>Composition history</h2>
    <p class="muted">
      One row per
      <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
      annual snapshot — the council at the end of each year (after that
      year's elections, by-elections and defections). Newest first;
      hover any seat for the party.
    </p>
    <div class="composition-history">
      {#each compositionHistoryEntries as snap (snap.year)}
        <SeatChart
          label={String(snap.year)}
          segments={compositionSegments(snap)}
          minSize={14}
        />
      {/each}
    </div>
  {/if}

  {#if data.wards.years.length > 1 && data.wards.rows.length > 0}
    <h2>Ward by ward</h2>
    <p>
      Each row is a ward, each column a cycle. Each cell shows the
      top-of-poll candidate's party (swatch) and their share of valid
      ballots. Wards are matched by name across cycles — boundary
      reviews can mean a ward of the same name is a slightly different
      area in a later cycle.
    </p>
    <div class="ward-grid-wrap">
      <table class="ward-grid">
        <thead>
          <tr>
            <th class="ward-name">Ward</th>
            {#each data.wards.years as year (year)}
              <th class="num">{year}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each data.wards.rows as row (row.wardName)}
            <tr>
              <td class="ward-name">{row.wardName}</td>
              {#each data.wards.years as year (year)}
                {@const cell = row.cells.find((c) => c.year === year)}
                {#if cell}
                  {@const c = partyColor(cell.winnerParty)}
                  <td
                    class="ward-cell"
                    style:background-color={c}
                    title={`${row.wardName} ${cell.year}: ${cell.winnerName} (${partyDisplayName(cell.winnerParty)}) — ${cell.winnerVotes} votes, ${pct(cell.winningPct)} of ${cell.validBallots} valid ballots`}
                  >
                    <a href={`/councils/${history.councilSlug}/${cell.year}#${cell.wardSlug}`} class="ward-link">
                      {pct(cell.winningPct, 0)}
                    </a>
                  </td>
                {:else}
                  <td class="ward-cell empty"></td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</main>

<style>
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 1.5rem;
  }
  .kpi {
    border: 1px solid var(--rule);
    padding: 0.75rem 0.9rem;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
  }
  .kpi .figure {
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .kpi .figure.warn { color: var(--warn); }
  .kpi .label {
    font-size: 0.85rem;
    color: var(--muted);
  }

  .cycle-list {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.6rem;
    margin: 1rem 0 2rem;
  }
  .cycle {
    display: grid;
    gap: 0.15rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.1s, background 0.1s;
  }
  .cycle:hover {
    border-color: var(--accent);
    background: rgba(11, 61, 46, 0.04);
  }
  .cycle-year {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.45rem;
    font-weight: 700;
    color: var(--accent);
  }
  .cycle-stats,
  .cycle-quota {
    font-size: 0.85rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .council-seats {
    margin: 0.6rem 0 1.5rem;
  }
  .composition-history {
    margin: 0.6rem 0 1.5rem;
    display: grid;
    gap: 0.4rem;
  }
  .approx {
    font-size: 0.6em;
    font-weight: 400;
    text-transform: lowercase;
    letter-spacing: 0;
  }
  .reorg-flag {
    border-left: 3px solid var(--warn);
    background: rgba(185, 74, 44, 0.06);
    padding: 0.7rem 1rem;
    margin: 1rem 0 1.5rem;
    font-size: 0.95rem;
  }
  .reorg-h {
    font-size: 1rem;
    margin: 0 0 0.4rem;
    color: var(--warn);
    font-family: -apple-system, sans-serif;
  }
  .reorg-flag p { margin: 0; }
  /* The headline seat chart at the top of the page has no label, so drop
     the SeatChart left-label column. The composition-history block below
     keeps it (year labels). */
  .council-seats :global(.seat-row) {
    grid-template-columns: 1fr;
  }

  .ward-grid-wrap {
    overflow-x: auto;
    margin: 1rem 0 2rem;
  }
  table.ward-grid {
    border-collapse: separate;
    border-spacing: 2px;
    width: auto;
    font-size: 0.85rem;
  }
  table.ward-grid th,
  table.ward-grid td {
    padding: 0.4rem 0.55rem;
    border-bottom: none;
    font-variant-numeric: tabular-nums;
  }
  table.ward-grid th.ward-name,
  table.ward-grid td.ward-name {
    text-align: left;
    background: transparent;
    white-space: nowrap;
    padding-right: 1rem;
    font-weight: 500;
  }
  table.ward-grid th {
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  table.ward-grid td.ward-cell {
    text-align: center;
    border-radius: 3px;
    color: rgba(255, 255, 255, 0.95);
    font-weight: 600;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
    min-width: 3rem;
  }
  table.ward-grid td.ward-cell.empty {
    background: transparent;
    color: var(--muted);
  }
  table.ward-grid td.ward-cell .ward-link {
    color: inherit;
    text-decoration: none;
    display: block;
    width: 100%;
  }
  table.ward-grid td.ward-cell .ward-link:hover {
    text-decoration: underline;
  }
</style>
