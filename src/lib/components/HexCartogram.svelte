<script lang="ts">
  import { hexPolygonPoints, layoutHexes, HEX_SIZE } from '$lib/hexmap/geometry';

  export interface HexInput {
    /** Unique key — looked up against `fills` directly. */
    id: string;
    /** Display name used in the default tooltip primary. */
    name: string;
    /** Hex-grid coordinates (odd-r offset). */
    q: number;
    r: number;
    /** Alternative keys to try when `fills[id]` misses (handles source
     *  naming inconsistencies, e.g. council LEH renames year-over-year). */
    aliases?: string[];
    /** Optional default href when the parent does not supply one in the
     *  fill — typically "drill into this hex regardless of state". */
    defaultHref?: string;
  }

  export interface HexFill {
    color: string;
    href?: string;
    /** Plain-text title used by the SVG <title> for accessibility. */
    title?: string;
    /** Headline label in the rich hover tooltip. */
    primary?: string;
    /** Secondary line in the rich hover tooltip. */
    secondary?: string;
    /** Optional color square shown to the left of the tooltip primary. */
    swatchColor?: string;
    /** Optional override for the polygon outline (e.g. coloured highlight). */
    stroke?: string;
    /** Stroke width in viewport units. Sensible range: 0.6 (default) to 3. */
    strokeWidth?: number;
    /** Mid-count highlight — dashed contrasting outline that rides on top
     *  of any colour the hex already has. The tooltip appends a coverage
     *  line built from this object. */
    incomplete?: { wardsCounted: number; wardsExpected: number };
  }

  let {
    hexes,
    fills,
    title = 'UK hex cartogram'
  }: {
    hexes: HexInput[];
    fills: Record<string, HexFill>;
    title?: string;
  } = $props();

  const NEUTRAL_FILL = '#e5e3d6';
  const STROKE = 'rgba(255, 255, 255, 0.85)';
  // Dashed dark outline used to mark mid-count cells. Sits on top of
  // whichever fill is already there so any state we already know about
  // (party colour, distortion shade) still reads through.
  const INCOMPLETE_STROKE = '#1f2330';
  const INCOMPLETE_DASH = '1.4 1.0';
  const INCOMPLETE_STROKE_WIDTH = 1.4;

  const layout = $derived(layoutHexes(hexes, HEX_SIZE));

  const items = $derived(
    layout.positions.map((h) => {
      let fill: HexFill | undefined = fills[h.id];
      if (!fill && h.aliases) {
        for (const a of h.aliases) {
          if (fills[a]) {
            fill = fills[a];
            break;
          }
        }
      }
      const incomplete = fill?.incomplete;
      const incompleteLine = incomplete
        ? `${incomplete.wardsCounted} of ${incomplete.wardsExpected} wards counted`
        : null;
      const baseSecondary = fill?.secondary ?? null;
      const secondary = incompleteLine
        ? baseSecondary
          ? `${baseSecondary} · ${incompleteLine}`
          : incompleteLine
        : baseSecondary;
      return {
        id: h.id,
        name: h.name,
        x: h.x,
        y: h.y,
        color: fill?.color ?? NEUTRAL_FILL,
        href: fill?.href ?? h.defaultHref,
        title: fill?.title ?? h.name,
        primary: fill?.primary ?? h.name,
        secondary,
        swatchColor: fill?.swatchColor ?? null,
        stroke: fill?.stroke ?? (incomplete ? INCOMPLETE_STROKE : STROKE),
        strokeWidth:
          fill?.strokeWidth ?? (incomplete ? INCOMPLETE_STROKE_WIDTH : 0.8),
        strokeDasharray: fill?.stroke ? null : incomplete ? INCOMPLETE_DASH : null,
        points: hexPolygonPoints(h.x, h.y, HEX_SIZE)
      };
    })
  );

  type Tooltip = {
    x: number;
    y: number;
    primary: string;
    secondary: string | null;
    swatchColor: string | null;
  };
  let tooltip: Tooltip | null = $state(null);

  function showTooltip(event: MouseEvent, item: (typeof items)[number]) {
    tooltip = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
      primary: item.primary,
      secondary: item.secondary,
      swatchColor: item.swatchColor
    };
  }

  function moveTooltip(event: MouseEvent) {
    if (!tooltip) return;
    tooltip = {
      ...tooltip,
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY
    };
  }

  function hideTooltip() {
    tooltip = null;
  }

  function navigate(href: string | undefined) {
    if (href) window.location.href = href;
  }
</script>

<figure class="hex-map">
  <svg
    viewBox={`0 0 ${layout.width} ${layout.height}`}
    role="img"
    aria-label={title}
    preserveAspectRatio="xMidYMid meet"
    onmousemove={moveTooltip}
    onmouseleave={hideTooltip}
  >
    {#each items as item (item.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        class="hex-hit"
        class:clickable={!!item.href}
        class:emphasised={item.strokeWidth > 1}
        onmouseenter={(e) => showTooltip(e, item)}
        onclick={() => navigate(item.href)}
      >
        <polygon
          points={item.points}
          fill={item.color}
          stroke={item.stroke}
          stroke-width={item.strokeWidth}
          stroke-linejoin="round"
          stroke-dasharray={item.strokeDasharray}
        ></polygon>
      </g>
    {/each}
  </svg>
</figure>

{#if tooltip}
  <div
    class="hex-tooltip"
    style:left={`${tooltip.x}px`}
    style:top={`${tooltip.y}px`}
    role="tooltip"
  >
    <div class="primary">
      {#if tooltip.swatchColor}
        <span
          class="tooltip-swatch"
          aria-hidden="true"
          style:background-color={tooltip.swatchColor}
        ></span>
      {/if}{tooltip.primary}
    </div>
    {#if tooltip.secondary}
      <div class="secondary">{tooltip.secondary}</div>
    {/if}
  </div>
{/if}

<style>
  .hex-map {
    margin: 0;
    max-width: 38rem;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    background: var(--bg);
  }
  svg polygon {
    transition: filter 0.1s, stroke-width 0.1s;
  }
  .hex-hit.clickable {
    cursor: pointer;
  }
  .hex-hit.clickable:not(.emphasised):hover polygon {
    filter: brightness(1.1) saturate(1.1);
    stroke-width: 1.5;
    stroke: var(--fg);
  }
  .hex-hit.emphasised.clickable:hover polygon {
    filter: brightness(1.1) saturate(1.15);
  }
  .hex-tooltip {
    position: absolute;
    pointer-events: none;
    transform: translate(0.9rem, -100%);
    margin-top: -0.4rem;
    background: var(--fg);
    color: var(--bg);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    line-height: 1.25;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
    max-width: 16rem;
  }
  .hex-tooltip .primary {
    font-weight: 600;
  }
  .hex-tooltip .tooltip-swatch {
    display: inline-block;
    width: 0.7em;
    height: 0.7em;
    border-radius: 2px;
    margin-right: 0.4em;
    vertical-align: -0.05em;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  .hex-tooltip .secondary {
    opacity: 0.8;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  @media (hover: none) {
    .hex-tooltip { display: none; }
  }
</style>
