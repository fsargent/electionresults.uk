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
    title?: string;
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
        points: hexPolygonPoints(h.x, h.y, HEX_SIZE)
      };
    })
  );
</script>

<figure class="hex-map">
  <svg
    viewBox={`0 0 ${layout.width} ${layout.height}`}
    role="img"
    aria-label={title}
    preserveAspectRatio="xMidYMid meet"
  >
    {#each items as item (item.slug)}
      {#if item.href}
        <a href={item.href}>
          <polygon
            points={item.points}
            fill={item.color}
            stroke={STROKE}
            stroke-width="0.8"
            stroke-linejoin="round"
          ><title>{item.title}</title></polygon>
        </a>
      {:else}
        <polygon
          points={item.points}
          fill={item.color}
          stroke={STROKE}
          stroke-width="0.8"
          stroke-linejoin="round"
        ><title>{item.title}</title></polygon>
      {/if}
    {/each}
  </svg>
</figure>

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
</style>
