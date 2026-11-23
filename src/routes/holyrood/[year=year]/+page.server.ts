import { error } from '@sveltejs/kit';
import { holyroodElection, holyroodYears } from '$lib/holyrood/data';

export const prerender = true;

export function entries() {
  return holyroodYears().map((y) => ({ year: String(y) }));
}

export function load({ params }: { params: { year: string } }) {
  const e = holyroodElection(Number(params.year));
  if (!e) throw error(404, `No Scottish Parliament results for ${params.year}`);
  const majority = Math.floor(e.members.total / 2) + 1;
  return {
    year: e.year,
    date: e.date,
    name: e.name,
    system: e.system,
    boundaries: e.boundaries,
    asElected: e.asElected,
    members: e.members,
    majority,
    parties: e.parties,
    seats: e.seats,
    constituencyVote: e.constituencyVote,
    regionalVote: e.regionalVote,
    regions: e.regions.map((r) => ({
      slug: r.slug,
      name: r.name,
      turnout: r.turnout,
      parties: r.parties.filter((p) => p.constituencySeats + p.regionalSeats > 0),
      members: r.members,
      constituencyCount: r.constituencySlugs.length
    })),
    constituencies: e.constituencies.map((c) => ({
      slug: c.slug,
      name: c.name,
      regionSlug: c.regionSlug,
      winner: c.winner,
      share: c.candidates[0].share,
      majority: c.majority,
      validVotes: c.validVotes,
      turnout: c.turnout
    })),
    discrepancies: e.discrepancies,
    sourcesElection: { sources: e.sources, asElected: e.asElected }
  };
}
