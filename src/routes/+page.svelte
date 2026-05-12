<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import MapBelowQuota from '$lib/components/MapBelowQuota.svelte';
  import MapDistortion from '$lib/components/MapDistortion.svelte';
  import MapFlips from '$lib/components/MapFlips.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  let { data } = $props();
  // One filter drives every section on the page (lede totals + example,
  // all four maps, all four tables). Default to the just-finished
  // cycle so the post-election audit leads; "all cycles" toggles to
  // the historical leaderboards across 2021-2026.
  let filter = $state<'2026' | 'all'>('2026');
  const view = $derived(data.views[filter]);
  const isCycle = $derived(filter !== 'all');
</script>

<svelte:head>
  <title>electionresults.uk — auditing UK council seats won when most voters chose someone else</title>
  <meta
    name="description"
    content="A volunteer audit of UK local-election results across six cycles (2021–2026). For every ward, we ask: did the winner clear the share of votes a fair, proportional system would require?"
  />
  <link rel="canonical" href="https://electionresults.uk/" />
  <meta property="og:image" content="https://electionresults.uk/og/flip-map.png" />
  <meta property="og:image:width" content="1016" />
  <meta property="og:image:height" content="841" />
  <meta
    property="og:image:alt"
    content="Hex cartogram of UK councils, coloured by the party that took the lead in the most recent flip between consecutive election cycles."
  />
  <meta name="twitter:image" content="https://electionresults.uk/og/flip-map.png" />
</svelte:head>

<div class="banner">
  Preliminary 2026-05-07 results from
  <a href="https://democracyclub.org.uk" rel="external noopener">Democracy Club</a>,
  reused under
  <a href="https://creativecommons.org/licenses/by/4.0/" rel="external noopener">CC&nbsp;BY&nbsp;4.0</a>.
  Wards still being counted are excluded until the full count is in;
  the 2026 Local Election Handbook becomes the canonical source once
  it ships.
</div>

<main class="wide">
  <h1>How many UK councillors won when most voters chose someone else?</h1>

  <div class="filter-bar filter-bar--top" role="group" aria-label="Cycle filter">
    <span class="filter-label">Showing:</span>
    <button
      type="button"
      class:active={filter === '2026'}
      aria-pressed={filter === '2026'}
      onclick={() => (filter = '2026')}
    >2026 cycle only</button>
    <button
      type="button"
      class:active={filter === 'all'}
      aria-pressed={filter === 'all'}
      onclick={() => (filter = 'all')}
    >All cycles (2021&ndash;2026)</button>
  </div>

  {#if view.lowestWinner}
    {@const lw = view.lowestWinner}
    <p class="lede">
      {#if isCycle}
        The most extreme case in the 2026 cycle so far: a councillor elected on
      {:else}
        The most extreme case in our data: a councillor elected on
      {/if}
      <strong>{pct(lw.winningPct)}</strong> of the vote in
      <a href={`/${lw.councilSlug}/${lw.year}#${lw.wardSlug}`}
        ><strong>{lw.wardName}</strong></a
      >
      ({lw.council}, {lw.year}) &mdash; meaning
      <strong>{pct(1 - lw.winningPct)}</strong>
      of people who voted in that ward chose someone else, and they
      still won the seat. Under First-Past-the-Post and bloc vote,
      that's allowed: a candidate wins by being top of the poll,
      regardless of share, with no minimum threshold. We compare every
      elected councillor's share of votes to the share they would need
      under a system where seats match votes.<sup class="fn"
        ><a
          href="/methodology#quota"
          title="See the methodology page for the formula and worked examples"
        >(1)</a></sup
      >
      {#if isCycle}
        The 2026-05-07 cycle covered
      {:else}
        Across six cycles of UK local elections &mdash; covering county
        councils, unitary authorities, metropolitan boroughs, district
        councils and London boroughs &mdash; that's
      {/if}
      <strong>{num(view.totals.councils)}</strong>
      {isCycle ? 'councils' : 'council-cycles'},
      <strong>{num(view.totals.races)}</strong> ward races and
      <strong>{num(view.totals.seats)}</strong> seats. Of those,
      <strong>{num(view.totals.belowQuotaSeats)}</strong>
      ({pct(view.totals.belowQuotaSeats / Math.max(1, view.totals.seats))})
      fell short of that fair share.
    </p>
  {/if}

  <h2>Year-over-year flips</h2>
  <p class="muted">
    Each council where the leading party changed between consecutive cycles,
    coloured by the party that took the lead. Councils that haven't
    flipped (or that we only have one cycle for) stay grey. Hover for
    the cycle and the party transition; click to see the council's full
    history.
  </p>
  <MapFlips entries={view.flipMapEntries} incompleteCouncils={view.incompleteCouncils} />

  <h3>
    {#if isCycle}
      Biggest council-control changes &mdash; 2026 cycle
    {:else}
      Ten biggest council-control changes &mdash; all cycles
    {/if}
  </h3>
  <p class="muted">
    Ranked by composition shift &mdash; the incoming party's gain in
    seat share of the full council. A big shift on a small vote swing
    is the FPTP signature: a few percentage points of vote movement
    can land enough seats to swap which party leads the council. A
    flip = the largest party in the council's running composition
    actually changed between cycles (per
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>'s
    annual snapshot; 2026 compositions are
    <a href="/methodology#sources">synthesised</a>
    from the 2025 snapshot plus the 2026 election results until oncd
    publishes its 2026 row). See <a href="/flips">/flips</a> for the full list.
  </p>
  {#if view.topFlipsByShift.length === 0}
    <p class="muted">
      No council-control changes in this view yet. Wards are still
      being counted; this list will grow as more results arrive.
    </p>
  {:else}
    <table aria-label="Council-control changes by composition shift">
      <thead>
        <tr>
          <th>Cycle</th>
          <th>Council</th>
          <th>Largest party changed</th>
          <th class="num">
            <Tooltip
              icon
              body="Incoming party's seat share of the full council in the year-after minus the year-before — composition truth-set, not per-cycle."
            >
              Composition shift (incoming)
            </Tooltip>
          </th>
        </tr>
      </thead>
      <tbody>
        {#each view.topFlipsByShift as f (f.councilSlug + ':' + f.yearFrom + ':' + f.yearTo)}
          <tr>
            <td class="num">{f.yearFrom} → {f.yearTo}</td>
            <td><a href={`/${f.councilSlug}`}><strong>{f.council}</strong></a></td>
            <td>
              <Party name={f.fromParty} />
              <span class="muted" aria-hidden="true"> → </span>
              <Party name={f.toParty} />
            </td>
            <td class="num pct warn">{pts(f.newPartySeatTo - f.newPartySeatFrom)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <h2>
    {#if isCycle}
      Unfairly awarded seats &mdash; 2026 cycle
    {:else}
      Unfairly awarded seats, latest cycle
    {/if}
  </h2>
  <p class="muted">
    Same vote totals, different counting rule. Wakefield is the
    cleanest 2026 example: Reform UK won
    <strong>44%</strong> of the vote and took
    <strong>58 of the 63 seats</strong> (92%); under D'Hondt those
    same votes would give them
    <strong>30 seats</strong> (47%) &mdash; closer to their vote share.
    Each hex below shades a council by how many of its seats were
    unfairly awarded &mdash; that is, went to a different party than a
    proportional re-count of the same votes would have. Darker =
    bigger gap.
    See <a href="/distortion">/distortion</a> for the full leaderboard
    and <a href="/methodology#distortion">methodology</a> for the
    bloc-vote caveat in multi-member wards.
  </p>
  <MapDistortion entries={view.distortionMapEntries} incompleteCouncils={view.incompleteCouncils} />

  <h3>
    {#if isCycle}
      Ten 2026 elections with the most unfairly awarded seats
    {:else}
      Ten elections with the most unfairly awarded seats
    {/if}
  </h3>

  <table aria-label="Elections with the most unfairly awarded seats">
    <thead>
      <tr>
        <th>Year</th>
        <th>Council</th>
        <th class="num">Seats</th>
        <th class="num">
          <Tooltip
            icon
            body="Number of seats that went to a different party than a proportional re-count of the same votes would have produced."
          >
            Unfairly awarded
          </Tooltip>
        </th>
        <th class="num">% of seats</th>
        <th>Most over-represented</th>
      </tr>
    </thead>
    <tbody>
      {#each view.topDistortedCycles as r (r.councilSlug + ':' + r.year)}
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

  <h3 id="stv-contrast">Same metric, different system: Scotland uses STV</h3>
  <p class="muted">
    Scotland's councils have used <strong>Single Transferable Vote</strong>
    since 2007. The same "unfairly awarded" measure &mdash; share of
    seats that would land with a different party under a proportional
    re-count of the same votes &mdash; gives a very different number
    when the counting rule already <em>is</em> proportional.
  </p>
  <div class="contrast-cards">
    <div class="contrast-card contrast-card--bad">
      <div class="contrast-system">FPTP</div>
      <div class="contrast-where">{data.fptpComparison.councilCount} English &amp; Welsh councils — most recent cycle</div>
      <div class="contrast-figure">{pct(data.fptpComparison.avgShare)}</div>
      <div class="contrast-detail">
        of seats unfairly awarded
        ({num(data.fptpComparison.reallocated)} of {num(data.fptpComparison.totalSeats)})
      </div>
    </div>
    <div class="contrast-card contrast-card--good">
      <div class="contrast-system">STV</div>
      <div class="contrast-where">{data.stv.councilCount} Scottish councils — 2022 cycle</div>
      <div class="contrast-figure">{pct(data.stv.avgShare)}</div>
      <div class="contrast-detail">
        of seats unfairly awarded
        ({num(data.stv.reallocated)} of {num(data.stv.totalSeats)})
      </div>
    </div>
  </div>
  <p class="muted small">
    Wales's 2022 council elections were also run under FPTP; the
    Local Government and Elections (Wales) Act 2021 lets councils opt
    in to STV from the 2027 cycle, but no Welsh council has yet held
    an STV election. Raw Scottish 2022 data (per-candidate first
    preferences plus round-by-round transfers) is mirrored at
    <a href="/data/stv/scotland-2022.csv"><code>/data/stv/scotland-2022.csv</code></a>
    for sister-site reuse, sourced from
    <a href="https://election.indylive.radio/download/" rel="external noopener">indylive radio</a>
    under
    <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="external noopener">CC&nbsp;BY-SA&nbsp;4.0</a>.
    4 island/uncontested councils
    (Orkney, Shetland, Western Isles, North Ayrshire) are excluded
    from the average because the source CSV ships their first-pref
    counts blank — many wards in those councils were uncontested.
  </p>
  <details class="stv-detail">
    <summary class="muted small">See the cleanest and worst-distorted Scottish councils &darr;</summary>
    <div class="stv-detail-grid">
      <div>
        <h4>Cleanest (closest to proportional)</h4>
        <ol>
          {#each data.stv.best as r (r.councilSlug)}
            <li>{r.council} &mdash; <strong>{pct(r.reallocatedShare)}</strong>
              <span class="muted">({r.reallocated} of {r.totalSeats})</span></li>
          {/each}
        </ol>
      </div>
      <div>
        <h4>Most distorted (still under any FPTP council)</h4>
        <ol>
          {#each data.stv.worst as r (r.councilSlug)}
            <li>{r.council} &mdash; <strong>{pct(r.reallocatedShare)}</strong>
              <span class="muted">({r.reallocated} of {r.totalSeats})</span></li>
          {/each}
        </ol>
      </div>
    </div>
  </details>

  <h2>Distorted elections</h2>
  <p class="muted">
    Councils where seats went to candidates with less support than
    a proportional system would require. The map shades every UK council
    by how many of its seats fell below that bar in
    {isCycle ? 'the 2026 cycle' : 'its most recent cycle'}
    (darker = more seats below). The table lists the ten seats
    won on the smallest share of the vote
    {isCycle ? 'in 2026' : 'anywhere in the data'}.
  </p>
  <MapBelowQuota councils={view.latestByCouncil} incompleteCouncils={view.incompleteCouncils} />

  <h3>
    {#if isCycle}
      Ten 2026 seats won on the smallest share of the vote
    {:else}
      Ten seats won on the smallest share of the vote
    {/if}
  </h3>
  <p class="muted">
    The seats furthest below the proportional quota
    {isCycle ? 'in the 2026 cycle' : 'anywhere in the data'}
    &mdash; councillors elected on the smallest share of votes in their
    ward. Click a ward to see the full race.
  </p>

  <table aria-label="Seats won on the smallest share of the vote">
    <thead>
      <tr>
        <th>Year</th>
        <th>Ward / Council</th>
        <th>Seat-holder (party, per public record)</th>
        <th class="num">Seats</th>
        <th class="num">Won at</th>
        <th class="num">Quota</th>
        <th class="num">
          <Tooltip
            icon
            body="Marginal winner's share minus the proportional quota for this race. Negative = below; positive = above."
          >
            Below quota
          </Tooltip>
        </th>
      </tr>
    </thead>
    <tbody>
      {#each view.topLowestShares as r (r.year + r.councilSlug + r.wardSlug)}
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

  .filter-bar {
    display: inline-flex;
    align-items: center;
    gap: 0;
    margin: 0.4rem 0 0.6rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    overflow: hidden;
  }
  .filter-bar button {
    appearance: none;
    background: transparent;
    border: none;
    border-right: 1px solid var(--rule);
    padding: 0.35rem 0.85rem;
    font: inherit;
    font-size: 0.9rem;
    color: var(--muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .filter-bar button:last-child { border-right: none; }
  .filter-bar button:hover { background: rgba(11, 61, 46, 0.04); color: inherit; }
  .filter-bar button.active {
    background: var(--accent);
    color: #fff;
  }
  /* Top-level filter is more prominent: includes a label, sits above
     the lede, and uses slightly larger hit targets. */
  .filter-bar--top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0.5rem 0 1.25rem;
    border: none;
    background: rgba(11, 61, 46, 0.06);
    padding: 0.3rem 0.4rem;
    border-radius: 8px;
    gap: 0.25rem;
  }
  .filter-bar--top .filter-label {
    font-size: 0.85rem;
    color: var(--muted);
    padding: 0 0.5rem 0 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .filter-bar--top button {
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0.4rem 0.95rem;
    font-size: 0.95rem;
    color: inherit;
  }
  .filter-bar--top button.active {
    background: var(--accent);
    color: #fff;
  }
  .filter-bar--top button:not(.active):hover {
    background: rgba(11, 61, 46, 0.1);
  }

  .contrast-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin: 1rem 0 0.6rem;
    max-width: 56rem;
  }
  @media (max-width: 640px) {
    .contrast-cards { grid-template-columns: 1fr; }
  }
  .contrast-card {
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 1rem 1.1rem;
    background: var(--bg);
  }
  .contrast-card--bad { border-color: var(--warn); }
  .contrast-card--good { border-color: var(--accent); }
  .contrast-system {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .contrast-where {
    font-size: 0.85rem;
    color: var(--muted);
    margin-top: 0.15rem;
  }
  .contrast-figure {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 2.4rem;
    font-weight: 700;
    margin: 0.3rem 0 0.15rem;
    font-variant-numeric: tabular-nums;
  }
  .contrast-card--bad .contrast-figure { color: var(--warn); }
  .contrast-card--good .contrast-figure { color: var(--accent); }
  .contrast-detail {
    font-size: 0.9rem;
    color: var(--muted);
  }
  .stv-detail { margin: 0.5rem 0 1.5rem; }
  .stv-detail summary { cursor: pointer; }
  .stv-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-top: 0.7rem;
    max-width: 56rem;
  }
  @media (max-width: 640px) {
    .stv-detail-grid { grid-template-columns: 1fr; }
  }
  .stv-detail-grid h4 {
    font-size: 0.95rem;
    margin: 0 0 0.3rem;
  }
  .stv-detail-grid ol {
    margin: 0;
    padding-left: 1.4rem;
    font-size: 0.92rem;
    line-height: 1.55;
  }

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

  .small { font-size: 0.78rem; }
</style>
