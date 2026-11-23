import { error } from '@sveltejs/kit';
import { assemblyResults } from '$lib/assembly/data.server';
export const prerender = true;
export function entries() { return assemblyResults.contests.map(c=>({constituency:c.slug})); }
export function load({params}:{params:{constituency:string}}) {
  const contest=assemblyResults.contests.find(c=>c.slug===params.constituency);
  if(!contest) error(404,'Unknown Assembly constituency');
  return {contest};
}
