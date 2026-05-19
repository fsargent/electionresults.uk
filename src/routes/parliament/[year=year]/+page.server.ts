// Per-election audit loader. Reuses the existing `year` param matcher
// (4-digit slug) so only plausibly-numeric years reach this route; the
// loader then 404s if the year isn't in the ingested set. `entries()`
// drives prerender enumeration off the ingested index, so the build
// only generates pages for years we actually have data for.
//
// All headline numbers come from the precomputed national-summary
// envelope written by the ETL (AR8) — the browser does no math.
// Constituency-level fills for the hex cartogram are derived once
// here, server-side, from the same constituencies dataset the
// drill-down pages already consume.

import { error } from '@sveltejs/kit';
import {
  constituenciesForYear,
  ingestedYears,
  manifestForYear,
  nationalSummaryForYear,
  partyTotalsForYear
} from '$lib/parliament/data';
import { partyEfficiency } from '$lib/parliament/metrics';
import { partyColor } from '$lib/party-colors';
import type { HexFill } from '$lib/components/HexCartogram.svelte';
import type {
  IngestedConstituency,
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

function buildConstituencyFills(
  contests: IngestedConstituency[],
  year: number
): Record<string, HexFill> {
  const out: Record<string, HexFill> = {};
  for (const c of contests) {
    const winner = c.candidates.find((cand) => cand.isWinner);
    const partyName = winner?.partyDisplayName ?? null;
    const winningShare = winner?.share ?? null;
    const colour = partyColor(partyName);
    const sharePart =
      winningShare != null
        ? `${winner!.partyDisplayName} · ${Math.round(winningShare * 100)}% of valid votes`
        : 'No winner recorded';
    out[c.constituencySlug] = {
      color: colour,
      href: `/parliament/${year}/${c.constituencySlug}`,
      title: `${c.constituencyName}: ${partyName ?? 'unknown winner'}`,
      primary: c.constituencyName,
      secondary: sharePart,
      swatchColor: colour
    };
  }
  return out;
}

export function load({ params }: { params: { year: string } }): {
  year: number;
  allYears: number[];
  latestYear: number;
  summary: NationalSummary;
  partyTotals: NationalPartyTotal[];
  partyRows: PartyRow[];
  manifest: SourceManifest;
  constituencyFills: Record<string, HexFill>;
  constituencies: { slug: string; name: string }[];
} {
  const year = Number(params.year);
  if (!Number.isFinite(year)) {
    throw error(404, `Bad year: ${params.year}`);
  }
  const allYears = ingestedYears();
  if (!allYears.includes(year)) {
    throw error(404, `No ingested parliamentary election for year ${year}`);
  }
  // `ingestedYears()` returns the index sorted desc, so the first
  // entry is the most recent ingest.
  const latestYear = allYears[0];
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
  const contests = constituenciesForYear(year);
  const constituencies = contests
    .map((c) => ({ slug: c.constituencySlug, name: c.constituencyName }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    year,
    allYears,
    latestYear,
    summary: nationalSummaryForYear(year),
    partyTotals,
    partyRows,
    manifest: manifestForYear(year),
    constituencyFills: buildConstituencyFills(contests, year),
    constituencies
  };
}
