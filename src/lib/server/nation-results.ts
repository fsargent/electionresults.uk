import { allRaces } from '$lib/data';
import hexData from '$lib/data/hexes.json';
import type { Race } from '$lib/types';
import { stvDomain, type StvDomain } from './council-stv';

export type Nation = 'england' | 'scotland' | 'wales' | 'northern-ireland';
export const nations: Nation[] = ['england', 'scotland', 'wales', 'northern-ireland'];
const scottishSlugs = new Set(hexData.hexes.filter(h => h.onsCode.startsWith('S')).flatMap(h => [h.slug, ...h.aliases]));
scottishSlugs.add('edinburgh');
const northernIrishSlugs = new Set(hexData.hexes.filter(h => h.onsCode.startsWith('N')).flatMap(h => [h.slug, ...h.aliases]));
const welshSlugs = new Set(hexData.hexes.filter(h => h.onsCode.startsWith('W'))
  .flatMap(h => [h.slug, ...h.aliases]));
/** The current council sources cover Great Britain. Older English authorities
 * (including abolished districts and counties) are absent from today's hex map. */
export function nationForRace(race: Race): Nation {
  if (race.wardCode.startsWith('N') || northernIrishSlugs.has(race.councilSlug)) return 'northern-ireland';
  if (race.wardCode.startsWith('S') || scottishSlugs.has(race.councilSlug) || race.authorityType === 'Scottish council') return 'scotland';
  if (race.wardCode.startsWith('W') || welshSlugs.has(race.councilSlug)) return 'wales';
  return 'england';
}
const mapSlugFor = (slug: string) => slug === 'edinburgh' ? 'city-of-edinburgh' : slug;
const nationName = (nation: Nation) => nation === 'northern-ireland' ? 'Northern Ireland' : nation[0].toUpperCase() + nation.slice(1);

/** Coverage block shown for STV elections backed by the council-stv domain
 *  data: every ward/DEA including no-poll ones, and seat reconciliation. */
export interface StvCoverage {
  contests: number; contested: number; noPoll: number; seats: number; seatsFilled: number; vacancies: number;
  withStages: number; areaLabel: string; sources: StvDomain['sources'];
  profileWards: number;
}

export function nationResults(nation: Nation, year: number, races: Race[] = allRaces) {
  const years = [...new Set([
    ...races.filter(r => nationForRace(r) === nation).map(r => r.year)
  ])].sort((a,b) => b-a);
  const domain = races === allRaces && (nation === 'scotland' || nation === 'northern-ireland')
    ? stvDomain(nation, year) : null;
  if (domain) {
    // STV elections: count every ward/DEA, including uncontested ones.
    // Votes are first preferences; no-poll wards contribute seats only.
    const councils = domain.councils.map(c => ({ slug: c.slug, mapSlug: mapSlugFor(c.slug), name: c.name,
      wards: c.contests, seats: c.seatsFilled, seatsAvailable: c.seats, noPoll: c.noPoll, vacancies: c.vacancies }));
    const stv: StvCoverage = { contests: domain.summary.contests, contested: domain.summary.contested,
      noPoll: domain.summary.noPoll, seats: domain.summary.seats, seatsFilled: domain.summary.seatsFilled,
      vacancies: domain.summary.vacancies, withStages: domain.summary.withStages,
      areaLabel: nation === 'northern-ireland' ? 'District Electoral Areas' : 'wards', sources: domain.sources,
      profileWards: domain.contests.filter(c => c.firstPreferenceSource === 'preference profiles').length };
    return { nation, year, name: nationName(nation), councils, dates: [domain.date], years,
      wards: domain.summary.contests,
      parties: domain.parties.map(p => ({ party: p.party, votes: p.firstPreferences, seats: p.seats })),
      seats: domain.summary.seatsFilled, stv };
  }
  const selected = races.filter(r => r.year === year && nationForRace(r) === nation);
  const councils = [...new Set(selected.map(r => r.councilSlug))].map(slug => {
    const wards = selected.filter(r => r.councilSlug === slug);
    return { slug, mapSlug: mapSlugFor(slug), name: wards[0].council, wards: wards.length,
      seats: wards.reduce((n, r) => n + r.candidates.filter(c => c.elected).length, 0),
      seatsAvailable: null as number | null, noPoll: null as number | null, vacancies: null as number | null };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const totals = new Map<string, { party: string; votes: number; seats: number }>();
  for (const r of selected) for (const c of r.candidates) {
    const party = c.party || 'Independent';
    const row = totals.get(party) ?? { party, votes: 0, seats: 0 };
    row.votes += c.votes; row.seats += Number(c.elected); totals.set(party, row);
  }
  return { nation, year, name: nationName(nation), councils,
    dates: [...new Set(selected.map(r => r.electionDate))].sort(),
    years,
    wards: selected.length, parties: [...totals.values()].sort((a, b) => b.seats - a.seats || b.votes - a.votes),
    seats: councils.reduce((n, c) => n + c.seats, 0), stv: null as StvCoverage | null };
}

export function yearResults(year: number, races: Race[] = allRaces) {
  const groups = nations.map(nation => nationResults(nation, year, races));
  return { year, groups, years: [...new Set(races.map(r => r.year))].sort((a,b) => b-a),
    wards: groups.reduce((n,g) => n+g.wards,0),
    seats: groups.reduce((n,g) => n+g.seats,0),
    councils: groups.reduce((n,g) => n+g.councils.length,0) };
}
