import snapshot from './data/generated.json';
import type {
  Race,
  CouncilSummary,
  CycleSummary,
  Candidate,
  PartyView,
  CouncilFlip,
  CouncilReorganisation
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
  reorganisations: CouncilReorganisation[];
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
export const allReorganisations: CouncilReorganisation[] = data.reorganisations;

export function reorganisationForCouncil(
  slug: string
): CouncilReorganisation | null {
  return allReorganisations.find((r) => r.councilSlug === slug) ?? null;
}

export function flipsForCouncil(slug: string): CouncilFlip[] {
  // Most recent first — readers care about the latest control change.
  return allFlips
    .filter((f) => f.councilSlug === slug)
    .sort((a, b) => b.yearTo - a.yearTo || b.yearFrom - a.yearFrom);
}

/**
 * Current composition of a council: take each ward's most recent race
 * (whichever cycle that was) and sum elected candidates by party. For
 * all-out councils every ward's latest race is in the same cycle; for
 * by-thirds councils the wards' latest races are spread across the last
 * three cycles. Either way the result is "who currently holds the seats
 * in each ward, summed".
 *
 * Caveat: ward names matched across cycles are an approximation
 * (boundary reviews can split / merge / rename wards).
 */
export interface CouncilComposition {
  /** The cycles aggregated to form the composition (ascending). */
  yearsCovered: number[];
  /** Total seats summed across those cycles. */
  totalSeats: number;
  rows: { party: string; seats: number }[];
}

/**
 * Approximate "currently sitting" composition: sum elected candidates
 * from cycles within two years of the council's latest cycle. That window
 * captures a full term for by-thirds councils (3 consecutive years) and
 * the latest term for all-out councils (whose prior cycle is 4 years
 * earlier and therefore excluded — those councillors were replaced).
 * For by-halves councils, alternate years contribute, also matching a
 * full term over 3 calendar years.
 *
 * Caveat: boundary reviews mid-term can over- or under-count slightly.
 * Wards renamed or restructured between cycles produce new races that
 * sum into the total alongside their predecessor wards, so a council in
 * the middle of a boundary change can show more "seats" than it has.
 */
export function currentCouncilComposition(slug: string): CouncilComposition {
  const races = allRaces.filter((r) => r.councilSlug === slug);
  if (races.length === 0) return { yearsCovered: [], totalSeats: 0, rows: [] };
  const yearsDesc = [...new Set(races.map((r) => r.year))].sort(
    (a, b) => b - a
  );
  const latest = yearsDesc[0];
  const yearsCovered = yearsDesc
    .filter((y) => latest - y <= 2)
    .sort((a, b) => a - b);
  const yearSet = new Set(yearsCovered);
  const byParty = new Map<string, number>();
  let totalSeats = 0;
  for (const r of races) {
    if (!yearSet.has(r.year)) continue;
    for (const c of r.candidates.filter((c) => c.elected)) {
      byParty.set(c.party, (byParty.get(c.party) ?? 0) + 1);
      totalSeats += 1;
    }
  }
  const rows = [...byParty.entries()]
    .map(([party, seats]) => ({ party, seats }))
    .sort((a, b) => b.seats - a.seats);
  return { yearsCovered, totalSeats, rows };
}

/**
 * For each council, the most recent flip we have. Used by the homepage
 * "year-over-year flips" map so each hex shows the latest control change.
 */
export function latestFlipByCouncil(): Map<string, CouncilFlip> {
  const out = new Map<string, CouncilFlip>();
  for (const f of allFlips) {
    const cur = out.get(f.councilSlug);
    if (!cur || f.yearTo > cur.yearTo) out.set(f.councilSlug, f);
  }
  return out;
}

export interface WardHistoryCell {
  year: number;
  winnerName: string;
  winnerParty: string;
  winnerVotes: number;
  winningPct: number;
  seats: number;
  validBallots: number;
}

export interface WardHistoryRow {
  wardName: string;
  /** Sorted by year descending (most recent first). */
  cells: WardHistoryCell[];
}

export interface WardHistory {
  years: number[]; // descending
  rows: WardHistoryRow[]; // alphabetical by wardName
}

/**
 * Build a per-ward, per-year matrix for one council. Rows are wards (matched
 * by name across cycles — see methodology re: boundary changes); columns
 * are the cycles this council has data for, most recent first.
 *
 * For each (ward, year) cell we surface the top-of-poll candidate (highest
 * votes), their party, and that candidate's share of valid ballots. This
 * is the "who won this ward this year" lens, complementing the
 * council-level flip viz above.
 */
export function wardHistoryForCouncil(slug: string): WardHistory {
  const races = allRaces.filter((r) => r.councilSlug === slug);
  const yearsSet = new Set<number>();
  const byWard = new Map<string, Map<number, WardHistoryCell>>();
  for (const r of races) {
    yearsSet.add(r.year);
    const top = [...r.candidates].sort((a, b) => b.votes - a.votes)[0];
    if (!top) continue;
    const winningPct = r.validBallots > 0 ? top.votes / r.validBallots : 0;
    if (!byWard.has(r.wardName)) byWard.set(r.wardName, new Map());
    byWard.get(r.wardName)!.set(r.year, {
      year: r.year,
      winnerName: top.name,
      winnerParty: top.party,
      winnerVotes: top.votes,
      winningPct,
      seats: r.seats,
      validBallots: r.validBallots
    });
  }
  // Years go left-to-right ascending so the latest cycle is on the right.
  const years = [...yearsSet].sort((a, b) => a - b);
  const rows: WardHistoryRow[] = [...byWard.entries()]
    .map(([wardName, perYear]) => ({
      wardName,
      cells: [...perYear.values()].sort((a, b) => a.year - b.year)
    }))
    .sort((a, b) => a.wardName.localeCompare(b.wardName));
  return { years, rows };
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
      // Most-negative-first: races furthest below the quota lead.
      (a, b) => a.underPar - b.underPar || a.wardName.localeCompare(b.wardName)
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
    // Pick the most-marginal candidate (smallest share = most-negative underPar)
    // as the headline row for the race.
    if (!existing || m.underPar < existing.underPar) {
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
    // Most-negative-first: seats furthest below the quota lead.
    (a, b) => a.underPar - b.underPar || a.marginalVotes - b.marginalVotes
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
