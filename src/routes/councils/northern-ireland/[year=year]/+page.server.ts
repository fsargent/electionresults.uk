import { error } from '@sveltejs/kit';
import { allCycles } from '$lib/data';
import { nationResults } from '$lib/server/nation-results';
export const prerender = true;
export function entries() { return allCycles.map(c => ({ year: String(c.year) })); }
export function load({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  if (!allCycles.some(c => c.year === year)) error(404, 'No council results for this year');
  return nationResults('northern-ireland', year);
}
