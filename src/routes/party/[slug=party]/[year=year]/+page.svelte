<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import { partyColor, partyDisplayName } from '$lib/party-colors';
  import CouncilHexMap, {
    type CouncilFill
  } from '$lib/components/CouncilHexMap.svelte';

  let { data } = $props();
  const partyHex = $derived(partyColor(data.partyName));
  const summary = $derived(data.summary);
  const showFptpEffect = $derived(
    data.fptpEffect.fptpSeats > 0 || data.fptpEffect.dhondtSeats > 0
  );
  const showCumulativeFptpEffect = $derived(
    data.cumulativeFptpEffect.yearStart < data.year &&
      Math.abs(data.cumulativeFptpEffect.seatDelta) >= 10
  );

  // Gained / lost ring colours. Green for gain, warn for loss — strong
  // enough to read against any party brand colour, including Reform's
  // teal which is closest to a "gain" green.
  const GAINED_RING = '#1c7a3a';
  const LOST_RING = '#b94a2c';

  function signedSeats(v: number): string {
    if (v > 0) return `+${num(v)}`;
    return num(v);
  }

  function benchmarkDirection(v: number): string {
    if (v > 0) return 'unfairly awarded by FPTP';
    if (v < 0) return 'denied by FPTP';
    return 'moved by FPTP';
  }

  const controlFills = $derived.by<Record<string, CouncilFill>>(() => {
    const out: Record<string, CouncilFill> = {};
    // 1) Held / gained: every council the party led as of {year}.
    //    These fill in the party brand colour.
    for (const c of data.controlledCouncils) {
      out[c.councilSlug] = {
        color: partyHex,
        href: `/${c.councilSlug}`,
        primary: c.council,
        secondary: `${num(c.seats)} of ${num(c.totalSeats)} seats (snapshot ${c.year})`,
        title: `${c.council}: ${num(c.seats)} of ${num(c.totalSeats)} seats — largest party as of ${c.year}`
      };
    }
    // 2) Gained at this election: keep the party fill, add a green
    //    ring so the wins stand out against the held set.
    if (data.controls) {
      for (const g of data.controls.councilsGained) {
        out[g.councilSlug] = {
          ...(out[g.councilSlug] ?? {
            color: partyHex,
            href: `/${g.councilSlug}`,
            primary: g.council
          }),
          stroke: GAINED_RING,
          strokeWidth: 2.4,
          secondary: `Gained from ${g.fromParty} (was largest in ${g.yearFrom})`,
          title: `${g.council}: gained from ${g.fromParty}`
        };
      }
      // 3) Lost at this election: drop the party fill (they no longer
      //    lead) and ring in warn red.
      for (const l of data.controls.councilsLost) {
        out[l.councilSlug] = {
          color: '#e5e3d6',
          href: `/${l.councilSlug}`,
          primary: l.council,
          secondary: `Lost to ${l.toParty} (was largest in ${l.yearFrom})`,
          title: `${l.council}: lost to ${l.toParty}`,
          stroke: LOST_RING,
          strokeWidth: 2.4
        };
      }
    }
    return out;
  });
</script>

<svelte:head>
  <title>{data.partyName} in {data.year} — electionresults.uk</title>
  <meta
    name="description"
    content="{data.partyName} performance in the {data.year} UK local elections: seats won, councils gained and lost, where the seats came from and went to."
  />
  <link
    rel="canonical"
    href="https://electionresults.uk/party/{data.partySlug}/{data.year}"
  />
</svelte:head>

<main class="wide">
  <p class="crumbs">
    <a href="/party/{data.partySlug}">{data.partyName}</a> &rsaquo; {data.year}
  </p>
  <h1>
    <span class="swatch" style:background={partyHex} aria-hidden="true"></span>
    {data.partyName} in {data.year}
  </h1>

  {#if data.cycle}
    <p class="muted">
      Polling day: {data.cycle.electionDateLabel}.
      {num(data.cycle.councilCount)} councils held elections.
    </p>
  {/if}

  <h2>Summary</h2>
  <ul class="headline">
    <li>
      Contested in <strong>{num(summary.councilsContested)}</strong> of
      {num(data.cycle?.councilCount ?? summary.councilsContested)} councils;
      ran for <strong>{num(summary.contestedSeats)}</strong> seats.
    </li>
    <li>
      Won <strong>{num(summary.seatsWon)}</strong> seats
      ({pct(summary.seatShare)} of seats up) on
      <strong>{pct(summary.voteShare)}</strong> of the vote.
    </li>
    <li>
      Net change vs each council's last appearance in this dataset:
      <strong>{data.totalNet > 0 ? '+' : ''}{num(data.totalNet)} seats</strong>
      across {num(data.gained.length)} councils up,
      {num(data.lost.length)} councils down,
      {num(data.flat.length)} flat,
      {num(data.debut.length)} new to the window.
    </li>
    {#if data.controls}
      <li>
        Council-control change: <strong>{num(data.controls.councilsGained.length)}</strong>
        gained, <strong>{num(data.controls.councilsLost.length)}</strong> lost.
      </li>
    {/if}
  </ul>

  {#if showFptpEffect}
    <section class="fptp-benchmark" aria-labelledby="fptp-benchmark-title">
      <h3 id="fptp-benchmark-title">Same votes, different counting rule</h3>
      <p class="muted">
        Compare the seats {data.partyName} actually won under FPTP with
        a proportional re-count of the same council-level votes. Positive
        means seats unfairly awarded by FPTP; negative means seats the party
        was denied by FPTP.
      </p>
      <div class="benchmark-cards">
        <div
          class="benchmark-card"
          class:benchmark-card--over={data.fptpEffect.seatDelta > 0}
          class:benchmark-card--under={data.fptpEffect.seatDelta < 0}
        >
          <div class="benchmark-system">This cycle</div>
          <div class="benchmark-where">
            {num(data.fptpEffect.councilCount)} FPTP council results in {data.year}
          </div>
          <div class="benchmark-figure">
            {signedSeats(data.fptpEffect.seatDelta)} <span>seats</span>
          </div>
          <div class="benchmark-detail">
            {benchmarkDirection(data.fptpEffect.seatDelta)}
            ({num(data.fptpEffect.fptpSeats)} actual vs
            {num(data.fptpEffect.dhondtSeats)} benchmark)
          </div>
        </div>
        {#if showCumulativeFptpEffect}
          <div
            class="benchmark-card"
            class:benchmark-card--over={data.cumulativeFptpEffect.seatDelta > 0}
            class:benchmark-card--under={data.cumulativeFptpEffect.seatDelta < 0}
          >
            <div class="benchmark-system">
              {data.cumulativeFptpEffect.yearStart}&ndash;{data.year} window
            </div>
            <div class="benchmark-where">
              {num(data.cumulativeFptpEffect.councilCount)} FPTP council-cycles
            </div>
            <div class="benchmark-figure">
              {signedSeats(data.cumulativeFptpEffect.seatDelta)} <span>seats</span>
            </div>
            <div class="benchmark-detail">
              {benchmarkDirection(data.cumulativeFptpEffect.seatDelta)}
              ({num(data.cumulativeFptpEffect.fptpSeats)} actual vs
              {num(data.cumulativeFptpEffect.dhondtSeats)} benchmark)
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  {#if data.controlledCouncils.length > 0 || (data.controls && (data.controls.councilsGained.length + data.controls.councilsLost.length) > 0)}
    {@const gainedCount = data.controls?.councilsGained.length ?? 0}
    {@const lostCount = data.controls?.councilsLost.length ?? 0}
    <h2>Where {data.partyName} led, as of {data.year}</h2>
    <p class="muted small">
      Councils where {data.partyName} was the largest single party in
      the most recent composition snapshot at or before {data.year}.
      Greens ring councils gained at this election; reds ring those
      lost. Click any hex to drill in.
    </p>
    <div class="map-and-scale">
      <CouncilHexMap
        fills={controlFills}
        title={`UK councils where ${data.partyName} was largest as of ${data.year}`}
      />
      <div class="map-legend">
        <p class="legend-label">As of {data.year}</p>
        <p class="legend-count">
          <span class="swatch" style:background={partyHex}></span>
          <strong>{num(data.controlledCouncils.length)}</strong> councils led
        </p>
        {#if gainedCount > 0}
          <p class="legend-count">
            <span class="swatch ring-gain" style:background={partyHex}></span>
            <strong class="pos">+{num(gainedCount)}</strong> gained this cycle
          </p>
        {/if}
        {#if lostCount > 0}
          <p class="legend-count">
            <span class="swatch ring-lost"></span>
            <strong class="neg">−{num(lostCount)}</strong> lost this cycle
          </p>
        {/if}
        <p class="muted xsmall">
          Grey hexes are councils where another party led, or where we
          don't have a snapshot for that year.
        </p>
      </div>
    </div>
  {/if}

  {#if data.controls && (data.controls.councilsGained.length > 0 || data.controls.councilsLost.length > 0)}
    <h2>Council-control changes</h2>
    <p class="muted">
      Councils where the largest party in the running composition
      changed at this election.
      <a href="/methodology#flips">How a flip is defined &rarr;</a>
    </p>

    {#if data.controls.councilsGained.length > 0}
      <h3>Gained ({data.controls.councilsGained.length})</h3>
      <ul class="flips">
        {#each data.controls.councilsGained as g}
          <li>
            <a href="/{g.councilSlug}">{g.council}</a>
            <span class="muted">
              from <span class="party-pill" style:background={partyColor(g.fromParty)}>
                {partyDisplayName(g.fromParty)}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    {#if data.controls.councilsLost.length > 0}
      <h3>Lost ({data.controls.councilsLost.length})</h3>
      <ul class="flips">
        {#each data.controls.councilsLost as l}
          <li>
            <a href="/{l.councilSlug}">{l.council}</a>
            <span class="muted">
              to <span class="party-pill" style:background={partyColor(l.toParty)}>
                {partyDisplayName(l.toParty)}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <h2>Where the seats came from</h2>
  <p class="muted">
    Per-council net seat change vs each council's prior appearance in
    our dataset (typically that council's previous all-out election or
    its last by-thirds slice). "Debut" rows are councils whose first
    cycle in our window is {data.year} &mdash; usually the result of a
    boundary reorganisation or being a county outside our 2021 LEH
    coverage.
  </p>

  <details open>
    <summary><strong>Seats gained</strong> ({data.gained.length} councils)</summary>
    {#if data.gained.length > 0}
      <table>
        <thead>
          <tr>
            <th>Council</th>
            <th class="r">Won</th>
            <th class="r">Last cycle</th>
            <th class="r">Net</th>
            <th class="r">Vote share</th>
            <th class="r">Seat share</th>
          </tr>
        </thead>
        <tbody>
          {#each data.gained as r}
            <tr>
              <td><a href="/{r.councilSlug}">{r.council}</a></td>
              <td class="r">{num(r.seatsWon)}</td>
              <td class="r">
                {r.prevSeatsWon != null ? `${num(r.prevSeatsWon)} (${r.prevYear})` : '—'}
              </td>
              <td class="r pos">+{num(r.netChange ?? 0)}</td>
              <td class="r">{pct(r.voteShare)}</td>
              <td class="r">{pct(r.seatShare)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No councils where seat count rose vs prior cycle.</p>
    {/if}
  </details>

  <details open>
    <summary><strong>Seats lost</strong> ({data.lost.length} councils)</summary>
    {#if data.lost.length > 0}
      <table>
        <thead>
          <tr>
            <th>Council</th>
            <th class="r">Won</th>
            <th class="r">Last cycle</th>
            <th class="r">Net</th>
            <th class="r">Vote share</th>
            <th class="r">Seat share</th>
          </tr>
        </thead>
        <tbody>
          {#each data.lost as r}
            <tr>
              <td><a href="/{r.councilSlug}">{r.council}</a></td>
              <td class="r">{num(r.seatsWon)}</td>
              <td class="r">
                {r.prevSeatsWon != null ? `${num(r.prevSeatsWon)} (${r.prevYear})` : '—'}
              </td>
              <td class="r neg">{num(r.netChange ?? 0)}</td>
              <td class="r">{pct(r.voteShare)}</td>
              <td class="r">{pct(r.seatShare)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No councils where seat count fell vs prior cycle.</p>
    {/if}
  </details>

  {#if data.debut.length > 0}
    <details>
      <summary><strong>Debut councils</strong> ({data.debut.length})</summary>
      <table>
        <thead>
          <tr>
            <th>Council</th>
            <th class="r">Won</th>
            <th class="r">Vote share</th>
            <th class="r">Seat share</th>
          </tr>
        </thead>
        <tbody>
          {#each data.debut as r}
            <tr>
              <td><a href="/{r.councilSlug}">{r.council}</a></td>
              <td class="r">{num(r.seatsWon)}</td>
              <td class="r">{pct(r.voteShare)}</td>
              <td class="r">{pct(r.seatShare)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {/if}

  {#if data.flat.length > 0}
    <details>
      <summary><strong>No change</strong> ({data.flat.length})</summary>
      <ul class="flat-list">
        {#each data.flat as r}
          <li>
            <a href="/{r.councilSlug}">{r.council}</a>
            <span class="muted">{num(r.seatsWon)} seats (unchanged from {r.prevYear})</span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <p class="muted">
    Net-change comparisons are versus each council's most recent
    appearance in our dataset (2021&ndash;2026). For all-out councils
    that's the previous all-out cycle (typically four years prior); for
    by-thirds councils it's last year's slice. Cross-cycle ward boundary
    changes can produce small artefacts &mdash; see
    <a href="/methodology">methodology</a>.
  </p>
</main>

<style>
  .crumbs {
    margin: 0.4rem 0 -0.6rem;
    font-size: 0.9rem;
    color: var(--muted);
  }
  h1 .swatch {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border-radius: 3px;
    margin-right: 0.4em;
    vertical-align: -0.05em;
  }
  ul.headline {
    list-style: disc;
    padding-left: 1.2rem;
  }
  ul.headline li {
    margin: 0.4em 0;
  }
  .small {
    font-size: 0.85rem;
  }
  .xsmall {
    font-size: 0.75rem;
    margin: 0.2rem 0 0;
  }
  .fptp-benchmark {
    margin: 1rem 0 1.6rem;
  }
  .fptp-benchmark h3 {
    margin-bottom: 0.3rem;
  }
  .benchmark-cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin: 1rem 0 0.6rem;
    max-width: 56rem;
  }
  .benchmark-cards:has(.benchmark-card:only-child) {
    grid-template-columns: minmax(0, 1fr);
    max-width: 29rem;
  }
  .benchmark-card {
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 1rem 1.1rem;
    background: var(--bg);
  }
  .benchmark-card--over {
    border-color: var(--warn);
  }
  .benchmark-card--under {
    border-color: var(--accent);
  }
  .benchmark-system {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .benchmark-where {
    font-size: 0.85rem;
    color: var(--muted);
    margin-top: 0.15rem;
  }
  .benchmark-figure {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1.1;
    margin: 0.3rem 0 0.15rem;
    font-variant-numeric: tabular-nums;
  }
  .benchmark-card--over .benchmark-figure {
    color: var(--warn);
  }
  .benchmark-card--under .benchmark-figure {
    color: var(--accent);
  }
  .benchmark-detail {
    font-size: 0.9rem;
    color: var(--muted);
  }
  @media (max-width: 640px) {
    .benchmark-cards {
      grid-template-columns: 1fr;
    }
  }
  .map-and-scale {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(8rem, 13rem);
    gap: 1.25rem;
    align-items: start;
    margin: 0.5rem 0 1.5rem;
  }
  @media (max-width: 640px) {
    .map-and-scale {
      grid-template-columns: 1fr;
    }
  }
  .map-legend .legend-label {
    margin: 0 0 0.4rem;
    color: var(--muted);
    text-transform: uppercase;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
  }
  .map-legend .legend-count {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .map-legend .legend-count strong {
    font-size: 1.4rem;
    font-variant-numeric: tabular-nums;
  }
  .map-legend .swatch {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    margin-right: 0.4em;
    border-radius: 2px;
    vertical-align: -0.05em;
    border: 1px solid rgba(0, 0, 0, 0.18);
  }
  .map-legend .swatch.ring-gain {
    border: 2px solid #1c7a3a;
  }
  .map-legend .swatch.ring-lost {
    background: #e5e3d6;
    border: 2px solid #b94a2c;
  }
  .map-legend .pos {
    color: #1c7a3a;
  }
  .map-legend .neg {
    color: var(--warn);
  }
  @media (prefers-color-scheme: dark) {
    .map-legend .swatch {
      border-color: rgba(255, 255, 255, 0.25);
    }
  }
  ul.flips,
  ul.flat-list {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0 1.2rem;
  }
  ul.flips li,
  ul.flat-list li {
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .party-pill {
    display: inline-block;
    padding: 0 0.4rem;
    border-radius: 3px;
    color: white;
    font-size: 0.85rem;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
  }
  details {
    margin: 1rem 0;
  }
  details summary {
    cursor: pointer;
    padding: 0.4rem 0;
  }
  th.r,
  td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  td.r.pos {
    color: #1c7a3a;
  }
  td.r.neg {
    color: var(--warn);
  }
</style>
