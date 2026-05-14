import type { Candidate, PartyViewRow, Race } from './types';

export function candidateWinningPct(c: Candidate, r: Race): number {
  if (r.validBallots <= 0) return 0;
  return c.votes / r.validBallots;
}

export function electedCandidates(r: Race): Candidate[] {
  return r.candidates.filter((c) => c.elected);
}

export function electedWinningPcts(r: Race): number[] {
  return electedCandidates(r).map((c) => candidateWinningPct(c, r));
}

/**
 * Headline winning % for a race.
 * Single-member: the winner's share of valid ballots.
 * Multi-member: the marginal (lowest-vote) elected candidate's share —
 * the seat-holder with the thinnest mandate in that ward.
 */
export function raceWinningPct(r: Race): number {
  const pcts = electedWinningPcts(r);
  if (pcts.length === 0) return 0;
  return Math.min(...pcts);
}

/**
 * Droop quota: 1 / (seats + 1).
 *
 * This is the share of valid ballots a candidate would need to be guaranteed
 * a seat under any common proportional method. We use it as the "fair"
 * benchmark for single-member and multi-member ward results alike — for
 * single-member it collapses to 50%.
 */
export function quotaForSeats(seats: number): number {
  if (!Number.isFinite(seats) || seats < 1) return 0.5;
  return 1 / (seats + 1);
}

/**
 * Signed gap between the marginal elected candidate's share and the
 * proportional quota, in fraction-of-valid-ballots units.
 *   negative = below the quota (the editorial indictment)
 *   positive = above the quota
 *   zero     = exactly at the quota
 *
 * Field name kept as `underPar` / `under_par` for schema compatibility,
 * but the sign convention is signed-gap (negative = deficit), which is
 * how `pts()` displays it and how the "Below quota" column reads.
 */
export function underPar(r: Race): number {
  return raceWinningPct(r) - quotaForSeats(r.seats);
}

/** True when the marginal winner's share fell below the proportional quota. */
export function isBelowQuota(r: Race): boolean {
  return underPar(r) < 0;
}

/**
 * D'Hondt seat allocation. Given parties with vote totals and a fixed number
 * of seats to fill, allocates seats one at a time to the party with the
 * highest quotient `votes / (currentSeats + 1)`. Ties are broken by raw vote
 * count, then alphabetically by party name (deterministic).
 *
 * Returns a Map keyed by party name with the seat count.
 */
export function dhondt(
  parties: { name: string; votes: number }[],
  totalSeats: number
): Map<string, number> {
  const seats = new Map<string, number>();
  for (const p of parties) seats.set(p.name, 0);
  if (totalSeats <= 0) return seats;

  for (let i = 0; i < totalSeats; i++) {
    let bestName: string | null = null;
    let bestQ = -Infinity;
    let bestVotes = -Infinity;
    for (const p of parties) {
      const q = p.votes / (seats.get(p.name)! + 1);
      if (
        q > bestQ ||
        (q === bestQ && p.votes > bestVotes) ||
        (q === bestQ && p.votes === bestVotes && (bestName === null || p.name < bestName))
      ) {
        bestQ = q;
        bestVotes = p.votes;
        bestName = p.name;
      }
    }
    if (bestName === null) break;
    seats.set(bestName, seats.get(bestName)! + 1);
  }
  return seats;
}

/**
 * Count of seats FPTP allocated to a different party than the proportional
 * (D'Hondt) benchmark would have. Each over-allocation has a matching
 * under-allocation, so we sum |delta| and halve to avoid double-counting.
 * Rounded because the underlying deltas are already integers per party.
 */
export function reallocatedSeats(rows: { seatDelta: number }[]): number {
  return Math.round(rows.reduce((sum, r) => sum + Math.abs(r.seatDelta), 0) / 2);
}

/**
 * Gallagher disproportionality index (least-squares, LSq).
 *
 *   Gallagher = sqrt( ½ · Σ (Vᵢ − Sᵢ)² )
 *
 * where Vᵢ and Sᵢ are party i's vote share and seat share expressed as
 * percentages (0–100). The result is in the same units. Gallagher (1991)
 * proposed it as a single-number summary of how proportionally an
 * election translated votes into seats, weighting larger gaps more
 * heavily than the simpler Loosemore–Hanby sum.
 *
 *   0    = perfect proportionality
 *   ~5   = mildly disproportional (typical PR result)
 *   ~10  = noticeable distortion
 *   15+  = severe (most UK FPTP general elections sit here)
 *
 * Returns NaN when there are no seats or no votes — the caller should
 * decide whether to suppress the metric in that case.
 */
export function gallagherIndex(rows: PartyViewRow[]): number {
  if (rows.length === 0) return NaN;
  let totalVotes = 0;
  let totalSeats = 0;
  for (const r of rows) {
    totalVotes += r.votes;
    totalSeats += r.fptpSeats;
  }
  if (totalVotes <= 0 || totalSeats <= 0) return NaN;
  let sumSq = 0;
  for (const r of rows) {
    const v = (r.votes / totalVotes) * 100;
    const s = (r.fptpSeats / totalSeats) * 100;
    const d = v - s;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / 2);
}
