import { allRaces } from '$lib/data';
import hexData from '$lib/data/hexes.json';
import type { Race } from '$lib/types';

export type Nation = 'scotland' | 'wales';
const prefixes = { scotland: 'S', wales: 'W' };
export function nationResults(nation: Nation, year: number, races: Race[] = allRaces) {
  const slugs = new Set(hexData.hexes.filter(h => h.onsCode.startsWith(prefixes[nation]))
    .flatMap(h => [h.slug, ...h.aliases]));
  if (nation === 'scotland') slugs.add('edinburgh');
  const selected = races.filter(r => r.year === year && (slugs.has(r.councilSlug)));
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
  return { nation, year, name: nation[0].toUpperCase() + nation.slice(1), councils,
    wards: selected.length, parties: [...totals.values()].sort((a, b) => b.seats - a.seats || b.votes - a.votes),
    seats: councils.reduce((n, c) => n + c.seats, 0) };
}
