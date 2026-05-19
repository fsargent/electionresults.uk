<script lang="ts">
  import hexData from '$lib/data/parliament/westminster-hexes.json';
  import HexCartogram, {
    type HexInput,
    type HexFill
  } from '$lib/components/HexCartogram.svelte';
  import { constituencyNameToSlug } from '$lib/parliament/constituency-slug';

  // Re-export so consuming pages don't need to know about HexCartogram.
  export type ConstituencyFill = HexFill;

  interface HexSeat {
    id: string;
    name: string;
    nation: string;
    regionCode: string;
    regionName: string;
    q: number;
    r: number;
  }

  let {
    fills,
    year,
    title = 'UK Westminster constituency hex cartogram'
  }: {
    fills: Record<string, HexFill>;
    /** Election year — used to build the default per-hex href so every
     *  constituency drills into its result page even when no fill is set. */
    year: number;
    title?: string;
  } = $props();

  // Parliament uses FPTP across the whole UK including NI, so we keep
  // every seat (unlike CouncilHexMap, which filters NI).
  const hexes: HexInput[] = (hexData.seats as HexSeat[]).map((s) => {
    const slug = constituencyNameToSlug(s.name);
    return {
      id: slug,
      name: s.name,
      q: s.q,
      r: s.r,
      defaultHref: `/parliament/${year}/${slug}`
    };
  });
</script>

<HexCartogram {hexes} {fills} {title} />
