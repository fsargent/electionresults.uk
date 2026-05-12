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
    /** Cap for the Y axis. 0–50% by default; lift for outliers. */
    yMax = 0.5,
    compact = false
  }: {
    title: string;
    href?: string;
    color: string;
    startYear: number;
    startValue: number;
    endYear: number;
    endValue: number;
    yMax?: number;
    compact?: boolean;
  } = $props();

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
    return PAD.t + (1 - Math.max(0, Math.min(yMax, v)) / yMax) * innerH;
  }
  const x1 = $derived(PAD.l);
  const x2 = $derived(W - PAD.r);
  const delta = $derived(endValue - startValue);
  const trend = $derived(
    Math.abs(delta) < 0.005 ? 'flat' : delta > 0 ? 'up' : 'down'
  );
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
    <line
      x1={x1}
      y1={y(startValue)}
      x2={x2}
      y2={y(endValue)}
      stroke={color}
      stroke-width="2.5"
      stroke-linecap="round"
    />
    <circle cx={x1} cy={y(startValue)} r="5" fill={color} />
    <circle cx={x2} cy={y(endValue)} r="5" fill={color} />

    <text x={x1} y={y(startValue) - 10} text-anchor="middle" font-size="11" fill="var(--fg)" font-weight="600">
      {pct(startValue, 0)}
    </text>
    <text x={x2} y={y(endValue) - 10} text-anchor="middle" font-size="11" fill="var(--fg)" font-weight="600">
      {pct(endValue, 0)}
    </text>

    <text x={x1} y={H - PAD.b + 14} text-anchor="middle" font-size="11" fill="var(--muted)">
      {startYear}
    </text>
    <text x={x2} y={H - PAD.b + 14} text-anchor="middle" font-size="11" fill="var(--muted)">
      {endYear}
    </text>
  </svg>
  <p class="delta" class:up={trend === 'up'} class:down={trend === 'down'} class:flat={trend === 'flat'}>
    {pts(delta, 0)}
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
  .delta {
    margin: 0.1rem 0 0;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: var(--muted);
  }
  .delta.up {
    color: #1c7a3a;
    font-weight: 600;
  }
  .delta.down {
    color: var(--warn);
    font-weight: 600;
  }
  .slope.compact {
    padding: 0.4rem 0.5rem 0.3rem;
  }
</style>
