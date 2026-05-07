import {
  allFlips,
  yearOptions,
  partyOptions,
  distinctCouncilSlugs,
  compositionForCouncilYear,
  latestFlipByCouncil
} from '$lib/data';

export const prerender = true;

export function load() {
  // /flips is the council-control-changes lens: a flip is when the
  // largest party in the running composition actually changed. Sorted
  // by recency (most recent flip first), tiebreak by yearFrom desc so
  // a 2024→2025 flip outranks a 2023→2025 multi-cycle flip with the
  // same yearTo. The disproportion score that ranked this list before
  // mixed a composition-shift numerator with a per-cycle vote-shift
  // denominator — partly real FPTP distortion, partly mechanical
  // artefact of all-out vs by-thirds. The FPTP distortion story now
  // lives at /distortion (per-election, apples-to-apples).
  const rowsByRecency = [...allFlips].sort(
    (a, b) => b.yearTo - a.yearTo || b.yearFrom - a.yearFrom
  );
  // For each flip, pull the actual before/after composition from the
  // truth-set so the page can show real party-by-party seat counts
  // either side of the change rather than just the two-party shift.
  const rowsWithComposition = rowsByRecency.map((f) => ({
    ...f,
    compositionFrom: compositionForCouncilYear(f.councilSlug, f.yearFrom) ?? null,
    compositionTo: compositionForCouncilYear(f.councilSlug, f.yearTo) ?? null
  }));
  return {
    rows: rowsWithComposition,
    mapEntries: [...latestFlipByCouncil().values()],
    years: yearOptions(),
    parties: partyOptions(),
    councils: distinctCouncilSlugs()
  };
}
