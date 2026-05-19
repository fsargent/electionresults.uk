<script lang="ts">
  // Westminster constituency hex cartogram. Two layouts are shipped:
  //   - westminster-hexes.json       — Open Innovations 2023-review (2024 boundaries)
  //   - westminster-hexes-2010.json  — Open Innovations 2019-BBC    (2010 boundaries)
  // The 2010 boundary set covers the 2010 / 2015 / 2017 / 2019 GEs;
  // 2024 onward uses the 2023-review set. Picking the layout by year
  // keeps every cycle's hexes complete instead of leaving ~35% grey
  // when boundary names don't carry through the review.
  import hexData2024 from '$lib/data/parliament/westminster-hexes.json';
  import hexData2010 from '$lib/data/parliament/westminster-hexes-2010.json';
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
     *  constituency drills into its result page even when no fill is set,
     *  and to pick the right boundary-set hex layout. */
    year: number;
    title?: string;
  } = $props();

  // 2023-review (650 seats with the new boundaries) came into force at
  // the 2024 GE. Earlier cycles all ran under the 2010 review.
  const seats = $derived<HexSeat[]>(
    (year >= 2024 ? hexData2024.seats : hexData2010.seats) as HexSeat[]
  );

  // Parliament uses FPTP across the whole UK including NI, so we keep
  // every seat (unlike CouncilHexMap, which filters NI).
  const hexes = $derived<HexInput[]>(
    seats.map((s) => {
      const slug = constituencyNameToSlug(s.name);
      return {
        id: slug,
        name: s.name,
        q: s.q,
        r: s.r,
        defaultHref: `/parliament/${year}/${slug}`
      };
    })
  );
</script>

<HexCartogram {hexes} {fills} {title} />
