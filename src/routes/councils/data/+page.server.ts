import { generatedAt, sourceLabel, totals } from '$lib/data';

export const prerender = true;

export function load() {
  return { generatedAt, sourceLabel, totals };
}
