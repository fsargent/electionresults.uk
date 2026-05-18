// Parliament data accessor. SSR-only — every function reads the
// per-year JSON from disk via node:fs at call time and returns the
// unwrapped payload (the `_manifest` block is still accessible by
// loaders that need it; see `manifestForYear`).
//
// Stays mutually unaware of `src/lib/data.ts` per AR5: never imports
// from the council accessor, and the council accessor never imports
// from this file. The two domains evolve independently.
//
// Stubs throw `not yet implemented` until Story 2.5 lands. They're
// here in Story 2.1 so types compile and downstream stories can wire
// loaders against the final shape without further refactoring.

import type {
  ConstituencyContest,
  NationalSummary,
  NationalPartyTotal,
  SourceManifest
} from './types';

const NOT_YET_IMPLEMENTED =
  'src/lib/parliament/data.ts: not yet implemented — lands in Story 2.5 (parliament ETL).';

export function constituencyContestsForYear(_year: number): ConstituencyContest[] {
  throw new Error(NOT_YET_IMPLEMENTED);
}

export function nationalSummaryForYear(_year: number): NationalSummary {
  throw new Error(NOT_YET_IMPLEMENTED);
}

export function partyTotalsForYear(_year: number): NationalPartyTotal[] {
  throw new Error(NOT_YET_IMPLEMENTED);
}

export function manifestForYear(_year: number): SourceManifest {
  throw new Error(NOT_YET_IMPLEMENTED);
}

export function ingestedYears(): number[] {
  throw new Error(NOT_YET_IMPLEMENTED);
}
