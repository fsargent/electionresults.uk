<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import PairedBarChart from '$lib/charts/PairedBarChart.svelte';
  import SlopeChart from '$lib/charts/SlopeChart.svelte';
  import type { PartyYearStats } from '$lib/types';

  let { data } = $props();

  // Persisted UI state across navigation. We use localStorage rather
  // than URL query params so the user's choices follow them around the
  // site (drilling into /party/labour and back) without polluting the URL or
  // breaking prerender. Reads happen in an onMount-style $effect after
  // hydration; the SSR pass uses defaults so the prerendered HTML is
  // stable and uniform for all visitors.
  const STORAGE_KEY_VISIBILITY = 'er-uk:parties:visibility';

  // Toggle state per party slug. Initialised from the server's
  // defaultVisible set (majors on, regionals off) but the user can
  // turn anything on/off interactively. Drives Section C (cumulative
  // footprint) only — Sections A and B always show every party with
  // data for the relevant cycle.
  // svelte-ignore state_referenced_locally
  const visibility = $state<Record<string, boolean>>(
    Object.fromEntries(
      data.parties.map((p) => [p.slug, data.defaultVisible.includes(p.slug)])
    )
  );
  function toggle(slug: string) {
    visibility[slug] = !visibility[slug];
  }
  function showOnly(slug: string) {
    for (const p of data.parties) visibility[p.slug] = p.slug === slug;
  }
  function showAll() {
    for (const p of data.parties) visibility[p.slug] = true;
  }
  function showMajorsOnly() {
    for (const p of data.parties) {
      visibility[p.slug] = data.defaultVisible.includes(p.slug);
    }
  }

  const visibleParties = $derived(
    data.parties.filter((p) => visibility[p.slug])
  );

  // --- Section A: paired bars per cycle ---------------------------------
  //
  // For each recent cycle, build a sorted-by-vote-share list of the
  // parties that contested seats in that cycle. Order parties so the
  // reader's eye lands on the largest first.
  function barsForCycle(year: number) {
    return data.parties
      .map((p) => {
        const row = p.trend.find(
          (s) => s.year === year && s.contestedSeats > 0
        );
        if (!row) return null;
        return {
          name: p.name,
          href: `/party/${p.slug}`,
          color: partyColor(p.name),
          voteShare: row.voteShare,
          seatShare: row.seatShare
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => b.voteShare - a.voteShare);
  }

  // --- Section B: slope per party in the most recent cycle pair --------
  //
  // For each party, find the most recent year in which they contested
  // seats and pair it with the same party's prior cycle (year − 4).
  // Skip the party if either end is missing — a single point is not a
  // slope, and "0% → 12%" is honest only when the 0% is real, not
  // missing data.
  type Slope = {
    party: string;
    slug: string;
    color: string;
    startYear: number;
    startValue: number;
    endYear: number;
    endValue: number;
  };
  const slopes = $derived.by<Slope[]>(() => {
    const out: Slope[] = [];
    for (const p of data.parties) {
      const elections = p.trend
        .filter((s) => s.contestedSeats > 0)
        .sort((a, b) => b.year - a.year);
      const last = elections[0];
      if (!last) continue;
      const prior = p.trend.find(
        (s) => s.year === last.year - 4 && s.contestedSeats > 0
      );
      if (!prior) continue;
      out.push({
        party: p.name,
        slug: p.slug,
        color: partyColor(p.name),
        startYear: prior.year,
        startValue: prior.voteShare,
        endYear: last.year,
        endValue: last.voteShare
      });
    }
    // Most-recent-cycle slopes lead, then by absolute movement so the
    // biggest swings sit nearby for visual comparison.
    return out.sort(
      (a, b) =>
        b.endYear - a.endYear ||
        Math.abs(b.endValue - b.startValue) -
          Math.abs(a.endValue - a.startValue)
    );
  });

  // --- Section C: cumulative footprint chart ----------------------------
  //
  // This is the existing chamber-share line chart, retained as-is but
  // demoted to context. The metric is comparable across the full
  // window because composition rolls forward year-on-year.
  const W = 760;
  const H = 320;
  const PAD = { l: 48, r: 16, t: 16, b: 36 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const chamberYears = $derived(
    data.years.filter((y) =>
      data.parties.some((p) =>
        p.trend.some((s) => s.year === y && s.chamberTotal > 0)
      )
    )
  );
  const minYear = $derived(
    chamberYears.length > 0
      ? Math.min(...chamberYears)
      : Math.min(...data.years)
  );
  const maxYear = $derived(
    chamberYears.length > 0
      ? Math.max(...chamberYears)
      : Math.max(...data.years)
  );
  const yearSpan = $derived(Math.max(1, maxYear - minYear));

  function xFor(year: number): number {
    return PAD.l + ((year - minYear) / yearSpan) * innerW;
  }
  function yFor(share: number): number {
    return PAD.t + (1 - share / yMax) * innerH;
  }

  // Auto-fit Y axis to the visible data. Round up to the next 10% so
  // the gridlines stay readable.
  const yMax = $derived.by(() => {
    let raw = 0;
    for (const p of visibleParties) {
      for (const s of p.trend) {
        if (s.chamberTotal === 0) continue;
        if (s.chamberShare > raw) raw = s.chamberShare;
      }
    }
    if (raw <= 0) return 0.1;
    return Math.min(1, Math.ceil(raw * 10) / 10);
  });

  const yTicks = $derived.by(() => {
    const step = yMax <= 0.2 ? 0.05 : 0.1;
    const out: number[] = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) out.push(Number(v.toFixed(2)));
    return out;
  });

  const yearTicks = $derived(
    Array.from({ length: yearSpan + 1 }, (_, i) => minYear + i)
  );

  // --- Persistence -----------------------------------------------------
  //
  // Hydrate stored visibility on the client (SSR can't read
  // localStorage). Wrap reads in try/catch so a corrupt value or a
  // strict storage policy (Safari private mode) just falls back to
  // defaults instead of crashing the page.
  let hydrated = $state(false);
  $effect(() => {
    if (hydrated) return;
    try {
      const vis = localStorage.getItem(STORAGE_KEY_VISIBILITY);
      if (vis) {
        const parsed = JSON.parse(vis);
        if (parsed && typeof parsed === 'object') {
          for (const slug of Object.keys(visibility)) {
            if (typeof parsed[slug] === 'boolean') visibility[slug] = parsed[slug];
          }
        }
      }
    } catch {
      // ignore — fall back to defaults
    }
    hydrated = true;
  });
  $effect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(visibility));
    } catch {}
  });

  // Tooltip shown on hover over a Section C data point.
  type Tooltip = {
    x: number;
    y: number;
    party: string;
    color: string;
    year: number;
    primary: string;
    secondary: string;
  };
  let tooltip = $state<Tooltip | null>(null);
  function buildTooltip(
    party: typeof data.parties[number],
    s: PartyYearStats,
    cx: number,
    cy: number
  ): Tooltip {
    return {
      x: cx,
      y: cy,
      party: party.name,
      color: partyColor(party.name),
      year: s.year,
      primary: `${pct(s.chamberShare)}`,
      secondary: `${num(s.chamberSeats)} of ${num(s.chamberTotal)} seats — largest in ${num(s.councilsLargest)}/${num(s.councilsWithComposition)} councils`
    };
  }
  function clearTooltip() {
    tooltip = null;
  }

  // Cards: latest snapshot per party, click to navigate. Sorted by
  // current chamber share descending so the leaders read first.
  const orderedCards = $derived(
    [...data.parties].sort(
      (a, b) =>
        (b.latest?.chamberShare ?? 0) - (a.latest?.chamberShare ?? 0)
    )
  );
</script>

<svelte:head>
  <title>Parties — electionresults.uk</title>
  <meta
    name="description"
    content="UK major parties at local-government level — disproportionality between vote share and seat share, four-year movement, and chamber footprint."
  />
  <link rel="canonical" href="https://electionresults.uk/parties" />
</svelte:head>

<main class="wide">
  <h1>Parties</h1>

  <p>
    Seven national parties active in UK local government. The chart
    below pairs the votes each party won against the seats they
    actually got — the gap is the story this site exists to tell.
  </p>

  <h2 id="pick-a-party">Pick a party</h2>
  <p class="muted small">
    Drill into any party for its full per-cycle history, the councils
    it gained and lost, and where its footprint shifted.
  </p>

  <div class="cards">
    {#each orderedCards as p (p.slug)}
      {@const color = partyColor(p.name)}
      {@const latest = p.latest}
      {@const earliest = p.trend.filter((s) => s.chamberTotal > 0)[0]}
      {@const swing = latest && earliest
        ? latest.chamberShare - earliest.chamberShare
        : null}
      <a class="card" href="/party/{p.slug}" style:--accent-color={color}>
        <header>
          <span class="swatch" style:background={color} aria-hidden="true"></span>
          <h3>{p.name}</h3>
          <span class="chev" aria-hidden="true">→</span>
        </header>
        {#if latest}
          <p class="big">{pct(latest.chamberShare)}</p>
          <p class="muted small">
            {num(latest.chamberSeats)} of {num(latest.chamberTotal)} seats ({latest.year})
          </p>
          <p class="small">
            Largest in <strong>{num(latest.councilsLargest)}</strong> of
            {num(latest.councilsWithComposition)} councils.
          </p>
          {#if swing != null && earliest}
            <p class="small">
              Since {earliest.year}: <strong>{pts(swing)}</strong>
              footprint share.
            </p>
          {/if}
          <p class="small">
            Council-control swing in window:
            <strong class="pos">+{p.totalGained}</strong>
            /
            <strong class="neg">−{p.totalLost}</strong>
          </p>
        {:else}
          <p class="muted">No chamber data.</p>
        {/if}
      </a>
    {/each}
  </div>

  <h2 id="votes-vs-seats">Votes vs seats, by cycle</h2>
  <p class="muted small">
    For each recent cycle, the bars show every party's share of valid
    votes (filled) against its share of the seats actually up
    (outlined). The signed gap is the disproportionality.
  </p>

  <div class="cycle-panels">
    {#each data.recentCycles as cycle (cycle.year)}
      {@const bars = barsForCycle(cycle.year)}
      <section class="cycle-panel" id={`cycle-${cycle.year}`}>
        <header>
          <h3>{cycle.electionDateLabel}</h3>
          <p class="muted small">
            {num(cycle.councilCount)} councils · {num(cycle.seatCount)} seats up{#if cycle.priorYear}
              · same councils last polled in {cycle.priorYear}{/if}.
          </p>
        </header>
        {#if bars.length > 0}
          <PairedBarChart {bars} />
        {:else}
          <p class="muted">No party-level data for this cycle yet.</p>
        {/if}
      </section>
    {/each}
  </div>

  <h2 id="four-year-movement">Four-year movement</h2>
  <p class="muted small">
    Vote share, four years apart. Same councils, same cycle. One panel
    per party with both ends of a comparable cycle in our data.
  </p>

  {#if slopes.length > 0}
    <div class="slope-grid">
      {#each slopes as s (s.slug)}
        <SlopeChart
          title={s.party}
          href={`/party/${s.slug}`}
          color={s.color}
          startYear={s.startYear}
          startValue={s.startValue}
          endYear={s.endYear}
          endValue={s.endValue}
          compact
        />
      {/each}
    </div>
  {:else}
    <p class="muted">
      Not enough cycle-paired data yet to draw four-year movement.
    </p>
  {/if}

  <h2 id="cumulative-footprint">Cumulative footprint</h2>
  <p class="muted">
    <strong>Share of all UK council seats held.</strong> Across all
    councils in our dataset, including those not polling this year.
    Weighted by chamber size — bigger councils count for more.
  </p>

  <div class="chartwrap">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Cumulative footprint chart">
      {#each yTicks as v (v)}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={yFor(v)}
          y2={yFor(v)}
          stroke="var(--rule)"
          stroke-width="1"
        />
        <text
          x={PAD.l - 6}
          y={yFor(v) + 3}
          text-anchor="end"
          font-size="11"
          fill="var(--muted)"
        >
          {Math.round(v * 100)}%
        </text>
      {/each}
      {#each yearTicks as y (y)}
        {#if yearSpan <= 8 || y % 2 === 0}
          <text
            x={xFor(y)}
            y={H - PAD.b + 16}
            text-anchor="middle"
            font-size="11"
            fill="var(--muted)"
          >
            {y}
          </text>
        {/if}
      {/each}

      {#each visibleParties as party (party.slug)}
        {@const color = partyColor(party.name)}
        {@const points = party.trend
          .filter((s) => s.chamberTotal > 0)
          .sort((a, b) => a.year - b.year)}
        {#if points.length >= 2}
          <polyline
            points={points
              .map((s) => `${xFor(s.year)},${yFor(s.chamberShare)}`)
              .join(' ')}
            fill="none"
            stroke={color}
            stroke-width="2.4"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        {/if}
        {#each points as s (s.year)}
          {@const cx = xFor(s.year)}
          {@const cy = yFor(s.chamberShare)}
          <a
            href={`/party/${party.slug}`}
            aria-label={`${party.name} ${s.year}`}
            onpointerenter={() => (tooltip = buildTooltip(party, s, cx, cy))}
            onpointerleave={clearTooltip}
            onfocus={() => (tooltip = buildTooltip(party, s, cx, cy))}
            onblur={clearTooltip}
          >
            <circle
              cx={cx}
              cy={cy}
              r="5"
              fill={color}
              stroke="var(--bg)"
              stroke-width="1.5"
              style="cursor:pointer"
            />
          </a>
        {/each}
      {/each}

      {#if tooltip}
        <g transform="translate({Math.min(tooltip.x + 10, W - 220)}, {Math.max(20, tooltip.y - 50)})">
          <rect
            x="0"
            y="0"
            width="210"
            height="58"
            rx="5"
            fill="var(--bg)"
            stroke={tooltip.color}
            stroke-width="2"
          />
          <text x="10" y="18" font-size="12" font-weight="600" fill="var(--fg)">
            {tooltip.party} · {tooltip.year}
          </text>
          <text x="10" y="34" font-size="13" fill={tooltip.color} font-weight="600">
            {tooltip.primary}
          </text>
          <text x="10" y="50" font-size="11" fill="var(--muted)">
            {tooltip.secondary.length > 36 ? tooltip.secondary.slice(0, 33) + '…' : tooltip.secondary}
          </text>
        </g>
      {/if}
    </svg>
  </div>

  <fieldset class="toggles">
    <legend>Show parties</legend>
    {#each data.parties as p (p.slug)}
      {@const color = partyColor(p.name)}
      <label class="toggle" class:off={!visibility[p.slug]}>
        <input
          type="checkbox"
          checked={visibility[p.slug]}
          onchange={() => toggle(p.slug)}
        />
        <span class="swatch-line" style:background={color}></span>
        <span class="party-name">{p.name}</span>
        <button
          type="button"
          class="only"
          onclick={(e) => {
            e.preventDefault();
            showOnly(p.slug);
          }}
          title="Show only {p.name}"
        >only</button>
      </label>
    {/each}
    <div class="toggle-actions">
      <button type="button" onclick={showMajorsOnly}>Majors only</button>
      <button type="button" onclick={showAll}>Show all</button>
    </div>
  </fieldset>

  <p class="muted small">
    Definitions and caveats live in the <a href="/methodology">methodology</a>
    page. UK locals run on a 4-year cycle, with different councils
    polling in different years — so vote and seat share are only
    directly comparable between elections four years apart (e.g. 2022
    vs 2026, or 2021 vs 2025).
  </p>
</main>

<style>
  h2 {
    margin-top: 2rem;
  }
  .small {
    font-size: 0.85rem;
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
  .chartwrap {
    margin: 0.6rem 0 0.4rem;
  }
  .chartwrap svg {
    width: 100%;
    height: auto;
    display: block;
  }
  fieldset.toggles {
    border: 1px solid var(--rule);
    border-radius: 5px;
    padding: 0.6rem 1rem 1rem;
    margin: 1rem 0 1.5rem;
  }
  fieldset.toggles legend {
    padding: 0 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0.25rem 0.8rem 0.25rem 0;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .toggle.off .party-name {
    color: var(--muted);
    text-decoration: line-through;
  }
  .toggle .swatch-line {
    display: inline-block;
    width: 1.4rem;
    height: 0.2rem;
    border-radius: 1px;
  }
  .toggle.off .swatch-line {
    opacity: 0.35;
  }
  .toggle .only {
    border: 1px solid var(--rule);
    background: transparent;
    color: var(--muted);
    font-size: 0.7rem;
    padding: 0.05rem 0.35rem;
    border-radius: 2px;
    cursor: pointer;
    margin-left: 0.2rem;
  }
  .toggle .only:hover {
    color: var(--fg);
    border-color: var(--fg);
  }
  .toggle-actions {
    display: inline-block;
    margin-top: 0.4rem;
  }
  .toggle-actions button {
    border: 1px solid var(--rule);
    background: var(--bg);
    color: var(--fg);
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
    margin-right: 0.4rem;
    cursor: pointer;
    border-radius: 3px;
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
    text-decoration: none;
  }
  .card:hover {
    border-color: var(--accent-color, var(--accent));
    text-decoration: none;
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
  .card .chev {
    color: var(--muted);
    font-size: 1.1rem;
    transition: transform 0.15s ease;
  }
  .card:hover .chev {
    color: var(--accent-color, var(--accent));
    transform: translateX(2px);
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
