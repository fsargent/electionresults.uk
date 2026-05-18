import { error } from '@sveltejs/kit';
import {
  councilHistory,
  distinctCouncilSlugs,
  wardHistoryForCouncil,
  currentCouncilComposition,
  partyViewForYearAndCouncil,
  latestCompositionForCouncil,
  compositionsForCouncil,
  reorganisationForCouncil,
  allPartyViews
} from '$lib/data';
import { reallocatedSeats } from '$lib/distortion';

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
  // Year-by-year composition history (opencouncildata annual snapshots,
  // oldest → newest). Replaces the old "what this election replaced"
  // before/after pair with the full timeline so readers can see every
  // election move the council through; new entries land each year.
  const compositionHistory = compositionsForCouncil(params.council);

  // Aggregate FPTP-distortion across every cycle this council has data
  // for. Weighted by seats (not by cycle) so a small by-thirds round
  // doesn't outweigh an all-out election. Suppressed when no FPTP party
  // view exists (STV councils, councils dominated by independents).
  const fptpPartyViews = allPartyViews.filter(
    (v) => v.councilSlug === params.council && (v.system ?? 'FPTP') === 'FPTP'
  );
  let aggReallocated = 0;
  let aggDistortionSeats = 0;
  for (const v of fptpPartyViews) {
    aggReallocated += reallocatedSeats(v.rows);
    aggDistortionSeats += v.totalSeats;
  }
  const aggregateDistortion =
    aggDistortionSeats > 0
      ? {
          reallocated: aggReallocated,
          totalSeats: aggDistortionSeats,
          share: aggReallocated / aggDistortionSeats,
          cycleCount: fptpPartyViews.length
        }
      : null;

  // Aggregate below-quota share across every cycle. Same seat-weighted
  // denominator so cycles compare like-for-like. Always available
  // (every council with cycles has belowQuotaSeatCount), but we
  // suppress the tile when zero so a clean record reads as "all
  // wards above quota" rather than a stark 0%.
  let aggBelowQuotaSeats = 0;
  let aggBelowQuotaTotal = 0;
  for (const c of history.cycles) {
    aggBelowQuotaSeats += c.belowQuotaSeatCount;
    aggBelowQuotaTotal += c.totalSeatCount;
  }
  const aggregateBelowQuota = aggBelowQuotaTotal > 0
    ? {
        belowQuotaSeats: aggBelowQuotaSeats,
        totalSeats: aggBelowQuotaTotal,
        share: aggBelowQuotaSeats / aggBelowQuotaTotal
      }
    : null;

  return {
    history,
    wards,
    composition,
    compositionApprox,
    reorganisation,
    latestCycle,
    latestPartyView,
    compositionHistory,
    aggregateDistortion,
    aggregateBelowQuota
  };
}
