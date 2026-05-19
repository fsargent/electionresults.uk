// Parliament front page — renders the most recently ingested general
// election as the default audit, with a year-switcher that links to
// /parliament/[year] for prior cycles. Mirrors the homepage pattern
// of "show the latest cycle as the front page".
//
// Loader logic intentionally mirrors /parliament/[year]/+page.server.ts
// for the latest year — both routes feed the same YearAudit component
// so adding fields here means adding them there too.

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

export function load(): {
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
  const allYears = ingestedYears();
  // `ingestedYears()` returns the index sorted desc, so the first entry
  // is the most recent ingest. The front page always renders this.
  const latestYear = allYears[0];
  if (latestYear == null) {
    // No years ingested — should not happen in normal operation, but
    // returning a typed shape lets the page degrade gracefully.
    throw new Error(
      'parliament front page: no ingested general elections — check src/lib/data/parliament/index.json'
    );
  }
  const partyTotals = partyTotalsForYear(latestYear);
  const sortedTotals = [...partyTotals].sort((a, b) => b.voteShare - a.voteShare);
  const efficiency = partyEfficiency(sortedTotals);
  const partyRows: PartyRow[] = sortedTotals.map((party, i) => ({
    party,
    votesPerSeat: efficiency[i].votesPerSeat
  }));
  const contests = constituenciesForYear(latestYear);
  const constituencies = contests
    .map((c) => ({ slug: c.constituencySlug, name: c.constituencyName }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    year: latestYear,
    allYears,
    latestYear,
    summary: nationalSummaryForYear(latestYear),
    partyTotals,
    partyRows,
    manifest: manifestForYear(latestYear),
    constituencyFills: buildConstituencyFills(contests, latestYear),
    constituencies
  };
}
