# Senedd 2026 sources

Recorded results for 7 May 2026: all 16 six-seat constituencies, 96 elected
members, 161 ballot entries and 1,255,914 valid votes. No simulated results or
2021 swings are included. The system, boundaries and seat count changed in 2026.

## Refresh and reproduce

From the repository root:

```sh
bun scripts/senedd/fetch-2026.mjs
bun scripts/senedd/import-2026.mjs
# Offline, from the committed original downloads and extracted facts:
bun scripts/senedd/import-2026.mjs --from-csv
bun run test -- src/lib/senedd scripts/senedd
```

Fetching requires network access and Poppler's `pdftotext -layout` to refresh
the text derived from the original briefing PDF. Offline import needs only Bun
and the repository dependencies. The importer writes the full dataset and hub
catalog under `src/lib/data/senedd`. It checks every list's seats, all 96 seat
allocations, elected names, list order, valid vote sums and national totals.
The generated timestamp changes on each import; the results should not.

Source URLs, publisher, licence, purpose and SHA-256 digests of each input are
in `2026.json`'s manifest. Original PDF, OpenDocument Spreadsheet (ODS) and
Democracy Club CSV downloads are preserved here without modification. The
briefing text is a derived convenience copy. Source licences apply separately
from the repository's licence.

## Sources and rights

- [Vote Wales official results](https://vote.wales/election-results/), published
  by the Electoral Management Board for Wales from constituency returning
  officers: full party lists, ballot descriptions, votes, seats and elected
  candidates. `vote-wales-lists.csv` contains **one row per ballot entry**;
  votes are never duplicated across candidates. `vote-wales-candidates.csv`
  joins on constituency slug and entry order, keeping list position and the
  original elected status from the elected-candidates summary.
  `vote-wales-national.csv` records the six-party national summary, which
  omits parties winning no seats. Website HTML is cached locally, not
  redistributed; the CSVs contain extracted election facts.
- [Senedd Research, initial analysis, 11 May 2026](https://research.senedd.wales/research-articles/senedd-election-an-initial-analysis-of-the-results/):
  original ODS map, votes table and seat totals. These reconcile all 96 seat
  allocations and the six national parties. © Senedd Commission 2026;
  reproduction permitted with acknowledgement, accurately and without
  misleading context.
- [Senedd Research, detailed analysis](https://research.senedd.wales/research-articles/senedd-election-2026-analysis-of-the-results/):
  September 2026 briefing PDF supplies electorate, rejected ballots, turnout
  and elected-member order. © Senedd Commission 2026, reproduced with the
  document title and acknowledgement. The later briefing states national
  turnout as 51.7%; the initial May article stated 51.6%. Pages use the later
  briefing's electorate and consistently calculate valid votes ÷ electorate.
  Published constituency percentages and their matching basis are retained,
  including exceptions, rather than silently replacing source figures.
  Pen-y-bont Bro Morgannwg's printed 53.73% matches ballots at the count ÷
  electorate; Gŵyr Abertawe's printed 50.88% matches neither basis exactly
  (50.75% valid votes, 50.87% including rejected papers).
- [Democracy Club candidate export](https://candidates.democracyclub.org.uk/elections/senedd.2026-05-07/):
  CC BY 4.0. Supplies party identifiers and a check on list positions.
  Candidate names on pages retain the official Vote Wales spelling. Matching
  accommodates shortened names and checks list positions and party identity.
  Democracy Club turnout fields are not used.
- [House of Commons Library CBP-10838, 13 May 2026](https://commonslibrary.parliament.uk/research-briefings/cbp-10838/):
  contextual cross-check of date and the 16 × 6 structure. Its interactive
  dashboard is not an imported dataset; no totals are attributed to a
  nonexistent workbook download.

## Allocation and source status

The [Government of Wales Act 2006, sections 8–9](https://www.legislation.gov.uk/ukpga/2006/32/section/9),
as substituted by [section 8 of the 2024 Act](https://www.legislation.gov.uk/asc/2024/4/section/8),
governs the calculation. An independent can win one seat, exhausted lists
are excluded, and list seats are filled in candidate order. A party can
nominate up to eight candidates. Equal highest figures each win if enough
seats remain; otherwise add one vote to each tied entrant and recalculate.
An unresolved tie requires lots and the importer refuses to guess.
No tie occurred in the recorded 2026 allocations.

`seatsWonSource` and `electedSource` preserve the official published status;
`seatsWon`, `elected`, and seat numbers are independently recalculated and
must agree before publication. Quotients and the hypothetical next figure
are explanatory calculations, not additional recorded seats. The UI labels
the hypothetical seventh seat explicitly. No candidate has a personal vote
total on a party list.

## Integration

The catalog is the all-election hub contract. `src/lib/sitemap/senedd.ts`
exports all 18 paths; the coordinator must incorporate this fragment into
the shared sitemap and add navigation. This branch does not change the
global layout, sitemap endpoint or package scripts.
