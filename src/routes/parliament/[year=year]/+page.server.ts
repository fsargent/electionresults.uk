// Per-election audit loader. Reuses the existing `year` param matcher
// (4-digit slug) so only plausibly-numeric years reach this route; the
// loader then 404s if the year isn't in the ingested set. `entries()`
// drives prerender enumeration off the ingested index, so the build
// only generates pages for years we actually have data for.
//
// All headline numbers come from the precomputed national-summary
// envelope written by the ETL (AR8) — the browser does no math.

import { error } from '@sveltejs/kit';
import {
  ingestedYears,
  manifestForYear,
  nationalSummaryForYear,
  partyTotalsForYear
} from '$lib/parliament/data';
import { partyEfficiency } from '$lib/parliament/metrics';
import type {
  NationalPartyTotal,
  NationalSummary,
  SourceManifest
} from '$lib/parliament/types';

export const prerender = true;

export function entries() {
  return ingestedYears().map((year) => ({ year: String(year) }));
}

export interface PartyRow {
  party: NationalPartyTotal;
  votesPerSeat: number | null;
}

export function load({ params }: { params: { year: string } }): {
  year: number;
  summary: NationalSummary;
  partyTotals: NationalPartyTotal[];
  partyRows: PartyRow[];
  manifest: SourceManifest;
} {
  const year = Number(params.year);
  if (!Number.isFinite(year)) {
    throw error(404, `Bad year: ${params.year}`);
  }
  if (!ingestedYears().includes(year)) {
    throw error(404, `No ingested parliamentary election for year ${year}`);
  }
  const partyTotals = partyTotalsForYear(year);
  // partyEfficiency preserves input order — pre-sort here so the page
  // can render PartyVoteSeatBar rows directly (vote share desc) without
  // recomputing the sort or re-joining the efficiency lookup.
  const sortedTotals = [...partyTotals].sort((a, b) => b.voteShare - a.voteShare);
  const efficiency = partyEfficiency(sortedTotals);
  const partyRows: PartyRow[] = sortedTotals.map((party, i) => ({
    party,
    votesPerSeat: efficiency[i].votesPerSeat
  }));
  return {
    year,
    summary: nationalSummaryForYear(year),
    partyTotals,
    partyRows,
    manifest: manifestForYear(year)
  };
}
