import { error } from '@sveltejs/kit';
import {
  councilHistory,
  distinctCouncilSlugs,
  flipsForCouncil,
  wardHistoryForCouncil
} from '$lib/data';

export const prerender = true;

export function entries() {
  return distinctCouncilSlugs().map((c) => ({ council: c.councilSlug }));
}

export function load({ params }: { params: { council: string } }) {
  const history = councilHistory(params.council);
  if (!history) throw error(404, `Council not found: ${params.council}`);
  const flips = flipsForCouncil(params.council);
  const wards = wardHistoryForCouncil(params.council);
  return { history, flips, wards };
}
