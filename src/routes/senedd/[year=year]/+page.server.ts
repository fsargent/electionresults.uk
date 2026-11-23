import { error } from '@sveltejs/kit';
import { seneddElection, seneddYears } from '$lib/senedd/data';

export const prerender = true;

export function entries() {
  return seneddYears().map((year) => ({ year: String(year) }));
}

export function load({ params }: { params: { year: string } }) {
  const election = seneddElection(Number(params.year));
  if (!election) throw error(404, `No Senedd election data for ${params.year}`);
  return { election };
}
