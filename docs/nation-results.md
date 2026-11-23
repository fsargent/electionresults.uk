# Nation results: first implementation

Adds Scotland and Wales council entry pages for 2022 using existing snapshots.
Scottish coverage is now all 355 wards in 32 councils, including eight no-poll
wards, 1,223 elected candidates and three vacancies. Northern Ireland 2023
covers all 80 District Electoral Areas in 11 councils and 462 seats. Welsh
coverage remains 690 ward records in 22 councils, with uncontested wards and
vacancies still awaiting reconciliation.

Scottish pages use recorded elected flags and first preferences. Below-quota
maps, cohort lists and council summaries exclude STV comparisons. Existing
council URLs and ward anchors remain available. The homepage's Scottish versus
English/Welsh D'Hondt comparison is replaced with links explaining the vote units.

No simulated counts or external runtime dependencies. Source originals,
checksums, normalization scripts and per-contest notes are preserved under
`source-data/council/{scotland-2022,northern-ireland-2023}`.

Next stages:
- Add further original Scottish count-stage reports; declared winners and
  first preferences are already reconciled against official council returns.
- Verify redistribution terms of the Mollison profiles before mirroring.
- Reconcile Welsh uncontested wards and vacancies, then historical boundaries.
- Add Senedd 2026 as a separate list-election domain (16 six-member constituencies),
  with per-list votes and ordered candidates; do not repeat list votes per candidate.
- Keep stv.vote's Cambridge whole-vote recalculations distinct from official
  Scottish weighted-inclusive-Gregory counts.

Validation: `bun run test`, `bun run check`, `bun run build` (includes route and
sitemap checks). Existing SlopeChart accessibility warning is outside this change.

## Year navigation

`/councils/{year}` now lists every recorded council result for the selected
year, grouped by England, Scotland, Wales and Northern Ireland. Nation links
preserve the year. Every dataset year has a nation page, with explicit empty
coverage where no records exist. England classification retains historical
authorities absent from the contemporary map. Tests reconcile the partition
against every source record for every year. NI 2023 now has complete coverage with original EONI count stages, preserving
source arithmetic errors and incomplete stages. Supplementary signed council
declarations establish final winners where intermediate scans do not.


## Catalog for integration

`src/lib/data/council-stv/catalog.json` exports `{elections:[...]}` rows with
`id,year,date,name,href,nation,system,seats,contests,coverage`. Shared navigation,
global layout and sitemap are unchanged. Council routes are generated through
the existing entries and sitemap machinery.

Rebuild: `bun scripts/reconcile-scotland-2022.mjs`, then `bun run etl`.
The optional profile audit is `bun scripts/derive-scotland-profile-first-prefs.mjs
[profileDir]`; it does not supply winners. Official declarations correct one
Ayr North first preference and restore an omitted Fraserburgh candidate.
