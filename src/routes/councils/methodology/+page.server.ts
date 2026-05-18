import { sourceLabel, allCycles } from '$lib/data';

export const prerender = true;

export function load() {
  return { sourceLabel, cycles: allCycles };
}
