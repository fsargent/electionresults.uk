import snapshot from './data/generated.json';
import type {
  Race,
  CouncilSummary,
  CycleSummary,
  Candidate,
  PartyView,
  CouncilFlip
} from './types';

interface SnapshotMarginal {
  year: number;
  electionDate: string;
  candidateName: string;
  party: string;
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
  totals: {
    cycles: number;
    councils: number;
    races: number;
    seats: number;
    belowQuotaSeats: number;
  };
  cycles: CycleSummary[];
  councils: CouncilSummary[];
  races: Race[];
  marginalWinners: SnapshotMarginal[];
  partyViews: PartyView[];
  flips: CouncilFlip[];
}

const data = snapshot as unknown as Snapshot;

export const generatedAt = data.generatedAt;
export const sourceLabel = data.source;
export const totals = data.totals;

export const allCycles: CycleSummary[] = [...data.cycles].sort(
  (a, b) => b.year - a.year
);
export const allCouncils: CouncilSummary[] = data.councils;
export const allRaces: Race[] = data.races;
export const allMarginalWinners: SnapshotMarginal[] = data.marginalWinners;
export const allPartyViews: PartyView[] = data.partyViews;
export const allFlips: CouncilFlip[] = data.flips;

export function flipsForCouncil(slug: string): CouncilFlip[] {
  return allFlips
    .filter((f) => f.councilSlug === slug)
    .sort((a, b) => a.yearFrom - b.yearFrom);
}

/**
 * One entry per distinct council across all cycles, with the years that
 * council appears in. Used by the council overview page.
 */
export interface CouncilHistoryEntry {
  councilSlug: string;
  council: string;
  authorityType: string;
  cycles: CouncilSummary[];
}

export function councilHistory(slug: string): CouncilHistoryEntry | null {
  const cycles = allCouncils
    .filter((c) => c.councilSlug === slug)
    .sort((a, b) => b.year - a.year);
  if (cycles.length === 0) return null;
  return {
    councilSlug: slug,
    council: cycles[0].council,
    authorityType: cycles[0].authorityType,
    cycles
  };
}

/** Distinct council slugs (one entry per council across all years). */
export function distinctCouncilSlugs(): { councilSlug: string; council: string }[] {
  const seen = new Map<string, string>();
  for (const c of allCouncils) {
    if (!seen.has(c.councilSlug)) seen.set(c.councilSlug, c.council);
  }
  return [...seen.entries()]
    .map(([councilSlug, council]) => ({ councilSlug, council }))
    .sort((a, b) => a.council.localeCompare(b.council));
}

export function partyViewForYearAndCouncil(
  year: number,
  slug: string
): PartyView | undefined {
  return allPartyViews.find(
    (v) => v.year === year && v.councilSlug === slug
  );
}

/**
 * One CouncilSummary per distinct council slug — the most recent cycle in
 * which that council appears. Used by the homepage hex map to give every
 * council on the layout the freshest data point we have.
 */
export function latestCouncilSummaries(): CouncilSummary[] {
  const byCanonicalSlug = new Map<string, CouncilSummary>();
  for (const c of allCouncils) {
    const existing = byCanonicalSlug.get(c.councilSlug);
    if (!existing || c.year > existing.year) {
      byCanonicalSlug.set(c.councilSlug, c);
    }
  }
  return [...byCanonicalSlug.values()].sort((a, b) =>
    a.council.localeCompare(b.council)
  );
}

export function cycleByYear(year: number): CycleSummary | undefined {
  return allCycles.find((c) => c.year === year);
}

export function councilsForYear(year: number): CouncilSummary[] {
  return allCouncils
    .filter((c) => c.year === year)
    .sort((a, b) => a.council.localeCompare(b.council));
}

export function councilForYearAndSlug(
  year: number,
  slug: string
): CouncilSummary | undefined {
  return allCouncils.find((c) => c.year === year && c.councilSlug === slug);
}

export function racesForYearAndCouncil(
  year: number,
  slug: string
): Race[] {
  return allRaces
    .filter((r) => r.year === year && r.councilSlug === slug)
    .sort(
      (a, b) => b.underPar - a.underPar || a.wardName.localeCompare(b.wardName)
    );
}

/** All (council, year) entries — for sitemap and SvelteKit `entries()`. */
export function allCouncilEntries(): { council: string; year: string }[] {
  return allCouncils.map((c) => ({
    council: c.councilSlug,
    year: String(c.year)
  }));
}

export interface RaceLeaderboardRow {
  year: number;
  electionDate: string;
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
  marginalVotes: number;
}

export function raceLeaderboard(): RaceLeaderboardRow[] {
  // Roll one elected candidacy per race up into the headline row (for
  // multi-seat wards, the marginal — lowest-share — elected candidate).
  const byRace = new Map<string, RaceLeaderboardRow>();
  for (const m of allMarginalWinners) {
    const key = `${m.year}::${m.councilSlug}::${m.wardSlug}`;
    const existing = byRace.get(key);
    if (!existing || m.underPar > existing.underPar) {
      byRace.set(key, {
        year: m.year,
        electionDate: m.electionDate,
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
        marginalVotes: m.votes
      });
    }
  }
  return [...byRace.values()].sort(
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
  // Distinct council names across all years (a council may appear in
  // multiple cycles).
  const seen = new Set<string>();
  const out: { slug: string; council: string }[] = [];
  for (const c of allCouncils) {
    if (!seen.has(c.councilSlug)) {
      seen.add(c.councilSlug);
      out.push({ slug: c.councilSlug, council: c.council });
    }
  }
  return out.sort((a, b) => a.council.localeCompare(b.council));
}

export function yearOptions(): number[] {
  return allCycles.map((c) => c.year);
}

export function electedFromRace(race: Race): Candidate[] {
  return race.candidates.filter((c) => c.elected);
}
