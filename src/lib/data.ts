import snapshot from './data/generated.json';
import type { Race, CouncilSummary, Candidate } from './types';

interface SnapshotMarginal {
  candidateName: string;
  party: string;
  partyAbbrev: string | null;
  votes: number;
  winningPct: number;
  quota: number;
  underPar: number;
  wardName: string;
  wardSlug: string;
  council: string;
  councilSlug: string;
  seats: number;
  validBallots: number;
}

interface Snapshot {
  generatedAt: string;
  source: string;
  electionDate: string;
  electionDateLabel: string;
  cycleLabel: string;
  totals: {
    councils: number;
    races: number;
    seats: number;
    belowQuotaSeats: number;
  };
  councils: CouncilSummary[];
  races: Race[];
  marginalWinners: SnapshotMarginal[];
}

const data = snapshot as unknown as Snapshot;

export const generatedAt = data.generatedAt;
export const cycleLabel = data.cycleLabel;
export const electionDate = data.electionDate;
export const electionDateLabel = data.electionDateLabel;
export const sourceLabel = data.source;
export const totals = data.totals;

export const allCouncils: CouncilSummary[] = data.councils;
export const allRaces: Race[] = data.races;
export const allMarginalWinners: SnapshotMarginal[] = data.marginalWinners;

export function councilBySlug(slug: string): CouncilSummary | undefined {
  return allCouncils.find((c) => c.councilSlug === slug);
}

export function racesByCouncil(slug: string): Race[] {
  // Sort by under-par descending — the seats most below the proportional
  // quota first; ties break on ward name for stable rendering.
  return allRaces
    .filter((r) => r.councilSlug === slug)
    .sort((a, b) => b.underPar - a.underPar || a.wardName.localeCompare(b.wardName));
}

/** Top N elected seats furthest below the proportional quota, sorted desc. */
export function topBelowQuota(limit: number): SnapshotMarginal[] {
  return allMarginalWinners.filter((m) => m.underPar > 0).slice(0, limit);
}

/**
 * Roll up marginal winners into one row per race (race-as-unit, not
 * candidate-as-unit). For multi-member wards, the lowest-share elected
 * candidate is the row, matching raceWinningPct.
 */
export interface RaceLeaderboardRow {
  wardName: string;
  wardSlug: string;
  council: string;
  councilSlug: string;
  seats: number;
  validBallots: number;
  winningPct: number;
  quota: number;
  underPar: number;
  marginalCandidate: string;
  marginalParty: string;
  marginalPartyAbbrev: string | null;
  marginalVotes: number;
}

export function raceLeaderboard(): RaceLeaderboardRow[] {
  const byWard = new Map<string, RaceLeaderboardRow>();
  for (const m of allMarginalWinners) {
    const key = `${m.councilSlug}::${m.wardSlug}`;
    const existing = byWard.get(key);
    if (!existing || m.underPar > existing.underPar) {
      byWard.set(key, {
        wardName: m.wardName,
        wardSlug: m.wardSlug,
        council: m.council,
        councilSlug: m.councilSlug,
        seats: m.seats,
        validBallots: m.validBallots,
        winningPct: m.winningPct,
        quota: m.quota,
        underPar: m.underPar,
        marginalCandidate: m.candidateName,
        marginalParty: m.party,
        marginalPartyAbbrev: m.partyAbbrev,
        marginalVotes: m.votes
      });
    }
  }
  return [...byWard.values()].sort(
    (a, b) => b.underPar - a.underPar || a.marginalVotes - b.marginalVotes
  );
}

export function partyOptions(): string[] {
  const set = new Set<string>();
  for (const m of allMarginalWinners) {
    if (m.party) set.add(m.party);
  }
  return [...set].sort();
}

export function councilOptions(): { slug: string; council: string }[] {
  return allCouncils.map((c) => ({ slug: c.councilSlug, council: c.council }));
}

export function raceCount(): number {
  return totals.races;
}

export function electedFromRace(race: Race): Candidate[] {
  return race.candidates.filter((c) => c.elected);
}
