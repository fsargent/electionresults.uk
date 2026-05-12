<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import type { PartyYearStats } from '$lib/types';

  let { data } = $props();

  // Persisted UI state across navigation. We use localStorage rather
  // than URL query params so the user's choices follow them around the
  // site (drilling into /labour and back) without polluting the URL or
  // breaking prerender. Reads happen in an onMount-style $effect after
  // hydration; the SSR pass uses defaults so the prerendered HTML is
  // stable and uniform for all visitors.
  const STORAGE_KEY_METRIC = 'er-uk:parties:metric';
  const STORAGE_KEY_VISIBILITY = 'er-uk:parties:visibility';

  // Toggle state per party slug. Initialised from the server's
  // defaultVisible set (majors on, regionals off) but the user can
  // turn anything on/off interactively. Initial values only — the
  // server data is prerendered and does not change at runtime, so
  // referencing `data` here is intentional.
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

  // Active metric: chamber share is comparable across all years and is
  // the headline by default. Vote/seat share are election-only and
  // need cycle-pair caveats — we offer them but mark accordingly.
  type Metric = 'chamberShare' | 'voteShare' | 'seatShare';
  let metric = $state<Metric>('chamberShare');
  const metricLabels: Record<Metric, string> = {
    chamberShare: 'Chamber share (rolled forward)',
    voteShare: 'Vote share (election only)',
    seatShare: 'Seat share of seats up (election only)'
  };
  const metricCaveats: Record<Metric, string> = {
    chamberShare:
      'Share of all council seats this party holds across every council with composition data. Comparable across the full window — composition rolls forward year-on-year.',
    voteShare:
      'Share of valid votes in the cycle’s elections. UK locals run on overlapping 4-year cycles; the same set of councils typically polls four years apart. Compare 2022 to 2026, or 2021 to 2025 — but not 2025 to 2026.',
    seatShare:
      'Share of seats up that this party won. Same cycle-pair caveat as vote share — compare years four cycles apart.'
  };

  // Plot dimensions. Two stacked plots in this page would be visual
  // noise — instead we surface one big plot whose metric is user-
  // toggled, plus a secondary cycle-family vote-share view inside the
  // table-of-cards section below.
  const W = 760;
  const H = 320;
  const PAD = { l: 48, r: 16, t: 16, b: 36 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  // X-axis range is metric-aware: chamber-share uses the full window
  // (composition rolls forward from 2016), but vote-share and seat-share
  // only have data from 2021 onwards (the LEH workbooks our ETL covers).
  // Clipping the axis to election years for those metrics avoids the
  // misleading "lines hugging the floor" stretch on the left.
  const yearsForMetric = $derived.by(() => {
    if (metric === 'chamberShare') {
      return data.years.filter((y) =>
        data.parties.some((p) =>
          p.trend.some((s) => s.year === y && s.chamberTotal > 0)
        )
      );
    }
    return data.years.filter((y) =>
      data.parties.some((p) =>
        p.trend.some((s) => s.year === y && s.contestedSeats > 0)
      )
    );
  });
  const minYear = $derived(
    yearsForMetric.length > 0 ? Math.min(...yearsForMetric) : Math.min(...data.years)
  );
  const maxYear = $derived(
    yearsForMetric.length > 0 ? Math.max(...yearsForMetric) : Math.max(...data.years)
  );
  const yearSpan = $derived(Math.max(1, maxYear - minYear));

  function xFor(year: number): number {
    return PAD.l + ((year - minYear) / yearSpan) * innerW;
  }
  function yFor(share: number): number {
    return PAD.t + (1 - share / yMax) * innerH;
  }

  // Auto-fit Y axis to the visible data + selected metric. Round up to
  // the next 10% so the gridlines stay readable.
  const yMax = $derived.by(() => {
    let raw = 0;
    for (const p of visibleParties) {
      for (const s of p.trend) {
        if (metric === 'voteShare' && s.contestedSeats === 0) continue;
        if (metric === 'seatShare' && s.contestedSeats === 0) continue;
        if (metric === 'chamberShare' && s.chamberTotal === 0) continue;
        const v = s[metric];
        if (v > raw) raw = v;
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
  // Hydrate stored selection on the client (SSR can't read
  // localStorage). Wrap reads in try/catch so a corrupt value or a
  // strict storage policy (Safari private mode) just falls back to
  // defaults instead of crashing the page.
  let hydrated = $state(false);
  $effect(() => {
    if (hydrated) return;
    try {
      const m = localStorage.getItem(STORAGE_KEY_METRIC);
      if (m === 'chamberShare' || m === 'voteShare' || m === 'seatShare') {
        metric = m;
      }
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
  // Write-through after hydration. Skipping pre-hydration writes avoids
  // overwriting stored values with the defaults during the initial pass.
  $effect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY_METRIC, metric);
    } catch {}
  });
  $effect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(visibility));
    } catch {}
  });

  // For chamber metric: a single continuous line per party.
  // For vote/seat metric: split into cycle families so we don't draw
  // misleading inter-family connector segments.
  function plotPoints(
    party: typeof data.parties[number]
  ): { line: PartyYearStats[]; family: number }[] {
    const usable = party.trend.filter((s) => {
      if (metric === 'chamberShare') return s.chamberTotal > 0;
      return s.contestedSeats > 0;
    });
    if (metric === 'chamberShare') {
      return [{ line: usable.sort((a, b) => a.year - b.year), family: -1 }];
    }
    const byFamily = new Map<number, PartyYearStats[]>();
    for (const s of usable) {
      const arr = byFamily.get(s.cycleFamily) ?? [];
      arr.push(s);
      byFamily.set(s.cycleFamily, arr);
    }
    return [...byFamily.entries()]
      .map(([family, line]) => ({
        family,
        line: line.sort((a, b) => a.year - b.year)
      }))
      .sort((a, b) => a.family - b.family);
  }

  // Tooltip shown on hover over a data point.
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
    if (metric === 'chamberShare') {
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
    if (metric === 'voteShare') {
      return {
        x: cx,
        y: cy,
        party: party.name,
        color: partyColor(party.name),
        year: s.year,
        primary: `${pct(s.voteShare)}`,
        secondary: `${num(s.votes)} votes across ${num(s.councilsContested)} councils`
      };
    }
    return {
      x: cx,
      y: cy,
      party: party.name,
      color: partyColor(party.name),
      year: s.year,
      primary: `${pct(s.seatShare)}`,
      secondary: `${num(s.seatsWon)} of ${num(s.contestedSeats)} seats up`
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
    content="UK major parties at local-government level — vote share, seat share, and chamber composition compared across 2016–2026."
  />
  <link rel="canonical" href="https://electionresults.uk/parties" />
</svelte:head>

<main class="wide">
  <h1>Parties</h1>

  <p>
    The seven national parties active in UK local government, compared
    on one chart. Click any card to drill in to that party's full
    history, or any data point on the chart to jump to that party-year.
  </p>

  <div class="metric-tabs" role="tablist" aria-label="Metric">
    {#each (['chamberShare', 'voteShare', 'seatShare'] as Metric[]) as m (m)}
      <button
        role="tab"
        type="button"
        aria-selected={metric === m}
        class:active={metric === m}
        onclick={() => (metric = m)}
      >
        {metricLabels[m]}
      </button>
    {/each}
  </div>

  <p class="muted caveat">
    {metricCaveats[metric]}
  </p>

  <div class="chartwrap">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Party comparison chart">
      <!-- Y gridlines -->
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
      <!-- X labels (every other year if span is wide) -->
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

      <!-- Party lines -->
      {#each visibleParties as party (party.slug)}
        {@const color = partyColor(party.name)}
        {#each plotPoints(party) as group (group.family)}
          {#if group.line.length >= 2}
            <polyline
              points={group.line
                .map((s) => `${xFor(s.year)},${yFor(s[metric])}`)
                .join(' ')}
              fill="none"
              stroke={color}
              stroke-width="2.4"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/if}
          {#each group.line as s (s.year)}
            {@const cx = xFor(s.year)}
            {@const cy = yFor(s[metric])}
            {@const href = s.contestedSeats > 0
              ? `/${party.slug}/${s.year}`
              : `/${party.slug}`}
            <a
              href={href}
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

  <h2>Party cards</h2>
  <p class="muted">
    Latest snapshot for each party, sorted by current chamber share.
  </p>

  <div class="cards">
    {#each orderedCards as p (p.slug)}
      {@const color = partyColor(p.name)}
      {@const latest = p.latest}
      {@const earliest = p.trend.filter((s) => s.chamberTotal > 0)[0]}
      {@const swing = latest && earliest
        ? latest.chamberShare - earliest.chamberShare
        : null}
      <a class="card" href="/{p.slug}" style:--accent-color={color}>
        <header>
          <span class="swatch" style:background={color} aria-hidden="true"></span>
          <h3>{p.name}</h3>
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
              chamber share.
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

  <p class="muted">
    Definitions and caveats live in the <a href="/methodology">methodology</a>
    page. UK locals run on a 4-year cycle, with different councils
    polling in different years — so vote and seat share are only
    directly comparable between elections four years apart (e.g. 2022
    vs 2026, or 2021 vs 2025).
  </p>
</main>

<style>
  .metric-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 1rem 0 0.4rem;
  }
  .metric-tabs button {
    border: 1px solid var(--rule);
    background: var(--bg);
    color: var(--fg);
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    font-size: 0.9rem;
    border-radius: 3px;
  }
  .metric-tabs button.active {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .caveat {
    font-size: 0.85rem;
    margin-top: 0.4rem;
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
