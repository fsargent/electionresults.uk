<script lang="ts">
  import { pct, pts } from '$lib/format';
  import ShareButton from '$lib/share/ShareButton.svelte';

  export interface SlopePoint {
    year: number;
    voteShare: number;
    /** Optional. When present on every point, renders a paired seat-share
     *  polyline (dashed line, hollow markers) — same convention as the
     *  two-point mode. */
    seatShare?: number;
  }

  let {
    title,
    href,
    color,
    /** Multi-point mode. When supplied, overrides the two-point
     *  start/end props and renders a polyline through every cycle in
     *  order. Points should be sorted ascending by year; the chart
     *  positions them on the x-axis proportional to the year gap so
     *  uneven cycles (e.g. 2017 → 2019 vs 2019 → 2024) read truthfully. */
    points,
    startYear,
    startValue,
    endYear,
    endValue,
    /** Optional second slope for seat share. Renders as a dashed line
     *  with hollow endpoints when both values are supplied — mirrors
     *  the "filled votes / outlined seats" convention used by
     *  PairedBarChart so readers map the two charts together. */
    startSeatValue,
    endSeatValue,
    /** Cap for the Y axis. Auto-fits to the largest endpoint (vote or
     *  seat) when omitted, with a 5%-rounded cushion. */
    yMax,
    compact = false
  }: {
    title: string;
    href?: string;
    color: string;
    points?: SlopePoint[];
    startYear?: number;
    startValue?: number;
    endYear?: number;
    endValue?: number;
    startSeatValue?: number;
    endSeatValue?: number;
    yMax?: number;
    compact?: boolean;
  } = $props();

  // Normalise both APIs into a single points array. Two-point callers
  // keep working unchanged; multi-point callers drive the trend with
  // `points`.
  const pts_ = $derived.by<SlopePoint[]>(() => {
    if (points && points.length > 0) return points;
    if (
      startYear != null &&
      startValue != null &&
      endYear != null &&
      endValue != null
    ) {
      return [
        { year: startYear, voteShare: startValue, seatShare: startSeatValue },
        { year: endYear, voteShare: endValue, seatShare: endSeatValue }
      ];
    }
    return [];
  });

  const hasSeats = $derived(
    pts_.length > 0 && pts_.every((p) => p.seatShare != null)
  );

  const computedYMax = $derived.by(() => {
    if (yMax != null) return yMax;
    const values = pts_.flatMap((p) =>
      p.seatShare != null ? [p.voteShare, p.seatShare] : [p.voteShare]
    );
    const raw = Math.max(...values, 0);
    if (raw <= 0) return 0.1;
    return Math.min(1, Math.max(0.1, Math.ceil(raw * 20) / 20));
  });

  const W = $derived(compact ? 220 : 320);
  const H = $derived(compact ? 140 : 180);
  // Right padding intentionally larger than left to give the last-year
  // axis label (text-anchor=middle at the right data point) room to sit
  // without clipping the trailing digit. Same reason on the left, but
  // labels there are shorter and clip less often in practice.
  const PAD = $derived(
    compact
      ? { l: 14, r: 22, t: 26, b: 28 }
      : { l: 20, r: 30, t: 28, b: 32 }
  );

  const innerW = $derived(W - PAD.l - PAD.r);
  const innerH = $derived(H - PAD.t - PAD.b);

  // Proportional x-positioning by year so a 5-year gap reads wider than
  // a 2-year gap. With only one point, fall back to the left edge.
  const xMin = $derived(pts_.length > 0 ? pts_[0].year : 0);
  const xMax = $derived(
    pts_.length > 0 ? pts_[pts_.length - 1].year : 1
  );
  function x(year: number): number {
    if (xMax === xMin) return PAD.l + innerW / 2;
    return PAD.l + ((year - xMin) / (xMax - xMin)) * innerW;
  }
  function y(v: number): number {
    return (
      PAD.t + (1 - Math.max(0, Math.min(computedYMax, v)) / computedYMax) * innerH
    );
  }

  const votePath = $derived(
    pts_.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.year)} ${y(p.voteShare)}`).join(' ')
  );
  const seatPath = $derived(
    hasSeats
      ? pts_
          .map(
            (p, i) =>
              `${i === 0 ? 'M' : 'L'} ${x(p.year)} ${y(p.seatShare as number)}`
          )
          .join(' ')
      : ''
  );

  const first = $derived(pts_[0]);
  const last = $derived(pts_[pts_.length - 1]);
  const delta = $derived(
    pts_.length >= 2 ? last.voteShare - first.voteShare : 0
  );
  const trend = $derived(
    Math.abs(delta) < 0.005 ? 'flat' : delta > 0 ? 'up' : 'down'
  );
  const seatDelta = $derived(
    hasSeats && pts_.length >= 2
      ? (last.seatShare as number) - (first.seatShare as number)
      : 0
  );
  const seatTrend = $derived(
    Math.abs(seatDelta) < 0.005 ? 'flat' : seatDelta > 0 ? 'up' : 'down'
  );

  // Above-line for the higher endpoint, below-line for the lower one
  // at each end of the slope. Keeps vote and seat labels from
  // colliding when they're close together.
  function labelOffset(value: number, otherValue: number): number {
    return value >= otherValue ? -8 : 14;
  }

  // Relative luminance of a #rrggbb (or #rgb) hex string, 0–1.
  // Used to detect party colours (e.g. SNP yellow #FDF38E) that wash
  // out against the default cream panel background and need a darker
  // contrast plate to stay legible.
  function relLuminance(hex: string): number {
    let h = hex.replace('#', '');
    if (h.length === 3) {
      h = h.split('').map((c) => c + c).join('');
    }
    if (h.length !== 6) return 0.5;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  // Anything brighter than this needs the dark contrast plate. Picked
  // by eyeballing SNP yellow (#FDF38E ≈ 0.86) and Lib-Dem orange
  // (#FAA61A ≈ 0.47) — we want the former on a dark plate, the latter
  // on the default cream.
  const needsDarkPlate = $derived(relLuminance(color) > 0.65);

  const ariaLabel = $derived(
    pts_.length >= 2
      ? `${title} trend from ${first.year} to ${last.year}`
      : title
  );

  // Export metadata for the share button. Subtitle states what the
  // chart is measuring and the year span so the downloaded image makes
  // sense out of context.
  const shareSubtitle = $derived(
    pts_.length >= 2
      ? hasSeats
        ? `Vote and seat share, ${first.year} → ${last.year}`
        : `Vote share, ${first.year} → ${last.year}`
      : ''
  );
  const shareFilename = $derived(() => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const span =
      pts_.length >= 2 ? `-${first.year}-${last.year}` : '';
    return `electionresults-uk-${slug}${span}`;
  });

  let figureRef: HTMLElement | undefined = $state();
</script>

<figure
  class="slope share-host"
  class:compact
  class:dark-plate={needsDarkPlate}
  bind:this={figureRef}
>
  <figcaption class="title" style:--row-color={color}>
    {#if href}
      <a href={href}>{title}</a>
    {:else}
      <span>{title}</span>
    {/if}
    {#if needsDarkPlate}
      <!-- Plain CSS hover tooltip on a static <span>; no JS state
           needed and screen readers pick up the aria-label. Kept inside
           the figcaption so it sits to the right of the title across
           every layout breakpoint. -->
      <span
        class="dark-plate-info"
        role="img"
        aria-label="Why is this dark? {title}'s colour is too pale to read against the standard background, so this chart gets a dark plate."
        tabindex="0"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4" />
          <circle cx="8" cy="4.4" r="1" fill="currentColor" />
          <rect x="7.1" y="6.6" width="1.8" height="5.4" rx="0.6" fill="currentColor" />
        </svg>
        <span class="tooltip" role="tooltip">
          <strong>Why is this dark?</strong>
          {title}'s colour is unreadable against the normal background,
          so it gets special treatment.
        </span>
      </span>
    {/if}
  </figcaption>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label={ariaLabel}>
    <line
      x1={PAD.l}
      x2={W - PAD.r}
      y1={y(0)}
      y2={y(0)}
      stroke={needsDarkPlate ? 'rgba(255,255,255,0.25)' : 'var(--rule)'}
      stroke-width="1"
    />
    <!-- Vote trend: solid polyline, filled circles. -->
    {#if pts_.length >= 2}
      <path
        d={votePath}
        fill="none"
        stroke={color}
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}
    {#each pts_ as p (p.year)}
      <circle cx={x(p.year)} cy={y(p.voteShare)} r="4" fill={color}>
        <title>Vote share &mdash; {p.year}: {pct(p.voteShare, 1)}</title>
      </circle>
    {/each}

    {#if hasSeats}
      <!-- Seat trend: dashed polyline, hollow circles. -->
      {#if pts_.length >= 2}
        <path
          d={seatPath}
          fill="none"
          stroke={color}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="4 3"
          opacity="0.85"
        />
      {/if}
      {#each pts_ as p (p.year)}
        <circle
          cx={x(p.year)}
          cy={y(p.seatShare as number)}
          r="3.6"
          fill={needsDarkPlate ? '#262a33' : 'var(--bg)'}
          stroke={color}
          stroke-width="2"
        >
          <title>Seat share &mdash; {p.year}: {pct(p.seatShare as number, 1)}</title>
        </circle>
      {/each}
    {/if}

    <!-- Endpoint value labels only — intermediate points read via the
         circle <title> tooltips so a 5-cycle trend stays legible. -->
    {#if pts_.length > 0}
      <text
        x={x(first.year)}
        y={y(first.voteShare) + labelOffset(first.voteShare, first.seatShare ?? -1)}
        text-anchor="middle"
        font-size="11"
        fill={needsDarkPlate ? '#f4f4ef' : 'var(--fg)'}
        font-weight="600"
      >
        {pct(first.voteShare, 0)}
      </text>
      {#if pts_.length >= 2}
        <text
          x={x(last.year)}
          y={y(last.voteShare) + labelOffset(last.voteShare, last.seatShare ?? -1)}
          text-anchor="middle"
          font-size="11"
          fill="var(--fg)"
          font-weight="600"
        >
          {pct(last.voteShare, 0)}
        </text>
      {/if}

      {#if hasSeats}
        <text
          x={x(first.year)}
          y={y(first.seatShare as number) + labelOffset(first.seatShare as number, first.voteShare)}
          text-anchor="middle"
          font-size="10"
          fill={needsDarkPlate ? 'rgba(244,244,239,0.78)' : 'var(--muted)'}
          font-weight="500"
        >
          {pct(first.seatShare as number, 0)}
        </text>
        {#if pts_.length >= 2}
          <text
            x={x(last.year)}
            y={y(last.seatShare as number) + labelOffset(last.seatShare as number, last.voteShare)}
            text-anchor="middle"
            font-size="10"
            fill={needsDarkPlate ? 'rgba(244,244,239,0.78)' : 'var(--muted)'}
            font-weight="500"
          >
            {pct(last.seatShare as number, 0)}
          </text>
        {/if}
      {/if}

      <text x={x(first.year)} y={H - PAD.b + 14} text-anchor="middle" font-size="11" fill={needsDarkPlate ? 'rgba(244,244,239,0.78)' : 'var(--muted)'}>
        {first.year}
      </text>
      {#if pts_.length >= 2}
        <text x={x(last.year)} y={H - PAD.b + 14} text-anchor="middle" font-size="11" fill={needsDarkPlate ? 'rgba(244,244,239,0.78)' : 'var(--muted)'}>
          {last.year}
        </text>
      {/if}
    {/if}
  </svg>
  <p class="delta-row">
    <span
      class="delta"
      class:up={trend === 'up'}
      class:down={trend === 'down'}
      class:flat={trend === 'flat'}
    >
      <svg
        class="glyph"
        viewBox="0 0 22 10"
        aria-hidden="true"
      >
        <line x1="2" y1="5" x2="20" y2="5" stroke={color} stroke-width="2" stroke-linecap="round" />
        <circle cx="11" cy="5" r="3.2" fill={color} />
      </svg>
      <span class="kind">votes</span>
      <span class="value">{pts(delta, 0)}</span>
    </span>
    {#if hasSeats}
      <span
        class="delta"
        class:up={seatTrend === 'up'}
        class:down={seatTrend === 'down'}
        class:flat={seatTrend === 'flat'}
      >
        <svg
          class="glyph"
          viewBox="0 0 22 10"
          aria-hidden="true"
        >
          <line
            x1="2"
            y1="5"
            x2="20"
            y2="5"
            stroke={color}
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-dasharray="3 2"
            opacity="0.85"
          />
          <circle
            cx="11"
            cy="5"
            r="3"
            fill={needsDarkPlate ? '#262a33' : 'var(--bg)'}
            stroke={color}
            stroke-width="1.6"
          />
        </svg>
        <span class="kind">seats</span>
        <span class="value">{pts(seatDelta, 0)}</span>
      </span>
    {/if}
  </p>
  <ShareButton
    source={figureRef}
    title={title}
    subtitle={shareSubtitle}
    filename={shareFilename()}
  />
</figure>

<style>
  .slope {
    margin: 0;
    padding: 0.5rem 0.6rem 0.4rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .title {
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0 0 0.2rem;
    border-left: 3px solid var(--row-color, var(--accent));
    padding-left: 0.4rem;
    line-height: 1.2;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .title > a,
  .title > span:not(.dark-plate-info) {
    flex: 1;
    min-width: 0;
  }
  .dark-plate-info {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    color: rgba(244, 244, 239, 0.65);
    cursor: help;
    border-radius: 50%;
  }
  .dark-plate-info svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .dark-plate-info:hover,
  .dark-plate-info:focus-visible {
    color: rgba(244, 244, 239, 0.95);
    outline: none;
  }
  .dark-plate-info .tooltip {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: -0.25rem;
    width: 16rem;
    max-width: 80vw;
    padding: 0.5rem 0.7rem;
    background: #1a1d24;
    color: #f4f4ef;
    border: 1px solid rgba(244, 244, 239, 0.2);
    border-radius: 4px;
    font-size: 0.78rem;
    font-weight: 400;
    line-height: 1.35;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-2px);
    transition:
      opacity 120ms ease-out,
      visibility 0s linear 120ms,
      transform 120ms ease-out;
    z-index: 10;
    pointer-events: none;
  }
  .dark-plate-info .tooltip strong {
    display: block;
    margin-bottom: 0.2rem;
    font-weight: 600;
  }
  .dark-plate-info:hover .tooltip,
  .dark-plate-info:focus-visible .tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition:
      opacity 120ms ease-out,
      visibility 0s,
      transform 120ms ease-out;
  }
  .title a {
    color: inherit;
    text-decoration: none;
  }
  .title a:hover {
    text-decoration: underline;
    text-decoration-color: var(--row-color, var(--accent));
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .delta-row {
    margin: 0.1rem 0 0;
    display: flex;
    justify-content: center;
    gap: 0.7rem;
    flex-wrap: wrap;
  }
  .delta {
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .delta .glyph {
    width: 1.4rem;
    height: 0.6rem;
    display: inline-block;
    flex-shrink: 0;
  }
  .delta .kind {
    font-size: 0.68rem;
    color: var(--muted);
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }
  .delta .value {
    font-weight: inherit;
  }
  .delta.up .value {
    color: #1c7a3a;
    font-weight: 600;
  }
  .delta.down .value {
    color: var(--warn);
    font-weight: 600;
  }
  .slope.compact {
    padding: 0.4rem 0.5rem 0.3rem;
  }
  /* Pale party colours (e.g. SNP yellow) get a slate plate so the line
     and markers stay legible. Text and rule colours inside the SVG are
     already inverted via the inline fills. */
  .slope.dark-plate {
    background: #262a33;
    border-color: #262a33;
    color: #f4f4ef;
  }
  .slope.dark-plate .title {
    color: #f4f4ef;
  }
  .slope.dark-plate .delta {
    color: rgba(244, 244, 239, 0.78);
  }
  .slope.dark-plate .delta .kind {
    color: rgba(244, 244, 239, 0.7);
  }
  .slope.dark-plate .delta.up .value {
    color: #6fd494;
  }
  .slope.dark-plate .delta.down .value {
    color: #ff9d8a;
  }
</style>
