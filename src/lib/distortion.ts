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
 * Multi-member: the marginal (lowest-vote) elected candidate's share — they
 * are the most-vulnerable mandate in the ward, so the headline % surfaces
 * how thin the weakest seat-holder's support actually was.
 */
export function raceWinningPct(r: Race): number {
  const pcts = electedWinningPcts(r);
  if (pcts.length === 0) return 0;
  return Math.min(...pcts);
}

export function isMinority(pct: number): boolean {
  return pct < 0.5;
}

function formatPct(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`;
}

/**
 * One-sentence editorial line that names the voting method as the subject,
 * not the candidate. Templates vary by ward type and winning-% bracket.
 */
export function systemObservation(r: Race): string {
  const pct = raceWinningPct(r);
  const pctStr = formatPct(pct);
  const multi = r.seats > 1;
  const method = multi
    ? 'multi-member bloc vote (a variant of First-Past-the-Post)'
    : 'First-Past-the-Post';

  if (!isMinority(pct)) {
    return multi
      ? `Under the ${method}, the most-marginal of the ${r.seats} elected candidates was returned on ${pctStr} of valid ballots — a clear majority mandate.`
      : `Under ${method}, this seat was won on ${pctStr} of valid ballots — a clear majority of voters supported the winner.`;
  }

  if (pct < 0.25) {
    return multi
      ? `Under the ${method}, the most-marginal of the ${r.seats} elected candidates was returned on ${pctStr} of valid ballots — fewer than one in four voters supported them. A preferential or proportional method (such as STV, used in Scottish local elections) would have required broader support.`
      : `Under ${method}, this seat was won on ${pctStr} of valid ballots — fewer than one in four voters supported the winner. A preferential method such as the Alternative Vote, or a proportional method such as STV (used in Scottish local elections), would have required the eventual winner to assemble broader support.`;
  }

  if (pct < 0.34) {
    return multi
      ? `Under the ${method}, the most-marginal of the ${r.seats} elected candidates was returned on ${pctStr} of valid ballots — fewer than a third of voters supported them. STV (used in Scottish local elections) would not have produced this result.`
      : `Under ${method}, this seat was won on ${pctStr} of valid ballots — fewer than a third of voters supported the winner. The Alternative Vote, or STV as used in Scottish local elections, would have required the winner to attract additional support.`;
  }

  return multi
    ? `Under the ${method}, the most-marginal of the ${r.seats} elected candidates was returned on ${pctStr} of valid ballots — more voters opposed than supported them. STV (used in Scottish local elections) would have produced a different result.`
    : `Under ${method}, this seat was won on ${pctStr} of valid ballots — more voters opposed the winner than supported them. The Alternative Vote or STV would have required broader support.`;
}
