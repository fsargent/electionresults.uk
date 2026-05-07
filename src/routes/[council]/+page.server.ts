import { error } from '@sveltejs/kit';
import {
  councilHistory,
  distinctCouncilSlugs,
  flipsForCouncil,
  wardHistoryForCouncil,
  currentCouncilComposition,
  partyViewForYearAndCouncil,
  compositionForCouncilYear,
  latestCompositionForCouncil,
  reorganisationForCouncil
} from '$lib/data';

export const prerender = true;

export function entries() {
  return distinctCouncilSlugs().map((c) => ({ council: c.councilSlug }));
}

export function load({ params }: { params: { council: string } }) {
  const history = councilHistory(params.council);
  if (!history) throw error(404, `Council not found: ${params.council}`);
  // Attach the per-cycle party view (full party breakdown — votes + seats
  // for every party that contested) to each flip, so the per-cycle
  // visualisation can show all parties not just the incoming/outgoing
  // pair. Without all parties the empty space at the right of each bar
  // is misleading: 2-party bars don't sum to 100% so the votes bar and
  // the seats bar end at different points, breaking the comparison.
  const flips = flipsForCouncil(params.council).map((f) => ({
    ...f,
    partyViewFrom: partyViewForYearAndCouncil(f.yearFrom, params.council) ?? null,
    partyViewTo: partyViewForYearAndCouncil(f.yearTo, params.council) ?? null,
    // Full council composition (truth-set) for both years of the flip.
    // Used to replace the per-cycle "actual seats" SeatChart with a
    // full-council view, so the viz isn't lopsided when one side is
    // a by-thirds cycle and the other is all-out (Amber Valley
    // 2021→2023 was the canonical example: 15 seats vs 42 seats made
    // the SeatChart visually meaningless).
    compositionFrom: compositionForCouncilYear(params.council, f.yearFrom) ?? null,
    compositionTo: compositionForCouncilYear(params.council, f.yearTo) ?? null
  }));
  const wards = wardHistoryForCouncil(params.council);
  // Prefer the opencouncildata truth-set (annual snapshot of every
  // councillor's party affiliation) over our own sum-across-cycles
  // approximation. Fall back to the approximation when oncd has no
  // snapshot for this council (rare — typically only LGR-successor
  // councils that didn't exist when oncd's data window starts).
  const composition = latestCompositionForCouncil(params.council) ?? null;
  const compositionApprox = composition
    ? null
    : currentCouncilComposition(params.council);
  const reorganisation = reorganisationForCouncil(params.council);
  return {
    history,
    flips,
    wards,
    composition,
    compositionApprox,
    reorganisation
  };
}
