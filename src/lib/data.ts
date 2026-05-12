// Per-domain split files. Vite tries to inline JSON imports as JS
// object literals, which produced a single 42 MB SSR chunk that V8
// OOM'd parsing on Cloudflare's prerender container. Reading the
// files via fs at module init sidesteps the inlining: each
// JSON.parse hits V8's dedicated JsonParser (much more efficient than
// parsing equivalent-size JS source), and the slices stay independent
// instead of being merged back into one chunk.
//
// data.ts is only loaded during SSR / prerender (the Cloudflare
// Worker tree-shakes it out for the static-asset routes), so node:fs
// is available wherever this module actually runs. ETL still emits
// the merged generated.json for build-og.mjs and the public download.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
function loadSplit<T>(name: string): T {
  // Resolve from project root — prerender always runs from there
  // (`bun run build` invokes vite from the package directory). Using
  // process.cwd() instead of import.meta.url keeps this working after
  // Vite bundles data.ts into .svelte-kit/output/server/chunks/.
  const path = resolve(process.cwd(), 'src/lib/data', name);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
import type {
  Race,
  CouncilSummary,
  CycleSummary,
  Candidate,
  PartyView,
  CouncilFlip,
  CouncilReorganisation,
  CompositionSnapshot,
  PartyYearStats,
  PartyCouncilCycle,
  PartyControlChange
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

export interface Cycle2026CouncilCoverage {
  wardsExpected: number;
  wardsCounted: number;
  complete: boolean;
}

interface CoreSnapshot {
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
  reorganisations: CouncilReorganisation[];
  cycle2026Coverage: Record<string, Cycle2026CouncilCoverage> | null;
}
interface RacesSnapshot {
  races: Race[];
}
interface MarginalSnapshot {
  marginalWinners: SnapshotMarginal[];
}
interface PartiesSnapshot {
  partyViews: PartyView[];
  partyYearStats: PartyYearStats[];
  partyCouncilCycles: PartyCouncilCycle[];
  partyControlChanges: PartyControlChange[];
}
interface FlipsCompSnapshot {
  flips: CouncilFlip[];
  compositions: CompositionSnapshot[];
}

const coreData = loadSplit<CoreSnapshot>('core.json');
const racesSnap = loadSplit<RacesSnapshot>('races.json');
const marginalSnap = loadSplit<MarginalSnapshot>('marginal.json');
const partiesSnap = loadSplit<PartiesSnapshot>('parties.json');
const flipsCompSnap = loadSplit<FlipsCompSnapshot>('flips-comp.json');

export const generatedAt = coreData.generatedAt;
export const sourceLabel = coreData.source;
export const totals = coreData.totals;

export const allCycles: CycleSummary[] = [...coreData.cycles].sort(
  (a, b) => b.year - a.year
);
export const allCouncils: CouncilSummary[] = coreData.councils;
export const allRaces: Race[] = racesSnap.races;
export const allMarginalWinners: SnapshotMarginal[] = marginalSnap.marginalWinners;
export const allPartyViews: PartyView[] = partiesSnap.partyViews;
export const allFlips: CouncilFlip[] = flipsCompSnap.flips;
export const allCompositions: CompositionSnapshot[] = flipsCompSnap.compositions ?? [];
export const allReorganisations: CouncilReorganisation[] = coreData.reorganisations;
export const allPartyYearStats: PartyYearStats[] = partiesSnap.partyYearStats ?? [];
export const allPartyCouncilCycles: PartyCouncilCycle[] =
  partiesSnap.partyCouncilCycles ?? [];
export const allPartyControlChanges: PartyControlChange[] =
  partiesSnap.partyControlChanges ?? [];
export const cycle2026Coverage: Record<string, Cycle2026CouncilCoverage> =
  coreData.cycle2026Coverage ?? {};

/** Slugs of cohort councils with at least one ward still being counted in 2026. */
export function incomplete2026Councils(): Set<string> {
  const out = new Set<string>();
  for (const [slug, c] of Object.entries(cycle2026Coverage)) {
    if (!c.complete) out.add(slug);
  }
  return out;
}

export interface DistortionRow {
  year: number;
  council: string;
  councilSlug: string;
  /** Total seats elected this single cycle. */
  totalSeats: number;
  /** Total votes cast this single cycle. */
  totalVotes: number;
  /** Count of seats FPTP allocated differently from D'Hondt. Sum of
   *  |fptp − dhondt| over parties, divided by 2 (every over-allocation
   *  is matched by an equal under-allocation, so the raw sum
   *  double-counts). 0 = perfectly proportional, higher = more
   *  distorted. */
  reallocated: number;
  /** reallocated / totalSeats — comparable across cycles of different
   *  sizes (a small council with 4 seats reallocated of 12 is more
   *  distorted than a big council with 4 of 60). */
  reallocatedShare: number;
  /** Party with the highest vote share this cycle. */
  voteLeader: { party: string; voteShare: number };
  /** Party that took the most seats this cycle (FPTP allocation). */
  seatLeader: { party: string; fptpSeats: number; fptpSeatShare: number };
  /** Party most over-represented vs proportional (largest positive
   *  seat delta). null when no party gained relative to D'Hondt
   *  (perfectly proportional cycle, rare). */
  mostOver: { party: string; delta: number; voteShare: number; fptpSeatShare: number } | null;
  /** Party most under-represented vs proportional (most negative seat
   *  delta). null when no party lost relative to D'Hondt. */
  mostUnder: { party: string; delta: number; voteShare: number; fptpSeatShare: number } | null;
}

/**
 * For every (council, year) cycle in the data, compute how many seats
 * FPTP reallocated vs the proportional benchmark (D'Hondt). The
 * resulting list is the data behind /distortion. Sorted by
 * reallocatedShare descending so the most-distorted single elections
 * lead.
 */
/**
 * Most recent distortion snapshot per council. Powers the FPTP-distortion
 * choropleth on the homepage and on /distortion — every council gets its
 * freshest data point.
 */
export function latestDistortionPerCouncil(): DistortionRow[] {
  const out = new Map<string, DistortionRow>();
  for (const row of distortionLeaderboard()) {
    const prev = out.get(row.councilSlug);
    if (!prev || row.year > prev.year) out.set(row.councilSlug, row);
  }
  return [...out.values()];
}

export function distortionLeaderboard(): DistortionRow[] {
  const rows: DistortionRow[] = [];
  for (const view of allPartyViews) {
    if (view.rows.length === 0) continue;
    // The FPTP-distortion framing only applies to FPTP councils. STV
    // councils get their own dedicated comparison panel and don't
    // belong on the FPTP leaderboard.
    if ((view.system ?? 'FPTP') !== 'FPTP') continue;
    const reallocated = Math.round(
      view.rows.reduce((sum, r) => sum + Math.abs(r.seatDelta), 0) / 2
    );
    if (view.totalSeats === 0) continue;
    const sortedByVotes = [...view.rows].sort((a, b) => b.voteShare - a.voteShare);
    const sortedBySeats = [...view.rows].sort((a, b) => b.fptpSeats - a.fptpSeats);
    const sortedByOver = [...view.rows].sort((a, b) => b.seatDelta - a.seatDelta);
    const sortedByUnder = [...view.rows].sort((a, b) => a.seatDelta - b.seatDelta);
    const mostOverRow = sortedByOver[0];
    const mostUnderRow = sortedByUnder[0];
    rows.push({
      year: view.year,
      council: view.council,
      councilSlug: view.councilSlug,
      totalSeats: view.totalSeats,
      totalVotes: view.totalVotes,
      reallocated,
      reallocatedShare: reallocated / view.totalSeats,
      voteLeader: {
        party: sortedByVotes[0].party,
        voteShare: sortedByVotes[0].voteShare
      },
      seatLeader: {
        party: sortedBySeats[0].party,
        fptpSeats: sortedBySeats[0].fptpSeats,
        fptpSeatShare: sortedBySeats[0].fptpSeatShare
      },
      mostOver:
        mostOverRow && mostOverRow.seatDelta > 0
          ? {
              party: mostOverRow.party,
              delta: mostOverRow.seatDelta,
              voteShare: mostOverRow.voteShare,
              fptpSeatShare: mostOverRow.fptpSeatShare
            }
          : null,
      mostUnder:
        mostUnderRow && mostUnderRow.seatDelta < 0
          ? {
              party: mostUnderRow.party,
              delta: mostUnderRow.seatDelta,
              voteShare: mostUnderRow.voteShare,
              fptpSeatShare: mostUnderRow.fptpSeatShare
            }
          : null
    });
  }
  // Sort by raw reallocated count desc (more seats moved = bigger
  // story), tiebreak by share desc (intensity), then by recency desc.
  // Sorting by share alone is tempting but small-cycle by-thirds with
  // 7 seats elected can have a 4-of-7 reallocation that's editorially
  // thin compared to e.g. Lewisham 2022's 24-of-54. Raw count
  // surfaces the dramatic large-council stories.
  return rows.sort(
    (a, b) =>
      b.reallocated - a.reallocated ||
      b.reallocatedShare - a.reallocatedShare ||
      b.year - a.year
  );
}

/**
 * Same metric as distortionLeaderboard, but restricted to STV councils
 * (Scotland 2022 + any future Welsh STV adopters from 2027). Used by
 * the homepage to show side-by-side how proportional STV looks
 * compared to the FPTP councils.
 */
export interface StvDistortionRow {
  year: number;
  council: string;
  councilSlug: string;
  totalSeats: number;
  totalVotes: number;
  reallocated: number;
  reallocatedShare: number;
}

export function stvDistortionPerCouncil(): StvDistortionRow[] {
  const rows: StvDistortionRow[] = [];
  for (const view of allPartyViews) {
    if ((view.system ?? 'FPTP') !== 'STV') continue;
    if (view.rows.length === 0 || view.totalSeats === 0) continue;
    const reallocated = Math.round(
      view.rows.reduce((sum, r) => sum + Math.abs(r.seatDelta), 0) / 2
    );
    rows.push({
      year: view.year,
      council: view.council,
      councilSlug: view.councilSlug,
      totalSeats: view.totalSeats,
      totalVotes: view.totalVotes,
      reallocated,
      reallocatedShare: reallocated / view.totalSeats
    });
  }
  return rows.sort((a, b) => a.reallocatedShare - b.reallocatedShare);
}

/**
 * Composition truth-set lookup for one (council, year). Returns
 * undefined when opencouncildata has no snapshot for that key (e.g.
 * the 2026 cycle, where composition data won't exist until oncd
 * publishes it; or the brief LGR window where successor councils
 * appear in our LEH data before a composition snapshot exists for them).
 */
export function compositionForCouncilYear(
  slug: string,
  year: number
): CompositionSnapshot | undefined {
  return allCompositions.find(
    (c) => c.councilSlug === slug && c.year === year
  );
}

/**
 * Most recent composition snapshot for a council. Used by the per-council
 * page to display the running composition (replacing the older sum-
 * across-cycles approximation when truth-set data is available).
 */
export function latestCompositionForCouncil(
  slug: string
): CompositionSnapshot | undefined {
  const ours = allCompositions
    .filter((c) => c.councilSlug === slug)
    .sort((a, b) => b.year - a.year);
  return ours[0];
}

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
  /** Slug of the ward as recorded in this specific cycle's source data
   *  (boundary reviews can mean the same wardName has different slugs
   *  in different cycles — use this slug, not the row's wardSlug, when
   *  linking into a specific cycle's per-ward section). */
  wardSlug: string;
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
  /** Same slug used as the section id on /[council]/[year] — used by the
   *  ward-grid cell links so clicking a year jumps to that ward in the
   *  per-cycle page. */
  wardSlug: string;
  /** Sorted by year ascending (latest cycle on the right). */
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
  // Group by wardName (now ETL-normalised, so " & " / " and " variants
  // collapse). Carry the slug alongside so the ward-grid cell links can
  // anchor to the ward's section on the per-cycle page; if the same
  // ward name has multiple slugs across cycles (boundary recodes), the
  // most recent cycle's slug wins.
  const byWard = new Map<string, { slug: string; cells: Map<number, WardHistoryCell> }>();
  for (const r of races) {
    yearsSet.add(r.year);
    const top = [...r.candidates].sort((a, b) => b.votes - a.votes)[0];
    if (!top) continue;
    const winningPct = r.validBallots > 0 ? top.votes / r.validBallots : 0;
    const existing = byWard.get(r.wardName);
    if (!existing) {
      byWard.set(r.wardName, { slug: r.wardSlug, cells: new Map() });
    } else if (r.year >= Math.max(...existing.cells.keys(), -Infinity)) {
      existing.slug = r.wardSlug;
    }
    byWard.get(r.wardName)!.cells.set(r.year, {
      wardSlug: r.wardSlug,
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
    .map(([wardName, { slug, cells }]) => ({
      wardName,
      wardSlug: slug,
      cells: [...cells.values()].sort((a, b) => a.year - b.year)
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

// --- Party pages -------------------------------------------------------
//
// Slug map lives in $lib/parties so the param matcher (browser-safe)
// can share the same source of truth without pulling in this
// server-only module.
export { partySlugs, partyForSlug, slugForParty } from './parties';

/** Trend rows for one party, ascending by year. */
export function partyTrend(party: string): PartyYearStats[] {
  return allPartyYearStats
    .filter((s) => s.party === party)
    .sort((a, b) => a.year - b.year);
}

export function partyYearStat(
  party: string,
  year: number
): PartyYearStats | null {
  return (
    allPartyYearStats.find((s) => s.party === party && s.year === year) ?? null
  );
}

/** Years a party has any rollup row for — the set of years /[party]/[year]
 *  has data to render. Sorted descending. */
export function yearsForParty(party: string): number[] {
  const set = new Set<number>();
  for (const s of allPartyYearStats) {
    if (s.party === party && (s.contestedSeats > 0 || s.chamberTotal > 0)) {
      set.add(s.year);
    }
  }
  return [...set].sort((a, b) => b - a);
}

/** Per-council results for one (party, year), sorted by seats won desc. */
export function partyCouncilCyclesFor(
  party: string,
  year: number
): PartyCouncilCycle[] {
  return allPartyCouncilCycles
    .filter((r) => r.party === party && r.year === year)
    .sort(
      (a, b) =>
        b.seatsWon - a.seatsWon ||
        b.voteShare - a.voteShare ||
        a.council.localeCompare(b.council)
    );
}

/** Same as `partyCouncilCyclesFor` but indexed by previous-cycle data
 *  for that council, so the per-cycle page can show net change. The
 *  "previous cycle" for a council is the most recent earlier year that
 *  council polled — typically year-4 for all-out councils, year-1 for
 *  by-thirds. Returns rows with `prevSeatsWon` / `prevContestedSeats` /
 *  `netChange` attached; prev fields are null when the council had no
 *  earlier cycle in the dataset. */
export interface PartyCouncilCycleWithChange extends PartyCouncilCycle {
  prevYear: number | null;
  prevSeatsWon: number | null;
  prevContestedSeats: number | null;
  netChange: number | null;
}

export function partyCouncilCyclesWithChange(
  party: string,
  year: number
): PartyCouncilCycleWithChange[] {
  const current = partyCouncilCyclesFor(party, year);
  return current.map((row) => {
    const earlier = allPartyCouncilCycles
      .filter(
        (r) =>
          r.party === party &&
          r.councilSlug === row.councilSlug &&
          r.year < year
      )
      .sort((a, b) => b.year - a.year)[0];
    if (!earlier) {
      return {
        ...row,
        prevYear: null,
        prevSeatsWon: null,
        prevContestedSeats: null,
        netChange: null
      };
    }
    return {
      ...row,
      prevYear: earlier.year,
      prevSeatsWon: earlier.seatsWon,
      prevContestedSeats: earlier.contestedSeats,
      netChange: row.seatsWon - earlier.seatsWon
    };
  });
}

export function partyControlChangesFor(
  party: string,
  year: number
): PartyControlChange | null {
  return (
    allPartyControlChanges.find(
      (c) => c.party === party && c.year === year
    ) ?? null
  );
}
