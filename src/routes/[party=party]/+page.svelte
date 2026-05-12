<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import type { PartyYearStats } from '$lib/types';

  let { data } = $props();
  const trend = $derived(data.trend as PartyYearStats[]);
  const partyHex = $derived(partyColor(data.partyName));

  // Cycle-pair grouping: group years by year % 4. Two years in the same
  // family are roughly comparable (mostly the same councils polled);
  // years across families are not. We render each family as its own
  // sub-line so the chart is honest about what's being compared.
  type Family = { mod: number; rows: PartyYearStats[]; label: string };
  const familyLabels: Record<number, string> = {
    0: '2020 / 2024 cycle',
    1: '2021 / 2025 cycle',
    2: '2022 / 2026 cycle',
    3: '2023 / 2027 cycle'
  };
  const families = $derived.by<Family[]>(() => {
    const byMod = new Map<number, PartyYearStats[]>();
    for (const r of trend) {
      if (r.contestedSeats === 0) continue;
      const arr = byMod.get(r.cycleFamily) ?? [];
      arr.push(r);
      byMod.set(r.cycleFamily, arr);
    }
    return [...byMod.entries()]
      .map(([mod, rows]) => ({
        mod,
        rows: rows.sort((a, b) => a.year - b.year),
        label: familyLabels[mod] ?? `mod-${mod} cycle`
      }))
      .sort((a, b) => a.mod - b.mod);
  });

  // Chamber trend line: composition rolls forward year to year so this
  // single line is comparable across the whole window (unlike the
  // election-side numbers above).
  const chamberPoints = $derived(
    trend.filter((r) => r.chamberTotal > 0)
  );

  // Inline-SVG plot dimensions. We render two stacked plots: one for
  // election-side metrics (faceted by cycle family) and one for the
  // continuous chamber trend. They use independent X ranges so the
  // election-side chart isn't padded with empty pre-2021 space.
  const W = 720;
  const H = 240;
  const PAD = { l: 44, r: 16, t: 14, b: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  // Election-side range: only years with actual contested-cycle data.
  const electionYears = $derived(
    trend.filter((r) => r.contestedSeats > 0).map((r) => r.year)
  );
  const electionMinYear = $derived(
    electionYears.length > 0 ? Math.min(...electionYears) : 0
  );
  const electionMaxYear = $derived(
    electionYears.length > 0 ? Math.max(...electionYears) : 0
  );
  const electionYearSpan = $derived(
    Math.max(1, electionMaxYear - electionMinYear)
  );
  const electionYearTicks = $derived(
    electionYears.length > 0
      ? Array.from(
          { length: electionYearSpan + 1 },
          (_, i) => electionMinYear + i
        )
      : []
  );
  function xForElection(year: number): number {
    return PAD.l + ((year - electionMinYear) / electionYearSpan) * innerW;
  }

  // Chamber range: full window, since composition rolls forward from 2016.
  const chamberYears = $derived(
    trend.filter((r) => r.chamberTotal > 0).map((r) => r.year)
  );
  const chamberMinYear = $derived(
    chamberYears.length > 0 ? Math.min(...chamberYears) : 0
  );
  const chamberMaxYear = $derived(
    chamberYears.length > 0 ? Math.max(...chamberYears) : 0
  );
  const chamberYearSpan = $derived(
    Math.max(1, chamberMaxYear - chamberMinYear)
  );
  const chamberYearTicks = $derived(
    chamberYears.length > 0
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

  // Y-axis range: 0–60% covers all realistic seat-share / vote-share /
  // chamber-share points the seven major parties hit in our window.
  function yShareTicks(): { v: number; y: number }[] {
    return [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((v) => ({ v, y: yFor(v) }));
  }

  // --- Tooltips --------------------------------------------------------
  //
  // One tooltip state per chart. Anchored above the hovered dot so the
  // reader's eye doesn't have to jump to a fixed corner. Falls back to
  // below the dot when there isn't room above; clamps horizontally so
  // the box never spills past the chart bounds.
  type Tooltip = {
    cx: number;
    cy: number;
    primary: string;
    secondary: string;
    tertiary?: string;
    color: string;
  };
  let electionTip = $state<Tooltip | null>(null);
  let chamberTip = $state<Tooltip | null>(null);

  // Tooltip box dimensions used by both charts.
  const TIP_W = 250;
  const TIP_H = 60;
  const TIP_GAP = 12; // distance between dot and tooltip edge

  /** Place the tooltip box above the dot when there's room, otherwise
   *  below it; clamp x so the box stays within the chart. Returns the
   *  top-left corner for an SVG `<g transform="translate(...)" />`. */
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

  function showVoteShare(r: PartyYearStats) {
    electionTip = {
      cx: xForElection(r.year),
      cy: yFor(r.voteShare),
      primary: `${r.year} · vote share: ${pct(r.voteShare)}`,
      secondary: `${num(r.votes)} votes across ${num(r.councilsContested)} councils`,
      tertiary: `Cycle: ${familyLabels[r.cycleFamily] ?? `mod-${r.cycleFamily}`}`,
      color: partyHex
    };
  }
  function showSeatShare(r: PartyYearStats) {
    electionTip = {
      cx: xForElection(r.year),
      cy: yFor(r.seatShare),
      primary: `${r.year} · seat share: ${pct(r.seatShare)}`,
      secondary: `${num(r.seatsWon)} of ${num(r.contestedSeats)} seats up`,
      tertiary: `Cycle: ${familyLabels[r.cycleFamily] ?? `mod-${r.cycleFamily}`}`,
      color: partyHex
    };
  }
  function clearElection() {
    electionTip = null;
  }
  function showChamber(r: PartyYearStats) {
    chamberTip = {
      cx: xForChamber(r.year),
      cy: yFor(r.chamberShare),
      primary: `${r.year} · chamber share: ${pct(r.chamberShare)}`,
      secondary: `${num(r.chamberSeats)} of ${num(r.chamberTotal)} seats`,
      tertiary: `Largest party in ${num(r.councilsLargest)} of ${num(r.councilsWithComposition)} councils`,
      color: partyHex
    };
  }
  function clearChamber() {
    chamberTip = null;
  }
</script>

<svelte:head>
  <title>{data.partyName} — electionresults.uk</title>
  <meta
    name="description"
    content="Vote share, seat share, and chamber composition for {data.partyName} across UK local elections 2021–2026."
  />
  <link rel="canonical" href="https://electionresults.uk/{data.partySlug}" />
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

  <p class="muted">
    <strong>Reading note.</strong> UK locals run on a 4-year cycle, with
    different councils polling in different years. The election-side
    metrics below are only directly comparable between elections four
    years apart (e.g. 2022 vs 2026, or 2021 vs 2025) — that's why the
    vote-share and seat-share lines are drawn separately, one per
    cycle. The chamber composition line is comparable across all years
    (it sums every chamber, rolled forward where no fresh snapshot exists).
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
        Chamber share moved from <strong>{pct(first.chamberShare)}</strong>
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

  <h2>Election-side trend (cycle-paired)</h2>
  <p class="muted">
    Vote share (solid) and seat share (dashed) of the seats actually up
    in each cycle. Each line is one cycle family.
  </p>

  <div class="chartwrap">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Vote share and seat share by cycle family">
      <!-- Y gridlines + labels -->
      {#each yShareTicks() as t (t.v)}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={t.y}
          y2={t.y}
          stroke="var(--rule)"
          stroke-width="1"
        />
        <text x={PAD.l - 6} y={t.y + 3} text-anchor="end" font-size="11" fill="var(--muted)">
          {Math.round(t.v * 100)}%
        </text>
      {/each}
      <!-- X labels -->
      {#each electionYearTicks as y}
        <text
          x={xForElection(y)}
          y={H - PAD.b + 16}
          text-anchor="middle"
          font-size="11"
          fill="var(--muted)"
        >
          {y}
        </text>
      {/each}

      <!-- Cycle-family lines (vote share solid, seat share dashed) -->
      {#each families as fam (fam.mod)}
        {#if fam.rows.length >= 1}
          <!-- Vote share line -->
          <polyline
            points={fam.rows.map((r) => `${xForElection(r.year)},${yFor(r.voteShare)}`).join(' ')}
            fill="none"
            stroke={partyHex}
            stroke-width="2.5"
            opacity={0.6 + 0.1 * fam.mod}
          />
          {#each fam.rows as r}
            <circle
              cx={xForElection(r.year)}
              cy={yFor(r.voteShare)}
              r="6"
              fill={partyHex}
              stroke="var(--bg)"
              stroke-width="1.5"
              tabindex="0"
              role="button"
              aria-label={`${r.year} vote share`}
              onpointerenter={() => showVoteShare(r)}
              onpointerleave={clearElection}
              onfocus={() => showVoteShare(r)}
              onblur={clearElection}
              style="cursor:pointer"
            />
          {/each}
          <!-- Seat share line -->
          <polyline
            points={fam.rows.map((r) => `${xForElection(r.year)},${yFor(r.seatShare)}`).join(' ')}
            fill="none"
            stroke={partyHex}
            stroke-width="2"
            stroke-dasharray="4 4"
            opacity={0.6 + 0.1 * fam.mod}
          />
          {#each fam.rows as r}
            <circle
              cx={xForElection(r.year)}
              cy={yFor(r.seatShare)}
              r="5"
              fill="var(--bg)"
              stroke={partyHex}
              stroke-width="2"
              tabindex="0"
              role="button"
              aria-label={`${r.year} seat share`}
              onpointerenter={() => showSeatShare(r)}
              onpointerleave={clearElection}
              onfocus={() => showSeatShare(r)}
              onblur={clearElection}
              style="cursor:pointer"
            />
          {/each}
        {/if}
      {/each}

      {#if electionTip}
        {@const pos = tipPosition(electionTip)}
        <g style="pointer-events: none">
          <line
            x1={electionTip.cx}
            y1={electionTip.cy}
            x2={electionTip.cx}
            y2={pos.below ? pos.y : pos.y + TIP_H}
            stroke={electionTip.color}
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
              stroke={electionTip.color}
              stroke-width="2"
            />
            <text x="10" y="18" font-size="12.5" font-weight="600" fill="var(--fg)">
              {electionTip.primary}
            </text>
            <text x="10" y="34" font-size="11" fill="var(--muted)">
              {electionTip.secondary}
            </text>
            {#if electionTip.tertiary}
              <text x="10" y="50" font-size="11" fill="var(--muted)">
                {electionTip.tertiary}
              </text>
            {/if}
          </g>
        </g>
      {/if}
    </svg>
  </div>

  <ul class="legend">
    <li><span class="swatch-line solid" style:background={partyHex}></span> Vote share</li>
    <li><span class="swatch-line dashed" style:--c={partyHex}></span> Seat share (FPTP)</li>
  </ul>

  <h2>Chamber composition (running total)</h2>
  <p class="muted">
    Share of all council seats this party holds across every council
    we have composition data for, year by year. Comparable across the
    full window.
  </p>

  <div class="chartwrap">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Chamber share over time">
      {#each yShareTicks() as t (t.v)}
        <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--rule)" stroke-width="1" />
        <text x={PAD.l - 6} y={t.y + 3} text-anchor="end" font-size="11" fill="var(--muted)">
          {Math.round(t.v * 100)}%
        </text>
      {/each}
      {#each chamberYearTicks as y}
        <text x={xForChamber(y)} y={H - PAD.b + 16} text-anchor="middle" font-size="11" fill="var(--muted)">
          {y}
        </text>
      {/each}
      <polyline
        points={chamberPoints.map((r) => `${xForChamber(r.year)},${yFor(r.chamberShare)}`).join(' ')}
        fill="none"
        stroke={partyHex}
        stroke-width="2.5"
      />
      {#each chamberPoints as r}
        <circle
          cx={xForChamber(r.year)}
          cy={yFor(r.chamberShare)}
          r="6"
          fill={partyHex}
          stroke="var(--bg)"
          stroke-width="1.5"
          tabindex="0"
          role="button"
          aria-label={`${r.year} chamber share`}
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
        <th class="r">Chamber share</th>
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
              <a href="/{data.partySlug}/{row.year}">Details &rarr;</a>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p class="muted">
    See <a href="/methodology">methodology</a> for how we normalise
    party names, why "Labour and Co-operative" collapses to "Labour
    Party", and the bloc-vote vote-share caveat for multi-member wards.
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
  ul.headline {
    list-style: disc;
    padding-left: 1.2rem;
  }
  ul.headline li {
    margin: 0.4em 0;
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
  ul.legend {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
    display: flex;
    gap: 1.2rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .swatch-line {
    display: inline-block;
    width: 1.2rem;
    height: 0.18rem;
    vertical-align: middle;
    margin-right: 0.35rem;
  }
  .swatch-line.dashed {
    background: transparent !important;
    border-top: 2px dashed var(--c, var(--fg));
    height: 0;
    margin-bottom: 0.18rem;
  }
  th.r,
  td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
