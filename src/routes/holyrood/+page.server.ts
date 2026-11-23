import { catalog, holyroodElection, holyroodYears } from '$lib/holyrood/data';

export const prerender = true;

export function load() {
  const latest = holyroodElection(holyroodYears()[0])!;
  return {
    elections: catalog.elections,
    latest: {
      year: latest.year,
      date: latest.date,
      seats: latest.seats,
      parties: latest.parties.filter((p) => latest.seats.some((s) => s.partyId === p.id)),
      constituencyTurnout: latest.constituencyVote.turnout
    }
  };
}
