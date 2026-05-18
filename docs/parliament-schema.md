# Parliament data schema

This document is the operator-facing reference for the parliamentary data layer. It mirrors `src/lib/parliament/types.ts` and the architecture's data-model section, and is the source the ETL (`scripts/etl-parliament.mjs`) and UI loaders both reference. If you change a type, update this doc in the same PR.

Status: types and accessor skeleton landed in Story 2.1; ETL ingest lands in Story 2.5.

## Generated layout

```
src/lib/data/parliament/
├── index.json                 # { generatedAt, years[] }
└── {year}/
    ├── manifest.json          # { _manifest, data: SourceManifest }
    ├── constituencies.json    # { _manifest, data: ConstituencyContest[] }
    ├── party-totals.json      # { _manifest, data: NationalPartyTotal[] }
    └── national-summary.json  # { _manifest, data: NationalSummary }
```

Each per-year file is wrapped in the `ParliamentSplit<T>` envelope: a top-level `_manifest` block (source provenance) and a `data` field carrying the payload. Loaders destructure both — never embed the manifest inside the payload.

## Envelope

```ts
ParliamentSplit<T> = {
  _manifest: SourceManifest;
  data: T;
}
```

Why one envelope shape across every file: a downstream user can verify any single JSON file in isolation — they don't need to chase a separate manifest file to know which dataset they're looking at, which licence applies, or when the ETL ran.

## Types

### `Election`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ge-<year>`, e.g. `ge-2024` |
| `type` | `'general'` | Only general elections in v1 |
| `date` | string | ISO 8601 polling day |
| `boundarySet` | string | `BoundarySet.id` |
| `sourceManifestId` | string | `SourceManifest.id` |
| `notes` | string? | Free-form caveats |

### `BoundarySet`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `<year>-review`, e.g. `2023-review` |
| `name` | string | Display name |
| `inForceFrom` | string | ISO 8601 — first election under this set |
| `inForceTo` | string? | ISO 8601 — null while still in force |
| `notes` | string? | |

### `Constituency`

Constituency identity is a **composite key** `(boundarySet, slug)`. Constituency name alone is not stable — the same name can refer to different geographies across boundary reviews.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `${boundarySet}:${slug}` |
| `name` | string | Canonical display name |
| `slug` | string | Lowercase kebab-case (AR18) |
| `sourceLabel` | string | Original source label, preserved per NFR14 |
| `boundarySet` | string | `BoundarySet.id` |
| `country` | `'england' \| 'scotland' \| 'wales' \| 'northern-ireland'` | |

### `ConstituencyContest`

| Field | Type | Notes |
|---|---|---|
| `electionId` | string | `Election.id` |
| `constituencyId` | string | `Constituency.id` |
| `constituencySlug` | string | For UI loader convenience |
| `constituencyName` | string | For UI loader convenience |
| `contestType` | `'single-member' \| 'multi-member-historical'` | |
| `electorate` | number \| null | Null when source does not report |
| `validVotes` | number \| null | Null when source does not report |
| `turnout` | number \| null | Fraction in [0, 1]; null when electorate or validVotes is null |
| `caveats` | `CaveatToken[]` | Always present, possibly empty, never null |

### `CandidateResult`

| Field | Type | Notes |
|---|---|---|
| `contestId` | string | `${electionId}:${constituencyId}` |
| `candidateName` | string | |
| `partyId` | string | Canonical party slug |
| `partyDisplayName` | string | Canonical display name |
| `partySourceLabel` | string | Raw source string, preserved per NFR14 |
| `votes` | number | |
| `share` | number \| null | Fraction in [0, 1] of valid votes; null when `validVotes` is null |
| `position` | number | 1-based finishing position |
| `isWinner` | boolean | |
| `caveats` | `CaveatToken[]` | Always present, possibly empty |

### `NationalPartyTotal`

| Field | Type | Notes |
|---|---|---|
| `electionId` | string | |
| `partyId` | string | |
| `partyDisplayName` | string | |
| `partySourceLabel` | string | |
| `votes` | number | National total |
| `voteShare` | number | Fraction in [0, 1] |
| `seats` | number | |
| `seatShare` | number | Fraction in [0, 1] |
| `seatDelta` | number | `seatShare - voteShare`; positive = over-represented |

### `NationalSummary`

| Field | Type | Notes |
|---|---|---|
| `electionId` | string | |
| `totalVotes` | number | |
| `totalSeats` | number | |
| `gallagher` | number | Least-squares disproportionality; 0 = perfect |
| `minorityWinnerCount` | number | Winners with <50% of valid votes in their contest |
| `voteVsSeatGap` | `{ partyId, partyDisplayName, gap }[]` | `gap = seatShare - voteShare` |
| `lowWinningShareLeaderboard` | `LowWinningShareRow[]` | Top N by lowest winning share, ascending |
| `excludedFromMetrics` | `{ caveat, count }[]` | Per-caveat row counts excluded from headline metrics |

### `SourceManifest`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `parliament-<election>-<source>` |
| `sourceName` | string | e.g. "House of Commons Library general election results 2024" |
| `sourceUrl` | string | |
| `licence` | string | e.g. "Open Parliament Licence v3.0" |
| `retrievalDate` | string | ISO 8601 date |
| `publicationDate` | string | ISO 8601 date |
| `generatedAt` | string | ISO 8601 timestamp |
| `etlVersion` | string | e.g. `parliament-etl@1` |
| `caveats` | string[] | Free-form dataset-level notes |

## Caveat tokens

Every contest and candidate row carries a `caveats: CaveatToken[]` field — possibly empty, never null, never omitted (AR4). Canonical tokens:

| Token | Meaning | Excluded from metrics? |
|---|---|---|
| `uncontested` | Single candidate, no contest. | Yes — invalid denominator for vote shares. |
| `speaker` | Speaker seat, non-standard party convention (the Speaker stands as Speaker, not for their original party). | Yes from party totals; included in seat counts. |
| `missing-turnout` | Source did not report turnout/electorate. | Excluded from turnout-dependent metrics only. |
| `multi-member-historical` | Pre-1950 multi-member constituency. | Excluded from `minorityWinnerCount` (no single winner share applies). |
| `boundary-comparability-limited` | Constituency boundary set differs from a neighbouring election in a way that prevents comparison. | Excluded only from cross-election comparisons. |
| `source-discrepancy` | Known difference between sources for this row. | Surfaced as a caveat badge; not auto-excluded. |

When a metric excludes a row, the exclusion is reported in `NationalSummary.excludedFromMetrics` so consumers can audit the difference between the raw dataset and the headline numbers.

## Field naming

- JSON output is camelCase (AR16). The ETL translates source `vote_count` → `votes`, `party_name` → `partyDisplayName`, etc.
- Booleans use affirmative names (`isWinner`, not `notElected`).
- Missing values are `null` — never `0`, `-1`, or `"N/A"`.
- Dates are ISO 8601 strings.

CSV downloads use **snake_case** headers — an analyst convention in pandas/R — distinct from JSON's camelCase.

## CSV downloads

Three files per ingested year under `static/data/parliament/<year>/`, served at `/data/parliament/<year>/`:

- `parliament-<year>-constituencies.csv` — one row per contest, with winner + runner-up + majority denormalised in
- `parliament-<year>-candidates.csv` — one row per candidate
- `parliament-<year>-national-totals.csv` — one row per party

Caveat tokens render as `;`-joined strings (e.g. `"uncontested"`, `"speaker;missing-turnout"`). Null values render as empty fields. Booleans render as `0`/`1` (matches the council CSV convention; see `static/data/candidates.csv:elected`).

### `parliament-<year>-constituencies.csv`

| Column | JSON source | Notes |
|---|---|---|
| `election_id` | `electionId` | `ge-2024` |
| `constituency_id` | `constituencyId` | Composite key `${boundarySet}:${slug}` |
| `constituency_slug` | `constituencySlug` | URL slug |
| `constituency_name` | `constituencyName` | Display name |
| `country` | `country` | `england` / `scotland` / `wales` / `northern-ireland` |
| `contest_type` | `contestType` | `single-member` / `multi-member-historical` |
| `electorate` | `electorate` | Null when source does not report |
| `valid_votes` | `validVotes` | Null when source does not report |
| `turnout` | `turnout` | Fraction in [0, 1] |
| `caveats` | `caveats[]` | `;`-joined tokens |
| `winning_party_id` | `candidates[isWinner].partyId` | Denormalised |
| `winning_party` | `candidates[isWinner].partyDisplayName` | Denormalised |
| `winning_candidate` | `candidates[isWinner].candidateName` | Denormalised |
| `winning_votes` | `candidates[isWinner].votes` | Denormalised |
| `winning_share` | `candidates[isWinner].share` | Denormalised |
| `runner_up_party_id` | `candidates[position=2].partyId` | Denormalised |
| `runner_up_party` | `candidates[position=2].partyDisplayName` | Denormalised |
| `runner_up_candidate` | `candidates[position=2].candidateName` | Denormalised |
| `runner_up_votes` | `candidates[position=2].votes` | Denormalised |
| `runner_up_share` | `candidates[position=2].share` | Denormalised |
| `majority` | computed | `winning_votes − runner_up_votes`; null when either side missing |

### `parliament-<year>-candidates.csv`

| Column | JSON source | Notes |
|---|---|---|
| `election_id` | `electionId` | |
| `constituency_id` | `constituencyId` | |
| `constituency_slug` | `constituencySlug` | |
| `constituency_name` | `constituencyName` | |
| `candidate_name` | `candidateName` | |
| `party_id` | `partyId` | Canonical kebab-case slug |
| `party_display_name` | `partyDisplayName` | Post-normalisation |
| `party_source_label` | `partySourceLabel` | Raw source string |
| `votes` | `votes` | |
| `share` | `share` | Fraction in [0, 1]; null when validVotes is null |
| `position` | `position` | 1-based finishing position |
| `is_winner` | `isWinner` | `1` / `0` |
| `caveats` | `caveats[]` | `;`-joined tokens |

### `parliament-<year>-national-totals.csv`

| Column | JSON source | Notes |
|---|---|---|
| `election_id` | `electionId` | |
| `party_id` | `partyId` | |
| `party_display_name` | `partyDisplayName` | |
| `party_source_label` | `partySourceLabel` | |
| `votes` | `votes` | National sum |
| `vote_share` | `voteShare` | Fraction in [0, 1] |
| `seats` | `seats` | National sum |
| `seat_share` | `seatShare` | Fraction in [0, 1] |
| `seat_delta` | `seatDelta` | `seatShare − voteShare`; positive = over-represented |

### Reproducibility check

Headline metrics computed from a CSV must match the JSON envelope. For example, counting `winning_share < 0.5` rows in `parliament-2024-constituencies.csv` after excluding `uncontested` and `multi-member-historical` caveats produces 554 — equal to `national-summary.json.minorityWinnerCount`.

## Reading the data

Always go through `src/lib/parliament/data.ts`:

```ts
// src/routes/parliament/[year]/+page.server.ts
import {
  constituenciesForYear,
  nationalSummaryForYear,
  partyTotalsForYear
} from '$lib/parliament/data';

export const prerender = true;

export function load({ params }) {
  const year = Number(params.year);
  return {
    contests: constituenciesForYear(year),
    summary: nationalSummaryForYear(year),
    partyTotals: partyTotalsForYear(year)
  };
}
```

Never:

- Import directly from `src/lib/data/parliament/*.json` in a `+page.svelte`. Use the accessor.
- Expand `src/lib/data.ts` (council accessor) with parliament-aware code. The two are mutually unaware (AR5).
- Compute a headline parliamentary metric in the browser. ETL or `+page.server.ts` only (AR8).
