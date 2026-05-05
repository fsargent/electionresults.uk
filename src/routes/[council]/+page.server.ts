import { error } from '@sveltejs/kit';
import { councilBySlug, racesByCouncil, allCouncils, electionDateLabel } from '$lib/data';

export const prerender = true;

export function entries() {
  return allCouncils.map((c) => ({ council: c.councilSlug }));
}

export function load({ params }: { params: { council: string } }) {
  const council = councilBySlug(params.council);
  if (!council) throw error(404, `Council not found: ${params.council}`);
  const races = racesByCouncil(params.council).map((race) => ({ race }));
  return { council, races, electionDateLabel };
}
