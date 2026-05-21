import {
  partyForSlug,
  partySlugs,
  partyTrend,
  allPartyControlChanges,
  allCycles,
  allCompositions
} from '$lib/data';
import type { CompositionSnapshot, PartyYearStats } from '$lib/types';

export const prerender = true;

export interface PartyOverview {
  slug: string;
  name: string;
  trend: PartyYearStats[];
  /** Latest chamber-side row in the trend, used for the headline cards. */
  latest: PartyYearStats | null;
  /** Sum of all council-control gains across our window. */
  totalGained: number;
  /** Sum of all council-control losses across our window. */
  totalLost: number;
}

export interface CycleContext {
  year: number;
  electionDateLabel: string;
  councilCount: number;
  seatCount: number;
  /** Prior cycle year in the same family (year - 4) when we have data
   *  for it; otherwise null. Used to anchor the "same councils last
   *  polled in" caption. */
  priorYear: number | null;
}

export function load() {
  const parties: PartyOverview[] = partySlugs().map((slug) => {
    const name = partyForSlug(slug)!;
    const trend = partyTrend(name);
    const chamberRows = trend.filter((r) => r.chamberTotal > 0);
    const latest = chamberRows[chamberRows.length - 1] ?? null;
    const totalGained = allPartyControlChanges
      .filter((c) => c.party === name)
      .reduce((sum, c) => sum + c.councilsGained.length, 0);
    const totalLost = allPartyControlChanges
      .filter((c) => c.party === name)
      .reduce((sum, c) => sum + c.councilsLost.length, 0);
    return { slug, name, trend, latest, totalGained, totalLost };
  });

  // The full set of years anyone has data for, ascending. Used as the
  // shared X-axis on the cumulative-footprint chart so every party
  // plots against the same domain.
  const yearSet = new Set<number>();
  for (const p of parties) {
    for (const s of p.trend) yearSet.add(s.year);
  }
  const years = [...yearSet].sort((a, b) => a - b);

  // Recent election cycles (descending), capped at three. Section A
  // renders one panel per cycle; Section B renders one slope per
  // party using the most-recent cycle pair the party participated in.
  const cycleYears = new Set<number>();
  for (const p of parties) {
    for (const s of p.trend) {
      if (s.contestedSeats > 0) cycleYears.add(s.year);
    }
  }
  const recentCycles: CycleContext[] = [...cycleYears]
    .sort((a, b) => b - a)
    .slice(0, 3)
    .map((year) => {
      const summary = allCycles.find((c) => c.year === year);
      const prior = cycleYears.has(year - 4) ? year - 4 : null;
      return {
        year,
        electionDateLabel:
          summary?.electionDateLabel ?? String(year),
        councilCount: summary?.councilCount ?? 0,
        seatCount: summary?.seatCount ?? 0,
        priorYear: prior
      };
    });

  // Default visibility: show the five England-wide parties; hide the
  // regional parties (SNP, Plaid Cymru) initially so the cumulative-
  // footprint chart isn't dominated by ~2% horizontal lines. Users
  // can toggle anything.
  const defaultVisible = new Set([
    'labour',
    'conservative',
    'liberal-democrats',
    'green',
    'reform'
  ]);

  // Current control map: take each council's most recent composition
  // snapshot and pick the single largest specific group. We prefer the
  // per-councillor breakdown (`partiesDetailed`) so a council dominated
  // by a named local slate (Ashfield Independents, Aspire, Havering
  // Residents Association, etc.) is labelled by that slate rather than
  // dumped into NOC just because oncd's summary CSV lumps it into
  // "Other". Falls back to the summary fields when no per-councillor
  // snapshot exists. NOC is reserved for genuine ties or missing data.
  const NO_CONTROL = '__noc__';
  // Bucket key used for any independent/local-party leader. We collapse
  // every specific slate into one legend entry to keep the legend
  // readable; the specific slate name still surfaces in the tooltip.
  const IND_LOCAL = '__ind_local__';
  const namedPartySlugs = partySlugs();
  const namedNameToSlug = new Map(
    namedPartySlugs.map((s) => [partyForSlug(s)!, s])
  );
  const latestPerCouncil = new Map<string, CompositionSnapshot>();
  for (const c of allCompositions) {
    const prev = latestPerCouncil.get(c.councilSlug);
    if (!prev || c.year > prev.year) latestPerCouncil.set(c.councilSlug, c);
  }

  type ControlEntry = {
    councilSlug: string;
    council: string;
    year: number;
    /** Bucket key for legend grouping: a named-party slug, IND_LOCAL,
     *  or NO_CONTROL. */
    bucket: string;
    /** Specific largest group display name (e.g. "Labour Party",
     *  "Ashfield Independents", "Independent"); null for NOC. */
    largestName: string | null;
    /** Seats held by that specific group. */
    largestSeats: number;
    totalSeats: number;
    /** True when largestSeats > totalSeats / 2. */
    hasMajority: boolean;
  };

  const controlByCouncil: Record<string, ControlEntry> = {};
  // Two parallel count maps so the legend can switch with the view.
  const largestCounts: Record<string, number> = { [NO_CONTROL]: 0, [IND_LOCAL]: 0 };
  const majorityCounts: Record<string, number> = { [NO_CONTROL]: 0, [IND_LOCAL]: 0 };
  for (const slug of namedPartySlugs) {
    largestCounts[slug] = 0;
    majorityCounts[slug] = 0;
  }

  for (const snap of latestPerCouncil.values()) {
    // Find the single largest specific group. Use partiesDetailed when
    // available (it can name a specific local slate); otherwise fall
    // back to the summary largestParty (may be the literal "Other").
    let largestName: string | null = null;
    let largestSeats = 0;
    let tiedAtTop = false;
    if (snap.partiesDetailed) {
      for (const [name, seats] of Object.entries(snap.partiesDetailed)) {
        if (seats <= 0) continue;
        if (seats > largestSeats) {
          largestName = name;
          largestSeats = seats;
          tiedAtTop = false;
        } else if (seats === largestSeats) {
          tiedAtTop = true;
        }
      }
    } else if (snap.largestParty && snap.largestPartySeats > 0) {
      largestName = snap.largestParty;
      largestSeats = snap.largestPartySeats;
    }

    const hasData = largestName !== null && largestSeats > 0;
    const isNoc = !hasData || tiedAtTop;
    let bucket: string;
    if (isNoc) {
      bucket = NO_CONTROL;
    } else if (largestName && namedNameToSlug.has(largestName)) {
      bucket = namedNameToSlug.get(largestName)!;
    } else {
      // "Independent", "Independent / Other", named local slates, the
      // summary "Other" fallback — all collapse to one legend entry.
      bucket = IND_LOCAL;
    }
    const hasMajority = !isNoc && largestSeats * 2 > snap.totalSeats;
    controlByCouncil[snap.councilSlug] = {
      councilSlug: snap.councilSlug,
      council: snap.council,
      year: snap.year,
      bucket,
      largestName: isNoc ? null : largestName,
      largestSeats,
      totalSeats: snap.totalSeats,
      hasMajority
    };
    largestCounts[bucket] = (largestCounts[bucket] ?? 0) + 1;
    if (hasMajority) {
      majorityCounts[bucket] = (majorityCounts[bucket] ?? 0) + 1;
    } else {
      majorityCounts[NO_CONTROL] = (majorityCounts[NO_CONTROL] ?? 0) + 1;
    }
  }

  return {
    parties,
    years,
    recentCycles,
    defaultVisible: [...defaultVisible],
    controlByCouncil,
    largestCounts,
    majorityCounts,
    NO_CONTROL,
    IND_LOCAL
  };
}
