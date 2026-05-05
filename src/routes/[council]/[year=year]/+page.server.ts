import { error } from '@sveltejs/kit';
import {
  councilForYearAndSlug,
  racesForYearAndCouncil,
  allCouncilEntries,
  cycleByYear,
  partyViewForYearAndCouncil
} from '$lib/data';

export const prerender = true;

export function entries() {
  return allCouncilEntries();
}

export function load({ params }: { params: { year: string; council: string } }) {
  const year = Number(params.year);
  if (!Number.isFinite(year)) throw error(404, `Bad year: ${params.year}`);
  const cycle = cycleByYear(year);
  if (!cycle) throw error(404, `No cycle for year ${year}`);
  const council = councilForYearAndSlug(year, params.council);
  if (!council)
    throw error(404, `Council ${params.council} did not poll in ${year}`);
  const races = racesForYearAndCouncil(year, params.council).map((race) => ({
    race
  }));
  const partyView = partyViewForYearAndCouncil(year, params.council) ?? null;
  return { council, races, cycle, partyView };
}
