// Westminster per-party page — the parliament counterpart of
// /councils/party/[slug]. Aggregates one party's record across every
// ingested general election: headline, multi-cycle vote/seat trend,
// per-cycle paired bars, constituencies the party currently holds,
// and a year-by-year table.
//
// The `[slug=party]` matcher constrains the URL to the seven major
// party slugs (labour, conservative, liberal-democrats, green, reform,
// snp, plaid-cymru); we 404 here if the party isn't visible in any
// ingested cycle so we never render an empty shell.

import { error } from '@sveltejs/kit';

import { partyForSlug, partySlugs } from '$lib/parties';
import {
  constituenciesForYear,
  ingestedYears,
  manifestForYear,
  nationalSummaryForYear,
  partyTotalsForYear
} from '$lib/parliament/data';
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
  return partySlugs().map((slug) => ({ slug }));
}

export interface CycleRow {
  year: number;
  totalSeats: number;
  totalVotes: number;
  votes: number;
  voteShare: number;
  seats: number;
  seatShare: number;
  /** seatShare - voteShare in this cycle (positive = over-represented). */
  seatDelta: number;
  /** Minimum 2-letter description of how this party's seat take ranked
   *  against every other party in the cycle, for the table column. */
  seatRank: number;
}

export interface TrendPoint {
  year: number;
  voteShare: number;
  seatShare: number;
}

export interface ConstituencyWin {
  slug: string;
  name: string;
  winningShare: number;
  winningCandidate: string;
  year: number;
}

/**
 * Find this party's totals row in a given cycle. We match by the
 * canonical display name from `$lib/parties` because parliament
 * `partyId` values (e.g. "labour-party") differ from the council
 * short slugs (e.g. "labour") the [slug=party] matcher uses.
 */
function totalsForParty(
  totals: NationalPartyTotal[],
  partyName: string
): NationalPartyTotal | null {
  return totals.find((p) => p.partyDisplayName === partyName) ?? null;
}

function buildConstituencyFills(
  contests: IngestedConstituency[],
  year: number,
  partyName: string,
  color: string
): { fills: Record<string, HexFill>; wins: ConstituencyWin[] } {
  const fills: Record<string, HexFill> = {};
  const wins: ConstituencyWin[] = [];
  for (const c of contests) {
    const winner = c.candidates.find((cand) => cand.isWinner);
    if (!winner || winner.partyDisplayName !== partyName) continue;
    const share = winner.share ?? 0;
    const sharePart =
      share > 0
        ? `${Math.round(share * 100)}% of valid votes`
        : 'No winner recorded';
    fills[c.constituencySlug] = {
      color,
      href: `/parliament/${year}/${c.constituencySlug}`,
      title: `${c.constituencyName}: ${winner.candidateName} (${winner.partyDisplayName})`,
      primary: c.constituencyName,
      secondary: sharePart,
      swatchColor: color
    };
    wins.push({
      slug: c.constituencySlug,
      name: c.constituencyName,
      winningShare: share,
      winningCandidate: winner.candidateName,
      year
    });
  }
  wins.sort((a, b) => a.name.localeCompare(b.name));
  return { fills, wins };
}

export function load({ params }: { params: { slug: string } }): {
  partySlug: string;
  partyName: string;
  partyColor: string;
  latestYear: number;
  latestManifest: SourceManifest;
  cycles: CycleRow[];
  trend: TrendPoint[];
  /** Constituencies the party held in the latest cycle, sorted by name. */
  latestWins: ConstituencyWin[];
  /** Hex-map fills for the latest cycle (only this party's wins are
   *  coloured — other constituencies fall through to the neutral default). */
  constituencyFills: Record<string, HexFill>;
} {
  const partyName = partyForSlug(params.slug);
  if (!partyName) throw error(404, `Unknown party: ${params.slug}`);

  const years = ingestedYears();
  if (years.length === 0) {
    throw error(
      500,
      'No ingested general elections — check src/lib/data/parliament/index.json'
    );
  }

  // Preload every cycle once so subsequent lookups stay in memory.
  const perYear = new Map<
    number,
    {
      summary: NationalSummary;
      totals: NationalPartyTotal[];
      manifest: SourceManifest;
    }
  >();
  for (const y of years) {
    perYear.set(y, {
      summary: nationalSummaryForYear(y),
      totals: partyTotalsForYear(y),
      manifest: manifestForYear(y)
    });
  }

  // Cycles where this party scored a non-zero vote share. We 404 if
  // none — an empty per-party page would lie about coverage.
  const yearsAsc = [...years].sort((a, b) => a - b);
  const cycles: CycleRow[] = [];
  const trend: TrendPoint[] = [];
  for (const y of yearsAsc) {
    const p = perYear.get(y)!;
    const t = totalsForParty(p.totals, partyName);
    if (!t || t.voteShare <= 0) continue;
    // Seat rank in the cycle: how many parties seated strictly more
    // MPs than this one. 0 = leading party, 1 = second place, etc.
    const seatRank = p.totals.filter((row) => row.seats > t.seats).length;
    cycles.push({
      year: y,
      totalSeats: p.summary.totalSeats,
      totalVotes: p.summary.totalVotes,
      votes: t.votes,
      voteShare: t.voteShare,
      seats: t.seats,
      seatShare: t.seatShare,
      seatDelta: t.seatDelta,
      seatRank
    });
    trend.push({
      year: y,
      voteShare: t.voteShare,
      seatShare: t.seatShare
    });
  }
  if (cycles.length === 0) {
    throw error(
      404,
      `${partyName} has no recorded vote share in any ingested general election. Try /parliament/parties for the full list.`
    );
  }

  const latestYear = years[0];
  const { fills: constituencyFills, wins: latestWins } = buildConstituencyFills(
    constituenciesForYear(latestYear),
    latestYear,
    partyName,
    partyColor(partyName)
  );

  return {
    partySlug: params.slug,
    partyName,
    partyColor: partyColor(partyName),
    latestYear,
    latestManifest: perYear.get(latestYear)!.manifest,
    cycles,
    trend,
    latestWins,
    constituencyFills
  };
}
