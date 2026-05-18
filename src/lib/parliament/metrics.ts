// Pure metric functions for the parliamentary audit.
//
// Called once by scripts/etl-parliament.mjs to precompute the headline
// numbers written to national-summary.json (AR8: never compute a
// headline parliament metric in the browser). Exported as plain
// functions so this same module can be unit-tested without an ETL
// pipeline and re-used by future build-time loaders that need to
// recalculate a single metric against a subset of the data.
//
// Caveat handling: each function documents which CaveatTokens it
// excludes from the metric's denominator. Excluded rows remain in
// the dataset; they're just not counted toward the headline number.
// The ETL records exclusion counts in NationalSummary.excludedFromMetrics
// so consumers can audit the difference between the raw dataset and
// the published numbers.

import type {
  CandidateResult,
  CaveatToken,
  ConstituencyContest,
  LowWinningShareRow,
  NationalPartyTotal
} from './types';

/**
 * Gallagher least-squares disproportionality index. Standard measure
 * for general elections — 0 = perfectly proportional, single-digit
 * values typical of PR systems, double-digit values typical of FPTP.
 *
 * Formula: sqrt( 0.5 * sum_i (Vi - Si)^2 )
 * where Vi and Si are vote and seat shares (in percentage points 0–100,
 * not fractions). Returns a value in [0, 100].
 *
 * No caveat exclusions — callers pass in the `NationalPartyTotal[]`
 * they want included. Typically the ETL excludes the Speaker seat
 * (caveat: 'speaker') from party totals before they get here, so the
 * Speaker doesn't show up as a phantom "no party" entry.
 */
export function gallagherIndex(partyTotals: NationalPartyTotal[]): number {
  if (partyTotals.length === 0) return 0;
  let sumOfSquares = 0;
  for (const p of partyTotals) {
    const voteSharePct = p.voteShare * 100;
    const seatSharePct = p.seatShare * 100;
    const diff = voteSharePct - seatSharePct;
    sumOfSquares += diff * diff;
  }
  return Math.sqrt(sumOfSquares / 2);
}

/**
 * Vote-vs-seat share gap per party.
 *
 * `gap = seatShare - voteShare` — positive = over-represented, negative
 * = under-represented. Sorted by absolute gap descending so the
 * largest distortions surface first; ties broken by partyDisplayName
 * for stability.
 *
 * No caveat exclusions at this level (operates on already-aggregated
 * party totals).
 */
export function voteVsSeatGap(
  partyTotals: NationalPartyTotal[]
): { partyId: string; partyDisplayName: string; gap: number }[] {
  return partyTotals
    .map((p) => ({
      partyId: p.partyId,
      partyDisplayName: p.partyDisplayName,
      gap: p.seatShare - p.voteShare
    }))
    .sort((a, b) => {
      const aMag = Math.abs(b.gap) - Math.abs(a.gap);
      if (aMag !== 0) return aMag;
      return a.partyDisplayName.localeCompare(b.partyDisplayName);
    });
}

/**
 * Votes per seat won — the bluntest "system efficiency" measure.
 *
 * Returns `null` for parties with `seats === 0` (no seat to divide
 * by; emitting Infinity or 0 would mislead).
 */
export function partyEfficiency(
  partyTotals: NationalPartyTotal[]
): { partyId: string; partyDisplayName: string; votesPerSeat: number | null }[] {
  return partyTotals.map((p) => ({
    partyId: p.partyId,
    partyDisplayName: p.partyDisplayName,
    votesPerSeat: p.seats > 0 ? p.votes / p.seats : null
  }));
}

/**
 * Build a contestId → candidates lookup so metrics can join contests
 * to their candidate lists in O(N) instead of O(N×M).
 */
function indexCandidates(candidates: CandidateResult[]): Map<string, CandidateResult[]> {
  const byContest = new Map<string, CandidateResult[]>();
  for (const c of candidates) {
    const list = byContest.get(c.contestId);
    if (list) list.push(c);
    else byContest.set(c.contestId, [c]);
  }
  return byContest;
}

/**
 * Pick the winning candidate for a contest. Defensive: if multiple
 * candidates are flagged `isWinner` (multi-member historical) we
 * return null — those contests are excluded from single-winner
 * metrics. Otherwise null when no winner is flagged (uncontested
 * with no candidate listed, malformed data).
 */
function singleWinner(candidates: CandidateResult[]): CandidateResult | null {
  const winners = candidates.filter((c) => c.isWinner);
  if (winners.length !== 1) return null;
  return winners[0];
}

const SHARE_INVALIDATING_CAVEATS: ReadonlySet<CaveatToken> = new Set([
  // No real winning share — the candidate stood unopposed.
  'uncontested',
  // No single winner; share-of-valid-votes isn't comparable across
  // single-member and multi-member contests.
  'multi-member-historical'
]);

function contestExcludedFromShareMetrics(contest: ConstituencyContest): boolean {
  return contest.caveats.some((c) => SHARE_INVALIDATING_CAVEATS.has(c));
}

/**
 * Count of contest winners who won with less than 50% of valid votes
 * in their constituency — the headline "minority mandate" number.
 *
 * Excludes contests with caveats that invalidate the winning-share
 * denominator: `uncontested`, `multi-member-historical`. The
 * `speaker` caveat is *not* excluded — a Speaker still has a winning
 * share, and we report it as such (per AR4, speaker is excluded from
 * party totals only, not from minority-winner counts).
 *
 * A contest with `share === null` on its winner (no valid-votes
 * count in the source) is excluded — we can't compute share without
 * a denominator.
 */
export function minorityWinnerCount(
  contests: ConstituencyContest[],
  candidates: CandidateResult[]
): number {
  const byContest = indexCandidates(candidates);
  let count = 0;
  for (const contest of contests) {
    if (contestExcludedFromShareMetrics(contest)) continue;
    const cands = byContest.get(`${contest.electionId}:${contest.constituencyId}`);
    if (!cands) continue;
    const winner = singleWinner(cands);
    if (!winner || winner.share === null) continue;
    if (winner.share < 0.5) count += 1;
  }
  return count;
}

/**
 * Top-N constituencies ranked by lowest winning share ascending —
 * the leaderboard the year audit pages render under "Constituencies
 * won without majority support". Ties broken by constituency name.
 *
 * Same exclusions as `minorityWinnerCount` apply.
 */
export function lowWinningShareLeaderboard(
  contests: ConstituencyContest[],
  candidates: CandidateResult[],
  n = 20
): LowWinningShareRow[] {
  const byContest = indexCandidates(candidates);
  const rows: LowWinningShareRow[] = [];
  for (const contest of contests) {
    if (contestExcludedFromShareMetrics(contest)) continue;
    const cands = byContest.get(`${contest.electionId}:${contest.constituencyId}`);
    if (!cands || cands.length === 0) continue;
    const winner = singleWinner(cands);
    if (!winner || winner.share === null) continue;
    // Runner-up = second position when sorted by votes desc. Ties
    // resolved by position field (1-based).
    const ranked = [...cands].sort((a, b) => a.position - b.position);
    const runnerUp = ranked[1] ?? null;
    rows.push({
      electionId: contest.electionId,
      constituencyId: contest.constituencyId,
      constituencySlug: contest.constituencySlug,
      constituencyName: contest.constituencyName,
      winningShare: winner.share,
      winningPartyId: winner.partyId,
      winningPartyDisplayName: winner.partyDisplayName,
      winningCandidateName: winner.candidateName,
      runnerUpShare: runnerUp?.share ?? null,
      caveats: [...contest.caveats]
    });
  }
  rows.sort((a, b) => {
    if (a.winningShare !== b.winningShare) return a.winningShare - b.winningShare;
    return a.constituencyName.localeCompare(b.constituencyName);
  });
  return rows.slice(0, n);
}
