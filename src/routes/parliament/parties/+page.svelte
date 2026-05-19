<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import PairedBarChart from '$lib/charts/PairedBarChart.svelte';
  import SlopeChart from '$lib/charts/SlopeChart.svelte';
  import ConstituencyHexMap from '$lib/parliament/components/ConstituencyHexMap.svelte';
  import { gallagherDescriptor } from '$lib/parliament/gallagher-descriptor';

  let { data } = $props();

  const latestCycle = $derived(data.cycles[0]);

  // Map legend: visible parties from the latest cycle, sorted by seat
  // count desc so the legend mirrors the visual weight on the map.
  const legend = $derived(
    [...latestCycle.bars]
      .map((b) => {
        const card = data.cards.find((c) => c.partyId === b.partyId);
        return {
          partyId: b.partyId,
          name: b.name,
          color: b.color,
          seats: card?.seats ?? 0
        };
      })
      .filter((row) => row.seats > 0)
      .sort((a, b) => b.seats - a.seats)
      .slice(0, 8)
  );
</script>

<svelte:head>
  <title>Parliamentary Parties — electionresults.uk</title>
  <meta
    name="description"
    content={`Westminster parties at UK general elections — vote share, seat share, and First Past the Post distortion. ${latestCycle.year}: Gallagher index ${latestCycle.gallagher.toFixed(1)} (${gallagherDescriptor(latestCycle.gallagher).toLowerCase()}).`}
  />
  <link rel="canonical" href="https://electionresults.uk/parliament/parties" />
</svelte:head>

<main class="wide">
  <h1>Parliamentary Parties</h1>

  <p>
    Every party that won at least 1% of valid votes at the
    {latestCycle.year} UK general election, paired against the seats
    they actually took. Under First Past the Post the gap is
    routinely large — that's the story.
  </p>

  <div class="kpi-grid" aria-label="{latestCycle.year} general election headline figures">
    <div class="kpi">
      <span class="figure">{num(latestCycle.totalSeats)}</span>
      <span class="label">
        constituencies elected
        ({num(latestCycle.totalVotes)} valid votes)
      </span>
    </div>
    <div class="kpi">
      <span class="figure warn">{num(latestCycle.minorityWinnerCount)}</span>
      <span class="label">
        seats won without majority support
        ({pct(latestCycle.minorityWinnerCount / Math.max(1, latestCycle.totalSeats))} of constituencies)
      </span>
    </div>
    <div class="kpi">
      <span class="figure figure--text warn">{gallagherDescriptor(latestCycle.gallagher)}</span>
      <span class="label">
        <a href="/parliament/methodology#gallagher">Gallagher index</a>
        {latestCycle.gallagher.toFixed(1)}
      </span>
    </div>
  </div>

  <h2 id="who-won-what">Who won what now</h2>
  <p class="muted small">
    Every Westminster constituency from the {latestCycle.year} election,
    coloured by the winning party. Hover any hex for the winning share;
    click to drill into the full candidate record. Northern Ireland is
    included &mdash; Westminster elections use First Past the Post
    across the whole UK.
  </p>

  <div class="map-and-scale">
    <ConstituencyHexMap
      fills={data.constituencyFills}
      year={data.latestYear}
      title={`UK Westminster constituencies — ${data.latestYear} general election, coloured by winning party`}
    />
    <div class="map-legend">
      <p class="legend-label">Winning party</p>
      <ul class="party-legend">
        {#each legend as row (row.partyId)}
          <li>
            <span class="swatch" style:background={row.color}></span>
            <span>{row.name}</span>
            <span class="muted count">{num(row.seats)}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <h2 id="votes-vs-seats">Votes vs seats, by election</h2>
  <p class="muted small">
    For each ingested general election, the bars show every party's
    share of valid votes (filled) against its share of the 650-odd
    seats they actually won (outlined). The signed gap on the right is
    the disproportionality FPTP produced.
  </p>

  <div class="cycle-panels">
    {#each data.cycles as cycle (cycle.year)}
      <section class="cycle-panel" id={`cycle-${cycle.year}`}>
        <header>
          <h3>{cycle.electionDateLabel}</h3>
          <p class="muted small">
            {num(cycle.totalSeats)} seats · {num(cycle.totalVotes)} valid votes ·
            Gallagher {cycle.gallagher.toFixed(1)} ·
            {num(cycle.minorityWinnerCount)} minority winners.
          </p>
        </header>
        {#if cycle.bars.length > 0}
          <PairedBarChart
            bars={cycle.bars.map((b) => ({
              name: b.name,
              color: b.color,
              voteShare: b.voteShare,
              seatShare: b.seatShare,
              href: `/parliament/${cycle.year}`
            }))}
          />
          {#if cycle.hiddenPartyCount > 0}
            <p class="muted small">
              {num(cycle.hiddenPartyCount)} smaller parties (under
              {pct(0.01, 0)} of valid votes) hidden &mdash; the full
              party-by-party totals are in the
              <a href="/parliament/data">CSV downloads</a>.
            </p>
          {/if}
        {:else}
          <p class="muted">No party-level data for this cycle yet.</p>
        {/if}
      </section>
    {/each}
  </div>

  {#if data.slopes.length > 0}
    <h2 id="movement">Cycle-over-cycle movement</h2>
    <p class="muted small">
      Vote share (solid) and seat share (dashed) between adjacent
      ingested general elections. Same country, same voting system,
      four-and-a-bit years apart.
    </p>

    <div class="slope-grid">
      {#each data.slopes as s (s.partyId)}
        <SlopeChart
          title={s.name}
          color={s.color}
          startYear={s.startYear}
          startValue={s.startValue}
          endYear={s.endYear}
          endValue={s.endValue}
          startSeatValue={s.startSeatValue}
          endSeatValue={s.endSeatValue}
          compact
        />
      {/each}
    </div>
  {/if}

  <h2 id="pick-a-party">Pick a party</h2>
  <p class="muted small">
    Every party visible at the {latestCycle.year} general election,
    sorted by vote share. Each card shows the headline distortion in
    that cycle and the four-year vote-share movement where we have a
    prior cycle to compare against.
  </p>

  <div class="cards">
    {#each data.cards as p (p.partyId)}
      <article class="card" style:--accent-color={p.color}>
        <header>
          <span class="swatch" style:background={p.color} aria-hidden="true"></span>
          <h3>{p.name}</h3>
        </header>
        <p class="big">{pct(p.voteShare, 1)}</p>
        <p class="muted small">
          {num(p.seats)} of {num(p.totalSeats)} seats ({pct(p.seatShare, 1)})
        </p>
        <p class="small">
          Seat vs vote gap:
          <strong class:pos={p.seatDelta > 0.005} class:neg={p.seatDelta < -0.005}>
            {pts(p.seatDelta, 0)}
          </strong>
        </p>
        {#if p.voteShareDelta != null && p.priorYear}
          <p class="small">
            Since {p.priorYear}:
            <strong class:pos={p.voteShareDelta > 0.005} class:neg={p.voteShareDelta < -0.005}>
              {pts(p.voteShareDelta, 0)}
            </strong>
            vote share.
          </p>
        {:else}
          <p class="small muted">
            No prior ingested cycle to compare against.
          </p>
        {/if}
      </article>
    {/each}
  </div>

  <p class="muted small">
    Definitions and caveats live in the
    <a href="/parliament/methodology">methodology</a> page. Source data
    for the {data.latestYear} cycle:
    <a href={data.latestManifest.sourceUrl} rel="external noopener"
      >{data.latestManifest.sourceName}</a>, retrieved
    {data.latestManifest.retrievalDate} ({data.latestManifest.licence}).
  </p>
</main>

<style>
  h2 {
    margin-top: 2rem;
  }
  .small {
    font-size: 0.85rem;
  }
  .map-and-scale {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(10rem, 14rem);
    gap: 1.25rem;
    align-items: start;
    margin: 0.6rem 0 1.5rem;
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
  .party-legend {
    list-style: none;
    padding: 0;
    margin: 0.4rem 0 0;
    display: grid;
    gap: 0.3rem;
    font-size: 0.88rem;
  }
  .party-legend li {
    display: grid;
    grid-template-columns: 1.1rem 1fr auto;
    align-items: baseline;
    gap: 0.4rem;
  }
  .party-legend .swatch {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.18);
  }
  .party-legend .count {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  @media (prefers-color-scheme: dark) {
    .party-legend .swatch {
      border-color: rgba(255, 255, 255, 0.25);
    }
  }
  .cycle-panels {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.2rem;
    margin: 0.8rem 0 1.2rem;
  }
  @media (min-width: 980px) {
    .cycle-panels {
      grid-template-columns: repeat(auto-fit, minmax(28rem, 1fr));
    }
  }
  .cycle-panel {
    border: 1px solid var(--rule);
    border-radius: 5px;
    padding: 0.8rem 1rem 1rem;
    background: var(--bg);
  }
  .cycle-panel header {
    margin: 0 0 0.6rem;
  }
  .cycle-panel h3 {
    margin: 0 0 0.15rem;
    font-size: 1.05rem;
  }
  .cycle-panel header p {
    margin: 0;
  }
  .slope-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.6rem;
    margin: 0.8rem 0 1.2rem;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.8rem;
    margin: 0.8rem 0 1.5rem;
  }
  .card {
    display: block;
    padding: 0.8rem 1rem;
    border: 1px solid var(--rule);
    border-left: 4px solid var(--accent-color, var(--accent));
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
  }
  .card header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: -0.2rem 0 0.3rem;
  }
  .card h3 {
    margin: 0;
    font-size: 1rem;
    font-family: inherit;
    flex: 1;
  }
  .card .swatch {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border-radius: 2px;
  }
  .card .big {
    font-size: 1.6rem;
    font-weight: 600;
    margin: 0.2rem 0;
    font-variant-numeric: tabular-nums;
  }
  .card .small {
    font-size: 0.82rem;
    margin: 0.2rem 0;
  }
  .pos {
    color: #1c7a3a;
  }
  .neg {
    color: var(--warn);
  }
</style>
