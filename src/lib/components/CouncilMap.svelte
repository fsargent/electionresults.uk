<script lang="ts">
  import mapData from '$lib/data/map.json';

  interface CouncilFill {
    /** Hex fill colour for this council */
    color: string;
    /** Optional URL the path should link to (e.g. /[year]/[slug]) */
    href?: string;
    /** Optional accessible title (e.g. "Northumberland — 75.4% below quota") */
    title?: string;
  }

  let {
    fills,
    legendLabel = 'Choropleth: % of seats elected below the proportional quota'
  }: {
    fills: Record<string, CouncilFill>;
    legendLabel?: string;
  } = $props();

  const NEUTRAL_FILL = '#e5e3d6';
  const STROKE = 'rgba(255, 255, 255, 0.8)';

  // Pre-resolve so we don't re-lookup in the template.
  const items = $derived(
    Object.entries(mapData.shapes).map(([slug, shape]) => {
      const fill = fills[slug];
      return {
        slug,
        name: shape.name,
        d: shape.d,
        color: fill?.color ?? NEUTRAL_FILL,
        href: fill?.href,
        title: fill?.title ?? shape.name
      };
    })
  );
</script>

<figure class="map">
  <svg
    viewBox={mapData.viewBox}
    role="img"
    aria-label={legendLabel}
    preserveAspectRatio="xMidYMid meet"
  >
    {#each items as item (item.slug)}
      {#if item.href}
        <a href={item.href}>
          <path
            d={item.d}
            fill={item.color}
            stroke={STROKE}
            stroke-width="0.5"
            stroke-linejoin="round"
          ><title>{item.title}</title></path>
        </a>
      {:else}
        <path
          d={item.d}
          fill={item.color}
          stroke={STROKE}
          stroke-width="0.5"
          stroke-linejoin="round"
        ><title>{item.title}</title></path>
      {/if}
    {/each}
  </svg>
</figure>

<style>
  .map {
    margin: 0;
    max-width: 38rem;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    background: var(--bg);
  }
  svg a path {
    cursor: pointer;
    transition: filter 0.1s, stroke-width 0.1s;
  }
  svg a:hover path,
  svg a:focus path {
    filter: brightness(1.1) saturate(1.1);
    stroke-width: 1;
    stroke: var(--fg);
  }
</style>
