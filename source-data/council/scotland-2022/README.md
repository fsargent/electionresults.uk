# Scotland council declarations, 5 May 2022

`emb-results-2022.xlsx` is the original Electoral Management Board for Scotland
workbook of council Returning Officer declarations, downloaded 23 November 2026:
https://www.emb.scot/downloads/file/980/local-government-elections-2022-results-updated-with-postals-station-split

`official-reconciliation.json` includes the workbook SHA-256, source sheet and
original declaration report identifiers. Regenerate with:

```
bun scripts/reconcile-scotland-2022.mjs
bun run etl
```

The RawDetails sheet covers 32 councils, 355 wards and 2,548 candidates, of whom
1,223 are elected. The site retains the existing IndyLive names/ward identifiers
and reconciles every candidate's elected flag to the official return. Explicit
name aliases handle shortened names, spelling differences and encoding errors.
The official workbook supplies all first preferences and polling metadata.
Eight wards have no poll; their vote fields remain null, with three vacant seats.

Two compiled-source corrections: Laura Brennan-Whitefield, Ayr North, has 1,913
first preferences (IndyLive: 1,914); John McColl, Fraserburgh and District, has
43 votes and is not elected (omitted from IndyLive). All existing elected flags
agree. Tests reconcile every contested ward's first preferences to valid ballots.

The adjacent profile-derived CSV remains an independent audit, reproduced using
`bun scripts/derive-scotland-profile-first-prefs.mjs [profileDir]`. It counts only
first preferences; it never runs a tabulator. It follows the older candidate
roster and therefore omits McColl. The Mollison profile archive is not mirrored:
the compilation states no licence. Aggregate tallies and profile filenames are
preserved, not ballot rankings. Cambridge-method simulations on stv.vote are
not a source for this site's results.

Official originals retain publisher copyright/reuse terms, not the repository's
CC BY licence. IndyLive-derived names/data remain CC BY-SA 4.0, attributed to
Gerry Mulvenna with candidate data from Democracy Club.
