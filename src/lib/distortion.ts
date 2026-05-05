import type { Candidate, Race } from './types';

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
 * This is the share of valid first-preference ballots a candidate would need
 * to be guaranteed a seat under STV. We use it as the "fair" benchmark for
 * single-member and multi-member ward results alike — for single-member it
 * collapses to 50% (the AV majority threshold).
 */
export function quotaForSeats(seats: number): number {
  if (!Number.isFinite(seats) || seats < 1) return 0.5;
  return 1 / (seats + 1);
}

/**
 * How far below the proportional quota the marginal elected candidate's
 * share fell, in fraction-of-valid-ballots units. Positive = below par
 * (the editorial indictment), negative = above par.
 */
export function underPar(r: Race): number {
  return quotaForSeats(r.seats) - raceWinningPct(r);
}

/** True when the marginal winner's share fell below the proportional quota. */
export function isBelowQuota(r: Race): boolean {
  return underPar(r) > 0;
}
