import { error } from '@sveltejs/kit';
import {
  councilForYearAndSlug,
  racesForYearAndCouncil,
  allCouncilEntries,
  cycleByYear,
  partyViewForYearAndCouncil,
  compositionForCouncilYear
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
  // Before/after pair from opencouncildata: year-Y snapshot reflects
  // the council AFTER the May-Y elections (verified empirically), so
  // before = year-1, after = year.
  const compositionBefore =
    compositionForCouncilYear(params.council, year - 1) ?? null;
  const compositionAfter =
    compositionForCouncilYear(params.council, year) ?? null;
  return {
    council,
    races,
    cycle,
    partyView,
    compositionBefore,
    compositionAfter
  };
}
