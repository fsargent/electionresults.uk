// Parliament data accessor. SSR-only — every function reads the
// per-year JSON from disk via node:fs at call time and returns the
// unwrapped `data` payload. Loaders that also need provenance call
// `manifestForYear`.
//
// Stays mutually unaware of `src/lib/data.ts` per AR5: never imports
// from the council accessor, and the council accessor never imports
// from this file. The two domains evolve independently.
//
// We resolve paths from process.cwd() (mirrors src/lib/data.ts) so the
// accessor keeps working after Vite bundles it into the SSR output.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  IngestedConstituency,
  NationalSummary,
  NationalPartyTotal,
  ParliamentIndex,
  ParliamentSplit,
  SourceManifest
} from './types';

const DATA_ROOT = 'src/lib/data/parliament';

function readSplit<T>(year: number, name: string): ParliamentSplit<T> {
  const path = resolve(process.cwd(), DATA_ROOT, String(year), name);
  return JSON.parse(readFileSync(path, 'utf8')) as ParliamentSplit<T>;
}

function readIndex(): ParliamentIndex {
  const path = resolve(process.cwd(), DATA_ROOT, 'index.json');
  return JSON.parse(readFileSync(path, 'utf8')) as ParliamentIndex;
}

export function ingestedYears(): number[] {
  return [...readIndex().years].sort((a, b) => b - a);
}

export function constituenciesForYear(year: number): IngestedConstituency[] {
  return readSplit<IngestedConstituency[]>(year, 'constituencies.json').data;
}

export function nationalSummaryForYear(year: number): NationalSummary {
  return readSplit<NationalSummary>(year, 'national-summary.json').data;
}

export function partyTotalsForYear(year: number): NationalPartyTotal[] {
  return readSplit<NationalPartyTotal[]>(year, 'party-totals.json').data;
}

/**
 * Source manifest for a given ingested year. Every per-year split file
 * carries the same manifest block, so we read the lightest one
 * (`manifest.json`) rather than parse the full constituencies payload.
 */
export function manifestForYear(year: number): SourceManifest {
  return readSplit<unknown>(year, 'manifest.json')._manifest;
}
