import { sourceLabel, cycleLabel } from '$lib/data';

export const prerender = true;

export function load() {
  return { sourceLabel, cycleLabel };
}
