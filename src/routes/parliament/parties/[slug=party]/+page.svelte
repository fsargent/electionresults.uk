<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import PairedBarChart, { type PairedBar } from '$lib/charts/PairedBarChart.svelte';
  import SlopeChart from '$lib/charts/SlopeChart.svelte';
  import ConstituencyHexMap from '$lib/parliament/components/ConstituencyHexMap.svelte';

  let { data } = $props();

  const latestCycle = $derived(data.cycles[data.cycles.length - 1]);
  const firstCycle = $derived(data.cycles[0]);
  const hasMovement = $derived(data.cycles.length >= 2);
  const voteMovement = $derived(
    hasMovement ? latestCycle.voteShare - firstCycle.voteShare : 0
  );
  const seatMovement = $derived(
    hasMovement ? latestCycle.seatShare - firstCycle.seatShare : 0
  );

  // Tiny ordinal helper for the cycle-rank label ("1st", "2nd",
  // "3rd by seats"). UK English only — no locale wrangling needed.
  function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  // One paired bar per cycle, most recent first. Mirrors the cycles
  // panel on /councils/party/[slug].
  const cycleBars = $derived<PairedBar[]>(
    [...data.cycles]
      .sort((a, b) => b.year - a.year)
      .map((c) => ({
        name: String(c.year),
        color: data.partyColor,
        voteShare: c.voteShare,
        seatShare: c.seatShare,
        href: `/parliament/${c.year}`
      }))
  );
</script>

<svelte:head>
  <title>{data.partyName} at Westminster — electionresults.uk</title>
  <meta
    name="description"
    content={`Vote share, seat share, and constituency footprint for ${data.partyName} across ${data.cycles.length} UK general elections (${firstCycle.year}–${latestCycle.year}). Latest cycle: ${pct(latestCycle.voteShare, 1)} of valid votes, ${num(latestCycle.seats)} of ${num(latestCycle.totalSeats)} seats.`}
  />
  <link rel="canonical" href="https://electionresults.uk/parliament/parties/{data.partySlug}" />
</svelte:head>

<main class="wide">
  <h1>
    <span class="swatch" style:background={data.partyColor} aria-hidden="true"></span>
    {data.partyName} at Westminster
  </h1>

  <p>
    {data.partyName} across {data.cycles.length} UK general
    {data.cycles.length === 1 ? 'election' : 'elections'} in our
    dataset ({firstCycle.year}&ndash;{latestCycle.year}). For the
    cross-party view, see <a href="/parliament/parties">all parliamentary parties</a>.
  </p>

  <div class="kpi-grid" aria-label="{latestCycle.year} headline figures for {data.partyName}">
    <div class="kpi">
      <span class="figure">{pct(latestCycle.voteShare, 1)}</span>
      <span class="label">
        of valid votes in {latestCycle.year}
        ({num(latestCycle.votes)} of {num(latestCycle.totalVotes)})
      </span>
    </div>
    <div class="kpi">
      <span class="figure">{num(latestCycle.seats)}</span>
      <span class="label">
        of {num(latestCycle.totalSeats)} seats
        ({pct(latestCycle.seatShare, 1)})
      </span>
    </div>
    <div class="kpi">
      <span
        class="figure"
        class:warn={latestCycle.seatDelta > 0.01}
        class:pos={latestCycle.seatDelta < -0.01}
      >
        {pts(latestCycle.seatDelta, 1)}
      </span>
      <span class="label">
        seats vs votes &mdash;
        {latestCycle.seatDelta > 0.01
          ? 'over-represented'
          : latestCycle.seatDelta < -0.01
            ? 'under-represented'
            : 'roughly proportional'}
        under First Past the Post
      </span>
    </div>
  </div>

  {#if hasMovement}
    <h2>Headline</h2>
    <ul class="headline">
      <li>
        Vote share moved from <strong>{pct(firstCycle.voteShare, 1)}</strong>
        ({firstCycle.year}) to <strong>{pct(latestCycle.voteShare, 1)}</strong>
        ({latestCycle.year}) &mdash; a
        <strong>{pts(voteMovement, 1)}</strong> shift across
        {data.cycles.length} contested cycles.
      </li>
      <li>
        Seat share moved from <strong>{pct(firstCycle.seatShare, 1)}</strong>
        to <strong>{pct(latestCycle.seatShare, 1)}</strong> over the same
        window (<strong>{pts(seatMovement, 1)}</strong>).
      </li>
      <li>
        {data.partyName} sits {ordinal(latestCycle.seatRank + 1)} by
        seats in the {latestCycle.year} House &mdash;
        {num(latestCycle.seats)} of {num(latestCycle.totalSeats)} MPs.
      </li>
    </ul>
  {/if}

  {#if data.cycles.length >= 2}
    <h2 id="trend">Vote share &amp; seat share over time</h2>
    <p class="muted small">
      Solid line is vote share, dashed line is seat share. Markers sit
      proportionally along the x-axis so the gap between cycles reflects
      the actual years between elections. Hover any marker for the year
      and share at that cycle.
    </p>
    <div class="trend-wrap">
      <SlopeChart
        title={data.partyName}
        color={data.partyColor}
        points={data.trend}
      />
    </div>
  {/if}

  <h2 id="cycles">Cycles</h2>
  <p class="muted small">
    Each card opens the full {data.partyName} cycle audit on the
    parliament page for that year.
  </p>
  <div class="cycle-cards">
    {#each [...data.cycles].sort((a, b) => b.year - a.year) as c (c.year)}
      <a
        class="cycle-card"
        href="/parliament/{c.year}"
        style:--accent-color={data.partyColor}
      >
        <h3>{c.year}</h3>
        <p class="stat">
          <strong>{num(c.seats)}</strong>
          <span class="muted">of {num(c.totalSeats)} seats</span>
        </p>
        <p class="stat">
          <strong>{pct(c.voteShare, 0)}</strong>
          <span class="arrow">→</span>
          <strong>{pct(c.seatShare, 0)}</strong>
          <span
            class="gap"
            class:over={c.seatDelta > 0.005}
            class:under={c.seatDelta < -0.005}
          >
            {pts(c.seatDelta, 0)}
          </span>
        </p>
        <p class="muted xsmall">
          {num(c.votes)} valid votes &mdash; {ordinal(c.seatRank + 1)} by seats
        </p>
      </a>
    {/each}
  </div>

  <h2 id="bars">Votes vs seats, by cycle</h2>
  <p class="muted small">
    For each cycle this party contested, the bar pair shows
    {data.partyName}&rsquo;s vote share (filled) against the share of
    Commons seats they actually took (outlined). The signed gap on the
    right is the FPTP distortion in that cycle.
  </p>
  <PairedBarChart bars={cycleBars} />

  <h2 id="constituencies">
    Where {data.partyName} won in {data.latestYear}
  </h2>
  <p class="muted small">
    Westminster constituencies under {data.latestYear} boundaries
    where {data.partyName} took the seat. Grey hexes are constituencies
    held by another party. Hover any hex for the winning share; click
    to drill into the full candidate record.
  </p>

  {#if data.latestWins.length > 0}
    <ConstituencyHexMap
      fills={data.constituencyFills}
      year={data.latestYear}
      title={`UK Westminster constituencies — ${data.latestYear} general election, ${data.partyName} wins`}
    />
    <p class="muted small">
      <strong>{num(data.latestWins.length)}</strong>
      {data.latestWins.length === 1 ? 'constituency' : 'constituencies'}
      won out of {num(latestCycle.totalSeats)}.
    </p>
  {:else}
    <p class="muted">
      {data.partyName} did not win any constituencies in
      {data.latestYear}.
    </p>
  {/if}

  <h2 id="by-election">By election</h2>
  <table>
    <thead>
      <tr>
        <th>Year</th>
        <th class="r">Vote share</th>
        <th class="r">Seats</th>
        <th class="r">Seat share</th>
        <th class="r">Gap</th>
        <th class="r">Seat rank</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each [...data.cycles].sort((a, b) => b.year - a.year) as row (row.year)}
        <tr>
          <td>{row.year}</td>
          <td class="r">{pct(row.voteShare, 1)}</td>
          <td class="r">{num(row.seats)} / {num(row.totalSeats)}</td>
          <td class="r">{pct(row.seatShare, 1)}</td>
          <td
            class="r"
            class:gap-over={row.seatDelta > 0.005}
            class:gap-under={row.seatDelta < -0.005}
          >
            {pts(row.seatDelta, 1)}
          </td>
          <td class="r">{ordinal(row.seatRank + 1)}</td>
          <td>
            <a href="/parliament/{row.year}">Details &rarr;</a>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p class="muted small">
    See <a href="/parliament/methodology">methodology</a> for how we
    normalise party names and compute vote share and the Gallagher
    index. Source data for the {data.latestYear} cycle:
    <a href={data.latestManifest.sourceUrl} rel="external noopener"
      >{data.latestManifest.sourceName}</a>, retrieved
    {data.latestManifest.retrievalDate} ({data.latestManifest.licence}).
  </p>
</main>

<style>
  h1 .swatch {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border-radius: 3px;
    margin-right: 0.4em;
    vertical-align: -0.05em;
  }
  h2 {
    margin-top: 2rem;
  }
  .small {
    font-size: 0.85rem;
  }
  .xsmall {
    font-size: 0.75rem;
    margin: 0.2rem 0 0;
  }
  ul.headline {
    list-style: disc;
    padding-left: 1.2rem;
    max-width: 60ch;
  }
  ul.headline li {
    margin: 0.4em 0;
  }
  .figure.pos {
    color: #1c7a3a;
  }
  .trend-wrap {
    max-width: 36rem;
    margin: 0.8rem 0 1.2rem;
  }
  .cycle-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.6rem;
    margin: 0.6rem 0 1.5rem;
  }
  .cycle-card {
    display: block;
    padding: 0.7rem 0.9rem 0.6rem;
    border: 1px solid var(--rule);
    border-left: 4px solid var(--accent-color, var(--accent));
    border-radius: 4px;
    background: var(--bg);
    color: var(--fg);
    text-decoration: none;
  }
  .cycle-card:hover {
    border-color: var(--accent-color, var(--accent));
    text-decoration: none;
  }
  .cycle-card h3 {
    margin: 0 0 0.2rem;
    font-size: 1.4rem;
    color: var(--accent-color, var(--accent));
  }
  .cycle-card .stat {
    margin: 0.15rem 0;
    font-size: 0.88rem;
    font-variant-numeric: tabular-nums;
  }
  .cycle-card .stat .arrow {
    color: var(--muted);
    margin: 0 0.2rem;
  }
  .cycle-card .stat .gap {
    margin-left: 0.4rem;
    font-weight: 600;
  }
  .cycle-card .stat .gap.over {
    color: var(--warn);
  }
  .cycle-card .stat .gap.under {
    color: #1c7a3a;
  }
  th.r,
  td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  td.gap-over {
    color: var(--warn);
    font-weight: 600;
  }
  td.gap-under {
    color: #1c7a3a;
    font-weight: 600;
  }
</style>
