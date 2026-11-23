// Senedd sitemap fragment. Not wired into src/routes/sitemap.xml by this
// branch: the coordinator adds `...seneddSitemapUrls()` to the merged list.
// URLs come from the same accessor the routes' entries() use, so every
// URL here prerenders.
export { seneddSitemapUrls } from '$lib/senedd/data';
