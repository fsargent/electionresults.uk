<script lang="ts">
  import { pct, pts } from '$lib/format';

  let {
    title,
    href,
    color,
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
    startYear: number;
    startValue: number;
    endYear: number;
    endValue: number;
    startSeatValue?: number;
    endSeatValue?: number;
    yMax?: number;
    compact?: boolean;
  } = $props();

  const hasSeats = $derived(
    startSeatValue != null && endSeatValue != null
  );

  const computedYMax = $derived.by(() => {
    if (yMax != null) return yMax;
    const values = [startValue, endValue];
    if (hasSeats) values.push(startSeatValue as number, endSeatValue as number);
    const raw = Math.max(...values, 0);
    // Round up to the next 5% so the slope never touches the top edge.
    if (raw <= 0) return 0.1;
    return Math.min(1, Math.max(0.1, Math.ceil(raw * 20) / 20));
  });

  const W = $derived(compact ? 220 : 320);
  const H = $derived(compact ? 140 : 180);
  const PAD = $derived(
    compact
      ? { l: 12, r: 12, t: 26, b: 28 }
      : { l: 18, r: 18, t: 28, b: 32 }
  );

  const innerW = $derived(W - PAD.l - PAD.r);
  const innerH = $derived(H - PAD.t - PAD.b);

  function y(v: number): number {
    return PAD.t + (1 - Math.max(0, Math.min(computedYMax, v)) / computedYMax) * innerH;
  }
  const x1 = $derived(PAD.l);
  const x2 = $derived(W - PAD.r);
  const delta = $derived(endValue - startValue);
  const trend = $derived(
    Math.abs(delta) < 0.005 ? 'flat' : delta > 0 ? 'up' : 'down'
  );
  const seatDelta = $derived(
    hasSeats ? (endSeatValue as number) - (startSeatValue as number) : 0
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
</script>

<figure class="slope" class:compact>
  <figcaption class="title" style:--row-color={color}>
    {#if href}
      <a href={href}>{title}</a>
    {:else}
      <span>{title}</span>
    {/if}
  </figcaption>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="{title} slope from {startYear} to {endYear}">
    <line
      x1={PAD.l}
      x2={W - PAD.r}
      y1={y(0)}
      y2={y(0)}
      stroke="var(--rule)"
      stroke-width="1"
    />
    <!-- Vote slope: solid line, filled circles. -->
    <line
      x1={x1}
      y1={y(startValue)}
      x2={x2}
      y2={y(endValue)}
      stroke={color}
      stroke-width="2.5"
      stroke-linecap="round"
    />
    <circle cx={x1} cy={y(startValue)} r="5" fill={color}>
      <title>Vote share &mdash; {startYear}: {pct(startValue, 1)}</title>
    </circle>
    <circle cx={x2} cy={y(endValue)} r="5" fill={color}>
      <title>Vote share &mdash; {endYear}: {pct(endValue, 1)}</title>
    </circle>

    {#if hasSeats}
      <!-- Seat slope: dashed line, hollow circles. -->
      <line
        x1={x1}
        y1={y(startSeatValue as number)}
        x2={x2}
        y2={y(endSeatValue as number)}
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray="4 3"
        opacity="0.85"
      />
      <circle
        cx={x1}
        cy={y(startSeatValue as number)}
        r="4.5"
        fill="var(--bg)"
        stroke={color}
        stroke-width="2"
      >
        <title>Seat share &mdash; {startYear}: {pct(startSeatValue as number, 1)}</title>
      </circle>
      <circle
        cx={x2}
        cy={y(endSeatValue as number)}
        r="4.5"
        fill="var(--bg)"
        stroke={color}
        stroke-width="2"
      >
        <title>Seat share &mdash; {endYear}: {pct(endSeatValue as number, 1)}</title>
      </circle>
    {/if}

    <text
      x={x1}
      y={y(startValue) + labelOffset(startValue, startSeatValue ?? -1)}
      text-anchor="middle"
      font-size="11"
      fill="var(--fg)"
      font-weight="600"
    >
      {pct(startValue, 0)}
    </text>
    <text
      x={x2}
      y={y(endValue) + labelOffset(endValue, endSeatValue ?? -1)}
      text-anchor="middle"
      font-size="11"
      fill="var(--fg)"
      font-weight="600"
    >
      {pct(endValue, 0)}
    </text>

    {#if hasSeats}
      <text
        x={x1}
        y={y(startSeatValue as number) + labelOffset(startSeatValue as number, startValue)}
        text-anchor="middle"
        font-size="10"
        fill="var(--muted)"
        font-weight="500"
      >
        {pct(startSeatValue as number, 0)}
      </text>
      <text
        x={x2}
        y={y(endSeatValue as number) + labelOffset(endSeatValue as number, endValue)}
        text-anchor="middle"
        font-size="10"
        fill="var(--muted)"
        font-weight="500"
      >
        {pct(endSeatValue as number, 0)}
      </text>
    {/if}

    <text x={x1} y={H - PAD.b + 14} text-anchor="middle" font-size="11" fill="var(--muted)">
      {startYear}
    </text>
    <text x={x2} y={H - PAD.b + 14} text-anchor="middle" font-size="11" fill="var(--muted)">
      {endYear}
    </text>
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
            fill="var(--bg)"
            stroke={color}
            stroke-width="1.6"
          />
        </svg>
        <span class="kind">seats</span>
        <span class="value">{pts(seatDelta, 0)}</span>
      </span>
    {/if}
  </p>
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
  }
  .title {
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0 0 0.2rem;
    border-left: 3px solid var(--row-color, var(--accent));
    padding-left: 0.4rem;
    line-height: 1.2;
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
</style>
