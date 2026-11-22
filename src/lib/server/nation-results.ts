import { allRaces } from '$lib/data';
import hexData from '$lib/data/hexes.json';
import type { Race } from '$lib/types';

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
export function nationResults(nation: Nation, year: number, races: Race[] = allRaces) {
  const selected = races.filter(r => r.year === year && nationForRace(r) === nation);
  const councils = [...new Set(selected.map(r => r.councilSlug))].map(slug => {
    const wards = selected.filter(r => r.councilSlug === slug);
    return { slug, mapSlug: slug === 'edinburgh' ? 'city-of-edinburgh' : slug, name: wards[0].council, wards: wards.length,
      seats: wards.reduce((n, r) => n + r.candidates.filter(c => c.elected).length, 0) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const totals = new Map<string, { party: string; votes: number; seats: number }>();
  for (const r of selected) for (const c of r.candidates) {
    const party = c.party || 'Independent';
    const row = totals.get(party) ?? { party, votes: 0, seats: 0 };
    row.votes += c.votes; row.seats += Number(c.elected); totals.set(party, row);
  }
  return { nation, year, name: nation === 'northern-ireland' ? 'Northern Ireland' : nation[0].toUpperCase() + nation.slice(1), councils,
    dates: [...new Set(selected.map(r => r.electionDate))].sort(),
    years: [...new Set(races.filter(r => nationForRace(r) === nation).map(r => r.year))].sort((a,b) => b-a),
    wards: selected.length, parties: [...totals.values()].sort((a, b) => b.seats - a.seats || b.votes - a.votes),
    seats: councils.reduce((n, c) => n + c.seats, 0) };
}

export function yearResults(year: number, races: Race[] = allRaces) {
  const groups = nations.map(nation => nationResults(nation, year, races));
  return { year, groups, years: [...new Set(races.map(r => r.year))].sort((a,b) => b-a),
    wards: groups.reduce((n,g) => n+g.wards,0),
    seats: groups.reduce((n,g) => n+g.seats,0),
    councils: groups.reduce((n,g) => n+g.councils.length,0) };
}
