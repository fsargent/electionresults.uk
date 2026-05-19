// Parliament parties overview — the Westminster counterpart of
// /councils/parties. Reads every ingested general-election year and
// emits everything the page needs:
//
//   - Constituency fills for the latest cycle (hex map by winning party).
//   - Per-cycle paired-bar data (one panel per ingested year).
//   - Slopes between adjacent ingested cycles (most-recent pair per
//     party — so 2019 → 2024 today, automatically pairs to the newest
//     year as the ETL ingests further cycles).
//   - Party overview cards (latest cycle, ranked by vote share).
//
// All the heavy precompute already lives in $lib/parliament/data —
// this loader just stitches per-year payloads together and reshapes
// for the rendering components.

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

// Mirrors the threshold the per-year YearAudit page uses. Parties
// below this band are real and ship in the CSV downloads, but they
// drown the FPTP story when listed inline.
const PARTY_VISIBILITY_THRESHOLD = 0.01;

export interface CycleSummary {
  year: number;
  electionDateLabel: string;
  totalSeats: number;
  totalVotes: number;
  gallagher: number;
  minorityWinnerCount: number;
  /** Visible (≥1% of valid votes) party rows in this cycle, sorted by
   *  vote share desc. */
  bars: {
    partyId: string;
    name: string;
    color: string;
    voteShare: number;
    seatShare: number;
  }[];
  /** Count of parties hidden below the visibility threshold — surfaced
   *  in the UI so readers know the long tail exists. */
  hiddenPartyCount: number;
}

export interface PartyCard {
  partyId: string;
  name: string;
  color: string;
  /** Latest-cycle stats — what the card headline shows. */
  voteShare: number;
  seatShare: number;
  seats: number;
  totalSeats: number;
  /** seatShare - voteShare in the latest cycle. */
  seatDelta: number;
  /** Vote-share movement vs the prior ingested cycle the party
   *  contested. Null when no comparable prior cycle is in our dataset. */
  voteShareDelta: number | null;
  priorYear: number | null;
}

export interface PartySlope {
  partyId: string;
  name: string;
  color: string;
  startYear: number;
  startValue: number;
  endYear: number;
  endValue: number;
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

function cycleSummary(
  year: number,
  summary: NationalSummary,
  totals: NationalPartyTotal[],
  manifest: SourceManifest
): CycleSummary {
  const sorted = [...totals].sort((a, b) => b.voteShare - a.voteShare);
  const visible = sorted.filter((p) => p.voteShare >= PARTY_VISIBILITY_THRESHOLD);
  return {
    year,
    electionDateLabel: formatElectionDate(manifest.publicationDate, year),
    totalSeats: summary.totalSeats,
    totalVotes: summary.totalVotes,
    gallagher: summary.gallagher,
    minorityWinnerCount: summary.minorityWinnerCount,
    bars: visible.map((p) => ({
      partyId: p.partyId,
      name: p.partyDisplayName,
      color: partyColor(p.partyDisplayName),
      voteShare: p.voteShare,
      seatShare: p.seatShare
    })),
    hiddenPartyCount: sorted.length - visible.length
  };
}

/**
 * The manifest's publicationDate is when the source publisher dated
 * the file, not polling day. We fall back to the year on its own so
 * the label never lies — adding a polling-day field to the manifest
 * is the right long-term fix.
 */
function formatElectionDate(_publicationDate: string, year: number): string {
  return `${year} general election`;
}

export function load(): {
  latestYear: number;
  cycles: CycleSummary[];
  slopes: PartySlope[];
  cards: PartyCard[];
  constituencyFills: Record<string, HexFill>;
  latestManifest: SourceManifest;
} {
  const years = ingestedYears();
  if (years.length === 0) {
    throw new Error(
      'parliament parties page: no ingested general elections — check src/lib/data/parliament/index.json'
    );
  }
  const latestYear = years[0];

  // Per-year payloads. We read once and pass around so we don't hit
  // disk repeatedly inside helper functions.
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

  // Cycles in descending year order — newest first so the panel that
  // opens the section is the cycle the reader most likely came in
  // looking for.
  const cycles: CycleSummary[] = years.map((y) => {
    const p = perYear.get(y)!;
    return cycleSummary(y, p.summary, p.totals, p.manifest);
  });

  // Slopes: for each party visible in the latest cycle, find the
  // newest prior ingested cycle the same party contested with a
  // non-trivial vote share, and pair those two endpoints. Skip when
  // we only have one cycle of data — a single point is not a slope,
  // and 0% → X% is honest only when the 0% is real.
  const slopes: PartySlope[] = [];
  if (years.length >= 2) {
    const latestVisible = cycles[0].bars;
    const olderYears = years.slice(1); // already desc
    for (const bar of latestVisible) {
      let priorYear: number | null = null;
      let priorShare = 0;
      for (const py of olderYears) {
        const match = perYear
          .get(py)!
          .totals.find((p) => p.partyId === bar.partyId);
        if (match && match.voteShare > 0) {
          priorYear = py;
          priorShare = match.voteShare;
          break;
        }
      }
      if (priorYear == null) continue;
      slopes.push({
        partyId: bar.partyId,
        name: bar.name,
        color: bar.color,
        startYear: priorYear,
        startValue: priorShare,
        endYear: latestYear,
        endValue: bar.voteShare
      });
    }
    // Largest absolute movement first so the biggest swings cluster
    // for visual comparison.
    slopes.sort(
      (a, b) =>
        Math.abs(b.endValue - b.startValue) -
        Math.abs(a.endValue - a.startValue)
    );
  }

  // Cards: every party visible in the latest cycle, ordered by vote
  // share descending. Each card carries its own four-year delta so
  // the reader sees movement without scrolling back to the slopes.
  const cards: PartyCard[] = cycles[0].bars.map((bar) => {
    const latest = perYear
      .get(latestYear)!
      .totals.find((p) => p.partyId === bar.partyId)!;
    // Find the prior ingested cycle where this party scored above the
    // visibility threshold — using the same threshold as the slopes
    // keeps the card delta consistent with the slope panel.
    let priorYear: number | null = null;
    let priorShare = 0;
    for (const py of years.slice(1)) {
      const match = perYear
        .get(py)!
        .totals.find((p) => p.partyId === bar.partyId);
      if (match && match.voteShare > 0) {
        priorYear = py;
        priorShare = match.voteShare;
        break;
      }
    }
    return {
      partyId: bar.partyId,
      name: bar.name,
      color: bar.color,
      voteShare: latest.voteShare,
      seatShare: latest.seatShare,
      seats: latest.seats,
      totalSeats: cycles[0].totalSeats,
      seatDelta: latest.seatDelta,
      voteShareDelta: priorYear != null ? latest.voteShare - priorShare : null,
      priorYear
    };
  });

  const constituencyFills = buildConstituencyFills(
    constituenciesForYear(latestYear),
    latestYear
  );

  return {
    latestYear,
    cycles,
    slopes,
    cards,
    constituencyFills,
    latestManifest: perYear.get(latestYear)!.manifest
  };
}
