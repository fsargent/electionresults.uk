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

  const hexes = hexData.hexes as Hex[];

  const layout = layoutHexes(
    hexes.map((h) => ({ ...h, id: h.onsCode })),
    HEX_SIZE
  );

  // Build the per-hex render input: pixel position + the fill / link from
  // the parent's `fills` map. Try the canonical slug first, then any
  // aliases (LEH naming inconsistency across years).
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
      return {
        slug: h.slug,
        name: h.name,
        x: h.x,
        y: h.y,
        color: fill?.color ?? NEUTRAL_FILL,
        href: fill?.href,
        title: fill?.title ?? h.name,
        primary: fill?.primary ?? h.name,
        secondary: fill?.secondary ?? null,
        points: hexPolygonPoints(h.x, h.y, HEX_SIZE)
      };
    })
  );

  type Tooltip = { x: number; y: number; primary: string; secondary: string | null };
  let tooltip: Tooltip | null = $state(null);

  function showTooltip(event: MouseEvent, item: (typeof items)[number]) {
    // Position in page coordinates so the tooltip stays anchored if the
    // user scrolls while hovering.
    tooltip = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
      primary: item.primary,
      secondary: item.secondary
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
</script>

<figure class="hex-map" onmousemove={moveTooltip}>
  <svg
    viewBox={`0 0 ${layout.width} ${layout.height}`}
    role="img"
    aria-label={title}
    preserveAspectRatio="xMidYMid meet"
  >
    {#each items as item (item.slug)}
      {#if item.href}
        <a href={item.href} tabindex="-1">
          <polygon
            role="presentation"
            points={item.points}
            fill={item.color}
            stroke={STROKE}
            stroke-width="0.8"
            stroke-linejoin="round"
            onmouseenter={(e) => showTooltip(e, item)}
            onmouseleave={hideTooltip}
          ><title>{item.title}</title></polygon>
        </a>
      {:else}
        <polygon
          role="presentation"
          points={item.points}
          fill={item.color}
          stroke={STROKE}
          stroke-width="0.8"
          stroke-linejoin="round"
          onmouseenter={(e) => showTooltip(e, item)}
          onmouseleave={hideTooltip}
        ><title>{item.title}</title></polygon>
      {/if}
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
    <div class="primary">{tooltip.primary}</div>
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
  svg a polygon {
    cursor: pointer;
    transition: filter 0.1s;
  }
  svg a:hover polygon,
  svg a:focus polygon {
    filter: brightness(1.1) saturate(1.1);
    stroke-width: 1.5;
    stroke: var(--fg);
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
