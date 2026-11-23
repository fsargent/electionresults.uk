import { seneddCatalog } from '$lib/senedd/data';

export const prerender = true;

export function load() {
  return { elections: seneddCatalog() };
}
