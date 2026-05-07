<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import CouncilHexMap from '$lib/components/CouncilHexMap.svelte';
  import { belowQuotaColor } from '$lib/below-quota-color';
  import { partyColor, partyDisplayName } from '$lib/party-colors';
  let { data } = $props();

  const fills = $derived(
    Object.fromEntries(
      data.latestByCouncil.map((c) => [
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

  // Year-over-year flips map: each council hex shows the colour of the
  // party that took plurality in the most recent flip. Councils that
  // never flipped between consecutive cycles stay grey.
  const flipFills = $derived(
    Object.fromEntries(
      data.flipMapEntries.map((f) => {
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
</script>

<svelte:head>
  <title>electionresults.uk — auditing UK council seats won when most voters chose someone else</title>
  <meta
    name="description"
    content="A volunteer audit of UK local-election results across five cycles (2021–2025). For every ward, we ask: did the winner clear the share of votes a fair, proportional system would require?"
  />
  <link rel="canonical" href="https://electionresults.uk/" />
</svelte:head>

<div class="banner">
  Pre-launch preview · five English local-election cycles loaded
  (2021–2025). The 2026-05-07 results will appear as the source data
  for that cycle is published.
</div>

<main class="wide">
  <h1>How many UK councillors won when most voters chose someone else?</h1>

  <p class="lede">
    The most extreme case in our data: a councillor elected on
    <strong>{pct(data.lowestWinner.winningPct)}</strong> of the vote
    in {data.lowestWinner.wardName} ({data.lowestWinner.council},
    {data.lowestWinner.year}) &mdash; meaning
    <strong>{pct(1 - data.lowestWinner.winningPct)}</strong>
    of people who voted in that ward chose someone else, and they
    still won the seat. Under First-Past-the-Post and bloc vote,
    that's allowed: a candidate wins by being top of the poll,
    regardless of share, with no minimum threshold. We compare every
    elected councillor's share of votes to the share they would need
    under a system where seats match votes.<sup class="fn"><a
      href="/methodology#quota"
      title="See the methodology page for the formula and worked examples"
    >(1)</a></sup> Across five cycles of UK local elections &mdash;
    covering county councils, unitary authorities, metropolitan
    boroughs, district councils and London boroughs &mdash; that's
    <strong>{num(data.totals.councils)}</strong> council-cycles,
    <strong>{num(data.totals.races)}</strong> ward races and
    <strong>{num(data.totals.seats)}</strong> seats. Of those,
    <strong>{num(data.totals.belowQuotaSeats)}</strong>
    ({pct(data.totals.belowQuotaSeats / Math.max(1, data.totals.seats))})
    fell short of that fair share.
  </p>

  <h2>Year-over-year flips</h2>
  <p class="muted">
    Each council where the leading party changed between consecutive cycles,
    coloured by the party that took the lead. Councils that haven't
    flipped (or that we only have one cycle for) stay grey. Hover for
    the cycle and the party transition; click to see the council's full
    history.
  </p>
  <div class="map-and-scale">
    <CouncilHexMap
      fills={flipFills}
      title="UK councils — most recent party-control flip, coloured by the incoming party"
    />
    <div class="legend">
      <span class="legend-label">Incoming party (latest flip)</span>
      <ul class="party-legend">
        <li><span class="swatch" style:background-color={partyColor('Labour Party')}></span> Labour</li>
        <li><span class="swatch" style:background-color={partyColor('Conservative and Unionist Party')}></span> Conservative</li>
        <li><span class="swatch" style:background-color={partyColor('Liberal Democrats')}></span> Liberal Democrats</li>
        <li><span class="swatch" style:background-color={partyColor('Reform UK')}></span> Reform UK</li>
        <li><span class="swatch" style:background-color={partyColor('Green Party')}></span> Green</li>
        <li><span class="swatch" style:background-color={partyColor('Independent')}></span> Independent / other</li>
        <li><span class="swatch grey"></span> No flip in our data</li>
      </ul>
    </div>
  </div>

  <h2>Ten most FPTP-distorted single elections</h2>
  <p class="muted">
    For each cycle in our data, we compute the seats actually allocated
    by First-Past-the-Post and the seats a proportional system (D'Hondt)
    would have allocated from the same vote totals. The
    <strong>reallocated</strong> column is the count of seats FPTP
    placed differently, sorted by raw count so the largest reallocations
    lead. Click a council to see the full per-cycle vote-share-vs-seat-
    share visualisation. See
    <a href="/distortion">the full distortion leaderboard</a> for more.
  </p>

  <table aria-label="Ten most FPTP-distorted single elections">
    <thead>
      <tr>
        <th>Year</th>
        <th>Council</th>
        <th class="num">Seats</th>
        <th class="num">Reallocated</th>
        <th class="num">% of seats</th>
        <th>Most over-represented</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topDistortedCycles as r (r.councilSlug + ':' + r.year)}
        <tr>
          <td class="num"><a href={`/${r.year}`}>{r.year}</a></td>
          <td>
            <a href={`/${r.councilSlug}/${r.year}#party-view`}>
              <strong>{r.council}</strong>
            </a>
          </td>
          <td class="num">{r.totalSeats}</td>
          <td class="num warn">{r.reallocated}</td>
          <td class="num pct warn">{pct(r.reallocatedShare)}</td>
          <td>
            {#if r.mostOver}
              <Party name={r.mostOver.party} />
              <span class="muted small">
                · {pct(r.mostOver.voteShare)} of votes →
                {pct(r.mostOver.fptpSeatShare)} of seats
              </span>
            {:else}
              <span class="muted">—</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h2>Distorted elections</h2>
  <p class="muted">
    Councils where seats went to candidates with less support than
    a proportional system would require. The map shades every UK council
    by how many of its seats fell below that bar in its most recent
    cycle (darker = more seats below). The table lists the ten seats
    won on the smallest share of the vote anywhere in the data.
  </p>
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
        One hex = one council. The layout is roughly geographic but not
        a literal map (it's a cartogram — each council gets equal space,
        regardless of size). A council that polled in 2025 shows 2025;
        a London Borough that last polled in 2022 shows 2022.
      </p>
    </div>
  </div>

  <h3>Ten seats won on the smallest share of the vote</h3>
  <p class="muted">
    The seats furthest below the proportional quota anywhere in the data
    — councillors elected on the smallest share of votes in their ward.
    Click a ward to see the full race.
  </p>

  <table aria-label="Ten seats won on the smallest share of the vote across all cycles">
    <thead>
      <tr>
        <th>Year</th>
        <th>Ward / Council</th>
        <th>Seat-holder (party, per public record)</th>
        <th class="num">Seats</th>
        <th class="num">Won at</th>
        <th class="num">Quota</th>
        <th
          class="num"
          title="Marginal winner's share minus the proportional quota for this race. Negative = below; positive = above."
        >Below quota</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topLowestShares as r (r.year + r.councilSlug + r.wardSlug)}
        <tr>
          <td><a href={`/${r.year}`}>{r.year}</a></td>
          <td>
            <a href={`/${r.councilSlug}/${r.year}#${r.wardSlug}`}>
              <strong>{r.wardName}</strong>
            </a>
            <br />
            <span class="muted">{r.council}</span>
          </td>
          <td>
            {r.marginalCandidate}
            <br />
            <span class="muted"><Party name={r.marginalParty} /></span>
          </td>
          <td class="num">{r.seats}</td>
          <td class="num pct warn">{pct(r.winningPct)}</td>
          <td class="num pct">{pct(r.quota)}</td>
          <td class="num pct warn">{pts(r.underPar)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p>
    See the <a href="/below-quota">full leaderboard of below-quota seats</a>
    across all cycles.
  </p>

  <h2>All councils</h2>
  <p class="muted">
    {num(data.allCouncils.length)} councils with at least one cycle of
    data. Click a name to see every cycle and any changes in the
    leading party.
  </p>
  <ul class="all-councils">
    {#each data.allCouncils as c (c.councilSlug)}
      <li><a href={`/${c.councilSlug}`}>{c.council}</a></li>
    {/each}
  </ul>

  <h2>Council elections by year</h2>
  <ul class="cycle-list">
    {#each data.cycles as c (c.year)}
      <li>
        <a href={`/${c.year}`} class="cycle">
          <span class="cycle-year">{c.year}</span>
          <span class="cycle-date">{c.electionDateLabel}</span>
          <span class="cycle-stats">
            {num(c.councilCount)} councils · {num(c.raceCount)} races ·
            <span class="warn">{pct(c.belowQuotaShare)} below quota</span>
          </span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  .lede {
    font-size: 1.15rem;
  }
  .fn { font-size: 0.7em; }
  .fn a { text-decoration: none; color: var(--muted); }
  .fn a:hover { text-decoration: underline; color: var(--accent); }
  /* Wider main for the worst-seats table; constrain prose blocks for
     readability rather than letting them stretch the full 96ch. */
  h1,
  .lede {
    max-width: 72ch;
  }
  .cycle-list {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.7rem;
    margin: 1rem 0 2rem;
  }
  .cycle {
    display: grid;
    gap: 0.15rem;
    padding: 0.75rem 1rem;
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
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--accent);
  }
  .cycle-date {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .cycle-stats {
    font-size: 0.85rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .warn { color: var(--warn); }

  .all-councils {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0 2rem;
    columns: 16rem 4;
    column-gap: 1.5rem;
    font-size: 0.95rem;
  }
  .all-councils li {
    margin-bottom: 0.25rem;
    break-inside: avoid;
  }

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
  .legend {
    font-size: 0.85rem;
  }
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
  @media (prefers-color-scheme: dark) {
    .party-legend .swatch { border-color: rgba(255, 255, 255, 0.25); }
  }
</style>
