import { nationResults } from '$lib/server/nation-results';
export const prerender = true;
export function load() { return nationResults('wales', 2022); }
