// Council STV domain data (Scotland 2022, Northern Ireland 2023).
// Written by scripts/etl.mjs via scripts/lib/council-stv.mjs. Unlike the
// Race records, these keep no-poll wards (vote fields null, never 0),
// seat/vacancy reconciliation, official count stages and per-contest sources.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface StvSource { label: string; url: string; licence: string; file?: string | null; sheet?: string | null; sha256?: string | null; format?: string }
export interface StvCandidate { name: string; party: string; sourceParty?: string; firstPreferences: number | null; elected: boolean; sourceStatus?: string | null }
export interface StvStage { number: number; action: string; incomplete?: boolean; totals: (number | null)[]; changes: (number | null)[]; nonTransferable: number | null }
export interface StvContest {
  councilSlug: string; council: string; area: string; areaType: 'ward' | 'DEA'; areaSlug: string; areaCode: string | null;
  seats: number; contested: boolean; seatsFilled: number; vacancies: number;
  electorate: number | null; validBallots: number | null; invalidBallots: number | null; quota: number | null;
  candidates: StvCandidate[]; stages: StvStage[] | null;
  firstPreferenceSource: string | null; sources: StvSource[]; notes: string[];
}
export interface StvCouncilRow { slug: string; name: string; contests: number; contested: number; noPoll: number; seats: number; seatsFilled: number; vacancies: number }
export interface StvDomain {
  id: string; nation: 'scotland' | 'northern-ireland'; year: number; date: string; name: string; href: string; system: 'STV';
  summary: { councils: number; contests: number; contested: number; noPoll: number; seats: number; seatsFilled: number; vacancies: number; validBallots: number; withStages: number };
  councils: StvCouncilRow[];
  parties: { party: string; firstPreferences: number; seats: number; unopposedSeats: number }[];
  sources: StvSource[];
  contests: StvContest[];
}

const DIR = resolve(process.cwd(), 'src/lib/data/council-stv');
const cache = new Map<string, StvDomain | null>();

export function stvDomain(nation: string, year: number): StvDomain | null {
  const key = `${nation}-${year}`;
  if (!cache.has(key)) {
    const path = resolve(DIR, `${key}.json`);
    cache.set(key, existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as StvDomain) : null);
  }
  return cache.get(key)!;
}

const STV_ELECTIONS: [string, number][] = [['scotland', 2022], ['northern-ireland', 2023]];

/** Contests for one council in one year, or [] when not an STV election. */
export function stvContestsFor(year: number, councilSlug: string): StvContest[] {
  for (const [nation, y] of STV_ELECTIONS) {
    if (y !== year) continue;
    const d = stvDomain(nation, y);
    const hits = d?.contests.filter((c) => c.councilSlug === councilSlug) ?? [];
    if (hits.length) return hits;
  }
  return [];
}

export function stvDomainForCouncil(year: number, councilSlug: string): StvDomain | null {
  for (const [nation, y] of STV_ELECTIONS) {
    if (y !== year) continue;
    const d = stvDomain(nation, y);
    if (d?.councils.some((c) => c.slug === councilSlug)) return d;
  }
  return null;
}
