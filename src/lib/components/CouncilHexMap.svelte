<script lang="ts">
  import hexData from '$lib/data/hexes.json';
  import { hexPolygonPoints, layoutHexes, HEX_SIZE } from '$lib/hexmap/geometry';

  interface Hex {
    onsCode: string;
    name: string;
    slug: string;
    aliases: string[];
    q: number;
    r: number;
    region: string | null;
  }

  export interface CouncilFill {
    color: string;
    href?: string;
    /** Plain-text title used by the SVG <title> for accessibility. */
    title?: string;
    /** Headline label in the rich hover tooltip — typically the council name. */
    primary?: string;
    /** Secondary line in the rich hover tooltip — typically year + share. */
    secondary?: string;
    /** Optional color square shown to the left of the tooltip primary —
     *  e.g. the incoming party's brand colour on the flip map. */
    swatchColor?: string;
    /** Optional override for the polygon outline (e.g. to highlight
     *  gained / lost councils with a coloured ring). Falls back to
     *  the map's default white separator stroke when unset. */
    stroke?: string;
    /** Stroke width in viewport units. Sensible range: 0.8 (default)
     *  to 3 (chunky highlight). */
    strokeWidth?: number;
    /** Coverage marker for cohort councils still mid-count. When set,
     *  the polygon picks up a dashed contrasting outline (the underlying
     *  fill still shows, so any flip we can already determine surfaces),
     *  and the tooltip appends an "X of Y wards counted" line. */
    incomplete?: { wardsCounted: number; wardsExpected: number };
  }

  let {
    fills,
    title = 'UK local-authority hex cartogram'
  }: {
    fills: Record<string, CouncilFill>;
    title?: string;
  } = $props();

  const NEUTRAL_FILL = '#e5e3d6';
  const STROKE = 'rgba(255, 255, 255, 0.85)';
  // Outline used when a cohort council is still mid-count. Dark and
  // dashed so it reads as a "watch this one" highlight on top of any
  // colour we already know about (flip party, distortion shade, etc.)
  // rather than overwriting it.
  const INCOMPLETE_STROKE = '#1f2330';
  const INCOMPLETE_DASH = '1.4 1.0';
  const INCOMPLETE_STROKE_WIDTH = 1.4;

  // NI's 11 districts have used a proportional voting method since 1973,
  // so an FPTP audit has nothing to say about them. Suppress them from
  // the cartogram entirely; the "PR already exists in the UK" point is
  // made in the caption that consumers render below the map.
  const NI_REGION = 'N92000002';
  const hexes = (hexData.hexes as Hex[]).filter((h) => h.region !== NI_REGION);

  const layout = layoutHexes(
    hexes.map((h) => ({ ...h, id: h.onsCode })),
    HEX_SIZE
  );

  // Build the per-hex render input: pixel position + the fill / link from
  // the parent's `fills` map. Try the canonical slug first, then any
  // aliases (LEH naming inconsistency across years). Every hex links to
  // its council page by default — even when the parent didn't supply a
  // fill — so visitors can drill into any council shown on the map.
  const items = $derived(
    layout.positions.map((h) => {
      let fill: CouncilFill | undefined = fills[h.slug];
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
        slug: h.slug,
        name: h.name,
        x: h.x,
        y: h.y,
        color: fill?.color ?? NEUTRAL_FILL,
        href: fill?.href ?? `/${h.slug}`,
        title: fill?.title ?? h.name,
        primary: fill?.primary ?? h.name,
        secondary,
        swatchColor: fill?.swatchColor ?? null,
        // An explicit stroke override wins; otherwise an in-progress
        // council picks up the dashed highlight; otherwise the map's
        // default white separator stroke.
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
    {#each items as item (item.slug)}
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
  /* Preserve coloured-ring highlight (e.g. gained / lost councils) on
     hover — just brighten the fill so the highlight isn't lost. */
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
    /* Touch devices: skip the cursor-following tooltip; native <title>
       tap-to-show + the click-to-drill behaviour are the path. */
    .hex-tooltip { display: none; }
  }
</style>
