import { error } from '@sveltejs/kit';
import {
  councilHistory,
  distinctCouncilSlugs,
  wardHistoryForCouncil,
  currentCouncilComposition,
  partyViewForYearAndCouncil,
  latestCompositionForCouncil,
  compositionForCouncilYear,
  reorganisationForCouncil
} from '$lib/data';

export const prerender = true;

export function entries() {
  return distinctCouncilSlugs().map((c) => ({ council: c.councilSlug }));
}

export function load({ params }: { params: { council: string } }) {
  const history = councilHistory(params.council);
  if (!history) throw error(404, `Council not found: ${params.council}`);
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
  // Within-cycle FPTP-distortion view for the most recent cycle this
  // council polled in. The cross-cycle composition-flip framing
  // we used to render here was unreliable for by-thirds councils
  // (annual snapshot drift, by-elections and defections all polluted
  // it). The honest FPTP claim is intra-cycle: vote share vs seats
  // for the seats actually up. Same component as /[council]/[year].
  const latestCycle = history.cycles[0] ?? null;
  const latestPartyView = latestCycle
    ? partyViewForYearAndCouncil(latestCycle.year, params.council) ?? null
    : null;
  // Before/after pair for the most recent election: opencouncildata's
  // year-Y snapshot reflects the council AFTER the May-Y elections
  // (verified empirically — e.g. Rushmoor 2023→2024 captures Labour's
  // 2024 gains), so before = year-1, after = year.
  const compositionBefore = latestCycle
    ? compositionForCouncilYear(params.council, latestCycle.year - 1) ?? null
    : null;
  const compositionAfter = latestCycle
    ? compositionForCouncilYear(params.council, latestCycle.year) ?? null
    : null;
  return {
    history,
    wards,
    composition,
    compositionApprox,
    reorganisation,
    latestCycle,
    latestPartyView,
    compositionBefore,
    compositionAfter
  };
}
