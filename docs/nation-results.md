# Nation results: first implementation

Adds Scotland and Wales council entry pages for 2022 using existing snapshots.
Scottish coverage is 319 wards, 28 councils; Welsh coverage is 690 ward records,
22 councils. Neither is advertised as a complete national result.

Scottish pages use recorded elected flags and first preferences. Below-quota
maps, cohort lists and council summaries exclude STV comparisons. Existing
council URLs and ward anchors remain available. The homepage's Scottish versus
English/Welsh D'Hondt comparison is replaced with links explaining the vote units.

No new ballot datasets, simulated counts or external runtime dependencies.

Next stages:
- Reconcile all 355 Scottish wards, including eight without polls, against
  council declarations and official stage reports. Preserve vacancies.
- Verify redistribution terms of the Mollison profiles before mirroring.
- Reconcile Welsh uncontested wards and vacancies, then historical boundaries.
- Add Senedd 2026 as a separate list-election domain (16 six-member constituencies),
  with per-list votes and ordered candidates; do not repeat list votes per candidate.
- Keep stv.vote's Cambridge whole-vote recalculations distinct from official
  Scottish weighted-inclusive-Gregory counts.

Validation: `bun run test`, `bun run check`, `bun run build` (includes route and
sitemap checks). Existing SlopeChart accessibility warning is outside this change.
