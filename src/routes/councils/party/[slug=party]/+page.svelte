<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import PairedBarChart from '$lib/charts/PairedBarChart.svelte';
  import SlopeChart from '$lib/charts/SlopeChart.svelte';
  import CouncilHexMap, {
    type CouncilFill
  } from '$lib/components/CouncilHexMap.svelte';
  import type { PartyYearStats } from '$lib/types';

  let { data } = $props();
  const trend = $derived(data.trend as PartyYearStats[]);
  const partyHex = $derived(partyColor(data.partyName));
  const showFptpEffect = $derived(
    data.cumulativeFptpEffect.fptpSeats > 0 ||
      data.cumulativeFptpEffect.dhondtSeats > 0
  );
  const showLatestFptpEffect = $derived(
    data.latestFptpEffect &&
      (data.latestFptpEffect.fptpSeats > 0 ||
        data.latestFptpEffect.dhondtSeats > 0) &&
      data.latestFptpEffect.yearEnd !== data.cumulativeFptpEffect.yearStart
  );

  function signedSeats(v: number): string {
    if (v > 0) return `+${num(v)}`;
    return num(v);
  }

  function benchmarkDirection(v: number): string {
    if (v > 0) return 'unfairly awarded by FPTP';
    if (v < 0) return 'denied by FPTP';
    return 'moved by FPTP';
  }

  // Hex-map fills: one entry per council where this party is the
  // currently-largest party. Other councils fall through to the
  // CouncilHexMap default neutral fill.
  const controlFills = $derived.by<Record<string, CouncilFill>>(() => {
    const out: Record<string, CouncilFill> = {};
    for (const c of data.controlledCouncils) {
      out[c.councilSlug] = {
        color: partyHex,
        href: `/councils/${c.councilSlug}`,
        primary: c.council,
        secondary: `${num(c.seats)} of ${num(c.totalSeats)} seats (${c.year})`,
        title: `${c.council}: ${num(c.seats)} of ${num(c.totalSeats)} seats — largest party (${c.year})`
      };
    }
    return out;
  });

  // Section A: one bar pair per cycle this party contested. Rows are
  // cycles (most recent first); each row pairs vote share vs seat
  // share. The accumulating gap across the rows is the disproportion
  // story scoped to one party.
  const cycleBars = $derived(
    trend
      .filter((r) => r.contestedSeats > 0)
      .sort((a, b) => b.year - a.year)
      .map((r) => ({
        name: String(r.year),
        color: partyHex,
        voteShare: r.voteShare,
        seatShare: r.seatShare,
        href: `/councils/party/${data.partySlug}/${r.year}`
      }))
  );

  // Section B: slope per cycle-pair, most recent first. Pair years
  // four apart (same family) so the comparison is real. Skip a slope
  // when either end is missing.
  type Slope = {
    label: string;
    startYear: number;
    startValue: number;
    endYear: number;
    endValue: number;
  };
  const cycleSlopes = $derived.by<Slope[]>(() => {
    const elections = trend
      .filter((r) => r.contestedSeats > 0)
      .sort((a, b) => b.year - a.year);
    const out: Slope[] = [];
    const used = new Set<number>();
    for (const end of elections) {
      if (used.has(end.year)) continue;
      const start = elections.find((s) => s.year === end.year - 4);
      if (!start) continue;
      out.push({
        label: `${start.year} → ${end.year} cycle`,
        startYear: start.year,
        startValue: start.voteShare,
        endYear: end.year,
        endValue: end.voteShare
      });
      used.add(end.year);
      used.add(start.year);
    }
    return out;
  });

  // Section C: cumulative footprint line — share of all UK council
  // seats held, full window. Composition rolls forward year-on-year
  // so this metric IS comparable across all years.
  const chamberPoints = $derived(
    trend
      .filter((r) => r.chamberTotal > 0)
      .sort((a, b) => a.year - b.year)
  );

  const W = 720;
  const H = 240;
  const PAD = { l: 44, r: 16, t: 14, b: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const chamberMinYear = $derived(
    chamberPoints.length > 0 ? chamberPoints[0].year : 0
  );
  const chamberMaxYear = $derived(
    chamberPoints.length > 0 ? chamberPoints[chamberPoints.length - 1].year : 0
  );
  const chamberYearSpan = $derived(
    Math.max(1, chamberMaxYear - chamberMinYear)
  );
  const chamberYearTicks = $derived(
    chamberPoints.length > 0
      ? Array.from(
          { length: chamberYearSpan + 1 },
          (_, i) => chamberMinYear + i
        )
      : []
  );
  function xForChamber(year: number): number {
    return PAD.l + ((year - chamberMinYear) / chamberYearSpan) * innerW;
  }
  function yFor(share: number): number {
    return PAD.t + (1 - share) * innerH;
  }
  function yShareTicks(): { v: number; y: number }[] {
    return [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((v) => ({ v, y: yFor(v) }));
  }

  type Tooltip = {
    cx: number;
    cy: number;
    primary: string;
    secondary: string;
    tertiary?: string;
    color: string;
  };
  let chamberTip = $state<Tooltip | null>(null);
  const TIP_W = 250;
  const TIP_H = 60;
  const TIP_GAP = 12;

  function tipPosition(t: Tooltip): { x: number; y: number; below: boolean } {
    const wantAboveY = t.cy - TIP_GAP - TIP_H;
    const below = wantAboveY < PAD.t;
    const y = below ? t.cy + TIP_GAP : wantAboveY;
    const wantX = t.cx - TIP_W / 2;
    const minX = PAD.l;
    const maxX = W - PAD.r - TIP_W;
    const x = Math.max(minX, Math.min(maxX, wantX));
    return { x, y, below };
  }

  function showChamber(r: PartyYearStats) {
    chamberTip = {
      cx: xForChamber(r.year),
      cy: yFor(r.chamberShare),
      primary: `${r.year} · ${pct(r.chamberShare)}`,
      secondary: `${num(r.chamberSeats)} of ${num(r.chamberTotal)} seats`,
      tertiary: `Largest party in ${num(r.councilsLargest)} of ${num(r.councilsWithComposition)} councils`,
      color: partyHex
    };
  }
  function clearChamber() {
    chamberTip = null;
  }

  // Familiar Y cap for the per-party slope (let outliers like SNP
  // 2017-style results push above 50% if it ever happens).
  const slopeYMax = $derived.by(() => {
    let raw = 0.5;
    for (const r of trend) {
      if (r.contestedSeats === 0) continue;
      if (r.voteShare > raw) raw = r.voteShare;
    }
    return Math.min(1, Math.ceil(raw * 10) / 10);
  });
</script>

<svelte:head>
  <title>{data.partyName} — electionresults.uk</title>
  <meta
    name="description"
    content="Vote share, seat share, and chamber footprint for {data.partyName} across UK local elections 2021–2026."
  />
  <link rel="canonical" href="https://electionresults.uk/councils/party/{data.partySlug}" />
</svelte:head>

<main class="wide">
  <h1>
    <span class="swatch" style:background={partyHex} aria-hidden="true"></span>
    {data.partyName}
  </h1>

  <p>
    {data.partyName} across the UK local-election cycles in our dataset
    (2021&ndash;2026 election results, plus chamber composition rolled
    forward to 2026 from
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
    snapshots).
  </p>

  <h2>Headline</h2>
  <ul class="headline">
    <li>
      <strong>{num(data.totalGained)}</strong> council-control gains and
      <strong>{num(data.totalLost)}</strong> losses across this window
      (net <strong>{data.totalGained - data.totalLost > 0 ? '+' : ''}{data.totalGained - data.totalLost}</strong>).
    </li>
    {#if chamberPoints.length >= 2}
      {@const first = chamberPoints[0]}
      {@const last = chamberPoints[chamberPoints.length - 1]}
      <li>
        Footprint share moved from <strong>{pct(first.chamberShare)}</strong>
        ({first.year}) to <strong>{pct(last.chamberShare)}</strong>
        ({last.year}) &mdash; a {pts(last.chamberShare - first.chamberShare)}{' '}
        shift across {num(last.councilsWithComposition)} councils.
      </li>
      <li>
        Largest party in <strong>{num(last.councilsLargest)}</strong> of
        {num(last.councilsWithComposition)} councils as of {last.year}
        ({pct(last.councilsLargest / Math.max(1, last.councilsWithComposition))}).
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
          class:benchmark-card--over={data.cumulativeFptpEffect.seatDelta > 0}
          class:benchmark-card--under={data.cumulativeFptpEffect.seatDelta < 0}
        >
          <div class="benchmark-system">
            {data.cumulativeFptpEffect.yearStart}&ndash;{data.cumulativeFptpEffect.yearEnd} window
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
        {#if showLatestFptpEffect && data.latestFptpEffect}
          {@const latestFptpEffect = data.latestFptpEffect}
          <div
            class="benchmark-card"
            class:benchmark-card--over={latestFptpEffect.seatDelta > 0}
            class:benchmark-card--under={latestFptpEffect.seatDelta < 0}
          >
            <div class="benchmark-system">Latest cycle</div>
            <div class="benchmark-where">
              {num(latestFptpEffect.councilCount)} FPTP council results in
              {latestFptpEffect.yearEnd}
            </div>
            <div class="benchmark-figure">
              {signedSeats(latestFptpEffect.seatDelta)} <span>seats</span>
            </div>
            <div class="benchmark-detail">
              {benchmarkDirection(latestFptpEffect.seatDelta)}
              ({num(latestFptpEffect.fptpSeats)} actual vs
              {num(latestFptpEffect.dhondtSeats)} benchmark)
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <h2>Where {data.partyName} leads</h2>
  <p class="muted small">
    Councils where {data.partyName} is the largest single party in the
    most recent composition snapshot. Hover any hex for the council
    name and seat count; click to drill in.
  </p>

  {#if data.controlledCouncils.length > 0}
    <div class="map-and-scale">
      <CouncilHexMap
        fills={controlFills}
        title={`UK councils where ${data.partyName} is currently the largest party`}
      />
      <div class="map-legend">
        <p class="legend-label">Currently largest in</p>
        <p class="legend-count">
          <span class="swatch" style:background={partyHex}></span>
          <strong>{num(data.controlledCouncils.length)}</strong> councils
        </p>
        <p class="muted xsmall">
          From the most recent composition snapshot per council. Grey
          hexes are councils where another party leads (or where we
          don't yet have a snapshot).
        </p>
      </div>
    </div>
  {:else}
    <p class="muted">
      No councils where {data.partyName} is currently the largest party
      in our composition data.
    </p>
  {/if}

  <h2>Cycles</h2>
  <p class="muted small">
    Click into any cycle for a full breakdown — councils gained, lost,
    and where the seats came from.
  </p>

  <div class="cycle-cards">
    {#each [...trend].filter((r) => r.contestedSeats > 0).sort((a, b) => b.year - a.year) as row (row.year)}
      {@const gap = row.seatShare - row.voteShare}
      {@const ctrl = data.controlByYear[row.year]}
      <a class="cycle-card" href="/councils/party/{data.partySlug}/{row.year}" style:--accent-color={partyHex}>
        <h3>{row.year}</h3>
        <p class="stat">
          <strong>{num(row.seatsWon)}</strong>
          <span class="muted">of {num(row.contestedSeats)} seats won</span>
        </p>
        <p class="stat">
          <strong>{pct(row.voteShare, 0)}</strong>
          <span class="arrow">→</span>
          <strong>{pct(row.seatShare, 0)}</strong>
          <span class="gap" class:over={gap > 0.005} class:under={gap < -0.005}>
            {pts(gap, 0)}
          </span>
        </p>
        {#if ctrl}
          <p class="stat control">
            Control:
            <strong class="pos">+{num(ctrl.gained)}</strong>
            <span class="muted">/</span>
            <strong class="neg">−{num(ctrl.lost)}</strong>
            <span class="muted">councils</span>
          </p>
        {/if}
        <p class="muted xsmall">{num(row.councilsContested)} councils contested</p>
      </a>
    {/each}
  </div>

  <h2>Votes vs seats, by cycle</h2>
  <p class="muted small">
    For each cycle this party contested, the bars show vote share
    (filled) against seat share (outlined). The signed gap is the
    disproportionality.
  </p>

  {#if cycleBars.length > 0}
    <PairedBarChart bars={cycleBars} />
  {:else}
    <p class="muted">No election-side data for this party.</p>
  {/if}

  <h2>Four-year movement</h2>
  <p class="muted small">
    Vote share across each cycle pair (same councils, four years apart).
  </p>

  {#if cycleSlopes.length > 0}
    <div class="slope-row">
      {#each cycleSlopes as s, i (s.label)}
        <SlopeChart
          title={s.label}
          color={partyHex}
          startYear={s.startYear}
          startValue={s.startValue}
          endYear={s.endYear}
          endValue={s.endValue}
          yMax={slopeYMax}
          compact={i > 0}
        />
      {/each}
    </div>
  {:else}
    <p class="muted">
      Not enough cycle-paired data yet to draw four-year movement for
      this party.
    </p>
  {/if}

  <h2>Cumulative footprint</h2>
  <p class="muted small">
    <strong>Share of all UK council seats held.</strong> Across all
    councils in our dataset, including those not polling this year.
    Comparable across the full window because composition rolls forward
    year-on-year.
  </p>

  <div class="chartwrap">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Cumulative footprint over time">
      {#each yShareTicks() as t (t.v)}
        <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--rule)" stroke-width="1" />
        <text x={PAD.l - 6} y={t.y + 3} text-anchor="end" font-size="11" fill="var(--muted)">
          {Math.round(t.v * 100)}%
        </text>
      {/each}
      {#each chamberYearTicks as y (y)}
        <text x={xForChamber(y)} y={H - PAD.b + 16} text-anchor="middle" font-size="11" fill="var(--muted)">
          {y}
        </text>
      {/each}
      {#if chamberPoints.length >= 2}
        <polyline
          points={chamberPoints.map((r) => `${xForChamber(r.year)},${yFor(r.chamberShare)}`).join(' ')}
          fill="none"
          stroke={partyHex}
          stroke-width="2.5"
        />
      {/if}
      {#each chamberPoints as r (r.year)}
        <circle
          cx={xForChamber(r.year)}
          cy={yFor(r.chamberShare)}
          r="6"
          fill={partyHex}
          stroke="var(--bg)"
          stroke-width="1.5"
          tabindex="0"
          role="button"
          aria-label={`${r.year} footprint share`}
          onpointerenter={() => showChamber(r)}
          onpointerleave={clearChamber}
          onfocus={() => showChamber(r)}
          onblur={clearChamber}
          style="cursor:pointer"
        />
      {/each}

      {#if chamberTip}
        {@const pos = tipPosition(chamberTip)}
        <g style="pointer-events: none">
          <line
            x1={chamberTip.cx}
            y1={chamberTip.cy}
            x2={chamberTip.cx}
            y2={pos.below ? pos.y : pos.y + TIP_H}
            stroke={chamberTip.color}
            stroke-width="1"
            stroke-dasharray="2 2"
            opacity="0.5"
          />
          <g transform="translate({pos.x}, {pos.y})">
            <rect
              x="0"
              y="0"
              width={TIP_W}
              height={TIP_H}
              rx="5"
              fill="var(--bg)"
              stroke={chamberTip.color}
              stroke-width="2"
            />
            <text x="10" y="18" font-size="12.5" font-weight="600" fill="var(--fg)">
              {chamberTip.primary}
            </text>
            <text x="10" y="34" font-size="11" fill="var(--muted)">
              {chamberTip.secondary}
            </text>
            {#if chamberTip.tertiary}
              <text x="10" y="50" font-size="11" fill="var(--muted)">
                {chamberTip.tertiary}
              </text>
            {/if}
          </g>
        </g>
      {/if}
    </svg>
  </div>

  <h2>By election</h2>
  <table>
    <thead>
      <tr>
        <th>Year</th>
        <th class="r">Seats up</th>
        <th class="r">Won</th>
        <th class="r">Vote share</th>
        <th class="r">Seat share</th>
        <th class="r">Footprint share</th>
        <th class="r">Largest in</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each [...trend].sort((a, b) => b.year - a.year) as row (row.year)}
        <tr>
          <td>{row.year}</td>
          <td class="r">{row.contestedSeats > 0 ? num(row.contestedSeats) : '—'}</td>
          <td class="r">{row.contestedSeats > 0 ? num(row.seatsWon) : '—'}</td>
          <td class="r">{row.contestedSeats > 0 ? pct(row.voteShare) : '—'}</td>
          <td class="r">{row.contestedSeats > 0 ? pct(row.seatShare) : '—'}</td>
          <td class="r">{row.chamberTotal > 0 ? pct(row.chamberShare) : '—'}</td>
          <td class="r">{row.chamberTotal > 0 ? `${num(row.councilsLargest)} / ${num(row.councilsWithComposition)}` : '—'}</td>
          <td>
            {#if data.years.includes(row.year)}
              <a href="/councils/party/{data.partySlug}/{row.year}">Details &rarr;</a>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p class="muted small">
    See <a href="/councils/methodology">methodology</a> for how we normalise
    party names, why "Labour and Co-operative" collapses to "Labour
    Party", and the bloc-vote vote-share caveat for multi-member wards.
  </p>
</main>

<style>
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
    margin: 0.6rem 0 1.5rem;
  }
  @media (max-width: 640px) {
    .map-and-scale {
      grid-template-columns: 1fr;
    }
  }
  .map-legend {
    font-size: 0.85rem;
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
  @media (prefers-color-scheme: dark) {
    .map-legend .swatch {
      border-color: rgba(255, 255, 255, 0.25);
    }
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
    color: #1c7a3a;
  }
  .cycle-card .stat .gap.under {
    color: var(--warn);
  }
  .cycle-card .stat.control .pos {
    color: #1c7a3a;
  }
  .cycle-card .stat.control .neg {
    color: var(--warn);
  }
  .xsmall {
    font-size: 0.75rem;
    margin: 0.2rem 0 0;
  }
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
  ul.headline {
    list-style: disc;
    padding-left: 1.2rem;
  }
  ul.headline li {
    margin: 0.4em 0;
  }
  .slope-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.6rem;
    margin: 0.8rem 0 1.2rem;
  }
  .chartwrap {
    margin: 0.8rem 0 0.4rem;
  }
  .chartwrap svg {
    width: 100%;
    height: auto;
    max-width: 100%;
    display: block;
  }
  th.r,
  td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
