<script lang="ts">
  import hexData from '$lib/data/hexes.json';
  import HexCartogram, {
    type HexInput,
    type HexFill
  } from './HexCartogram.svelte';

  // Re-exported for back-compat with existing call sites
  // (MapBelowQuota, MapFlips, MapDistortion, parties index, party page).
  export type CouncilFill = HexFill;

  interface Hex {
    onsCode: string;
    name: string;
    slug: string;
    aliases: string[];
    q: number;
    r: number;
    region: string | null;
  }

  // NI's 11 districts have used STV since 1973, so an FPTP audit has
  // nothing to say about them. Suppress them from the council
  // cartogram entirely; the "PR already exists in the UK" point is
  // made in captions below the map.
  const NI_REGION = 'N92000002';
  const hexes: HexInput[] = (hexData.hexes as Hex[])
    .filter((h) => h.region !== NI_REGION)
    .map((h) => ({
      id: h.slug,
      name: h.name,
      q: h.q,
      r: h.r,
      aliases: h.aliases,
      defaultHref: `/councils/${h.slug}`
    }));

  let {
    fills,
    title = 'UK local-authority hex cartogram'
  }: {
    fills: Record<string, HexFill>;
    title?: string;
  } = $props();
</script>

<HexCartogram {hexes} {fills} {title} />
