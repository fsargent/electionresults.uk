<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import { partyColor, partyDisplayName } from '$lib/party-colors';
  import PartyBars from '$lib/components/PartyBars.svelte';
  import SeatChart from '$lib/components/SeatChart.svelte';
  let { data } = $props();
  const history = $derived(data.history);
  const flips = $derived(data.flips);
  // composition is the opencouncildata truth-set snapshot when we have
  // one (preferred); compositionApprox is the fallback sum-across-cycles
  // approximation for councils oncd doesn't cover for that year.
  const composition = $derived(data.composition);
  const compositionApprox = $derived(data.compositionApprox);
  // Build a SeatChart-shaped row list from the truth-set snapshot.
  // Prefer the per-councillor breakdown (partiesDetailed) when we have
  // it — that gives every square its actual party label (Ashfield
  // Independents, Aspire, Independent / Other, etc.) instead of
  // collapsing everything to a generic "Other" bucket. Falls back to
  // the named-parties + Other split from the summary CSV when no
  // per-councillor snapshot exists for this (council, year).
  const truthRows = $derived(
    composition
      ? composition.partiesDetailed
        ? Object.entries(composition.partiesDetailed)
            .filter(([, n]) => n > 0)
            .map(([party, seats]) => ({ party, seats }))
            .sort((a, b) => b.seats - a.seats)
        : [
            ...Object.entries(composition.parties)
              .filter(([, n]) => n > 0)
              .map(([party, seats]) => ({ party, seats })),
            ...(composition.otherSeats > 0
              ? [{ party: 'Other', seats: composition.otherSeats }]
              : [])
          ].sort((a, b) => b.seats - a.seats)
      : []
  );

  // Same logic, but for per-flip composition viz: takes a snapshot,
  // returns SeatChart segments preferring detailed breakdown.
  function flipCompositionRows(comp: typeof composition) {
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
</script>

<svelte:head>
  <title>{history.council} — election results audit | electionresults.uk</title>
  <meta
    name="description"
    content={`${history.council}: every cycle we have data for, with party-control flips between consecutive elections.`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/${history.councilSlug}`}
  />
</svelte:head>

<main class="wide">
  <p class="muted"><a href="/">← All councils</a></p>
  <h1>{history.council}</h1>
  <p class="muted">
    Every election cycle we have data for, most recent first.
  </p>

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
        <a class="cycle" href={`/${history.councilSlug}/${c.year}`}>
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
      annual snapshot &mdash; reflects the council on 1 January {composition.year}
      including by-elections and defections. Hover any seat for the
      party.
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

  {#if flips.length > 0}
    <h2>Council-control changes between cycles</h2>
    <p>
      Cases where the largest party in the council's running composition
      actually changed from one year to the next (composition data via
      <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>).
      Each row shows the incoming party's vote share in both cycles and
      the council's full composition before and after &mdash; a small
      <strong>vote shift</strong> paired with a big
      <strong>composition shift</strong> is the classic First-Past-the-Post
      pattern: small change in support, sweeping change in representation.
    </p>

    {#each flips as f (f.yearFrom + ':' + f.yearTo)}
      {@const newColor = partyColor(f.toParty)}
      {@const oldColor = partyColor(f.fromParty)}
      <section class="flip">
        <h3 class="flip-year">
          <span class="from">{f.yearFrom}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span class="to">{f.yearTo}</span>
        </h3>
        <p class="flip-summary">
          <Party name={f.fromParty} />
          <span class="arrow muted" aria-hidden="true">→</span>
          <Party name={f.toParty} />
        </p>

        <div class="flip-grid">
          <div>
            <span class="lbl">Vote shift (incoming party)</span>
            <span class="val pct" class:warn={f.voteSwingNew < 0.05}>{pts(f.newPartyVoteTo - f.newPartyVoteFrom)}</span>
            <span class="muted small">
              {pct(f.newPartyVoteFrom)} → {pct(f.newPartyVoteTo)}
            </span>
          </div>
          <div>
            <span class="lbl">Seat shift (incoming party)</span>
            <span class="val pct warn">{pts(f.newPartySeatTo - f.newPartySeatFrom)}</span>
            <span class="muted small">
              {pct(f.newPartySeatFrom)} → {pct(f.newPartySeatTo)}
            </span>
          </div>
          <div>
            <span class="lbl">Outgoing party (vote / seats {f.yearFrom} → {f.yearTo})</span>
            <span class="val pct muted">
              {pct(f.oldPartyVoteFrom)} → {pct(f.oldPartyVoteTo)}
            </span>
            <span class="muted small">
              seats: {pct(f.oldPartySeatFrom)} → {pct(f.oldPartySeatTo)}
            </span>
          </div>
        </div>

        <h4 class="bars-heading">Cycle vote share vs full-council composition</h4>
        <p class="muted small bars-note">
          The vote-share bar is the share of votes cast in this cycle's
          election. The composition row is one square per councillor in
          the full council that year &mdash; including councillors
          elected in earlier cycles for by-thirds councils &mdash; from
          the <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
          annual snapshot. The contrast is the editorial story: a
          modest move in vote share produced a much bigger move in
          composition.
        </p>
        <div class="bars" aria-label="Cycle vote share and full council composition across the two cycles">
          {#each [{ year: f.yearFrom, view: f.partyViewFrom, comp: f.compositionFrom }, { year: f.yearTo, view: f.partyViewTo, comp: f.compositionTo }] as { year, view, comp } (year)}
            <div class="bar-block">
              <div class="bar-year muted">{year}</div>
              {#if view}
                <PartyBars
                  label="Vote share (this cycle)"
                  segments={view.rows.map((r) => ({
                    party: r.party,
                    share: r.voteShare,
                    count: r.votes,
                    total: view.totalVotes,
                    unit: 'votes'
                  }))}
                />
              {:else}
                <p class="muted small">No party-view data for {year}.</p>
              {/if}
              {#if comp}
                <SeatChart
                  label={`Council composition (${year})`}
                  segments={flipCompositionRows(comp)}
                />
              {:else}
                <p class="muted small">No composition snapshot for {year}.</p>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}

  {:else}
    <p class="muted">
      Only one cycle of data for this council so far — no
      between-cycle comparison possible yet.
    </p>
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
                    <a href={`/${history.councilSlug}/${cell.year}#${cell.wardSlug}`} class="ward-link">
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

  section.flip {
    border-top: 1px solid var(--rule);
    padding-top: 1.5rem;
    margin-top: 2rem;
  }
  /* Per-flip year header: sized to sit clearly BELOW the section h2
     (1.4rem) and the page h1 (2rem). Keeps the serif identity as a
     visual marker for "this is one flip event" but stops competing
     with the parent section heading. */
  .flip-year {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--accent);
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    font-variant-numeric: tabular-nums;
  }
  .flip-year .arrow {
    font-size: 1rem;
    color: var(--muted);
  }
  .flip-summary {
    margin: 0.4rem 0 0.6rem;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .flip-summary .arrow { font-size: 1.1rem; }
  .flip-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.5rem 1.6rem;
    margin: 0.6rem 0 0.8rem;
  }
  .flip-grid div {
    display: flex;
    flex-direction: column;
  }
  .lbl {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .val {
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .val.warn { color: var(--warn); }
  .small { font-size: 0.78rem; }
  .warn { color: var(--warn); }

  .bars {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 700px) {
    .bars { grid-template-columns: 1fr; }
  }
  .bar-block {
    display: grid;
    gap: 0.3rem;
  }
  .bar-year {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .council-seats {
    margin: 0.6rem 0 1.5rem;
    max-width: 36rem;
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
  /* The standalone seat chart on this page doesn't need the left-label
     column — collapse the row layout to a single column. */
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
