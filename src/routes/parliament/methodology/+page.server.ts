// Static methodology surface for /parliament. No runtime data — the
// loader is here purely to declare prerender = true. Content lives in
// +page.svelte; manifest fields cited inline are kept in sync with the
// JSON envelopes by hand because the methodology page is read for
// trust, not freshness (re-touching prose for every ETL rerun would
// add noise without changing the methodology).

export const prerender = true;
