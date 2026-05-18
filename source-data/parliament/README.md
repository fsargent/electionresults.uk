# Parliament source data

Raw, untransformed source files for UK general elections. Committed bytes — the parliamentary ETL (`scripts/etl-parliament.mjs`, Story 2.5) reads these directly and produces the artefacts under `src/lib/data/parliament/`.

This tree is **read-only at build time**. The ETL must never mutate a file here; if a source publisher revises a dataset, swap the file in a deliberate commit and let the diff in `src/lib/data/parliament/` and `_bmad-output/etl-reports/` document the impact.

## Layout

```
source-data/parliament/
├── README.md              (this file)
├── boundary-sets.json     (definitions for every boundary set we touch)
└── {year}/                (per-election folder; one per ingested GE)
    └── *.xlsx             (publisher's original files, unmodified)
```

The per-year folder mirrors the publisher's release. We commit every file the publisher shipped (results, MPs-elected, defeated MPs, record-of-changes) so the dataset is reproducible without re-downloading.

## Ingested elections

### 2024 General Election

- **Polling day:** 2024-07-04
- **Boundary set:** `2023-review` — first general election under the constituencies set by the Boundary Commissions' 2023 Periodic Review (Parliament approved November 2023).
- **Source publisher:** House of Commons Library
- **Source briefing:** [CBP-10009](https://commonslibrary.parliament.uk/research-briefings/cbp-10009/)
- **Licence:** [Open Parliament Licence v3.0](https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/)
- **Last upstream update:** 2026-01-05 (per the `About` sheet inside each workbook)
- **Retrieved:** 2026-05-18
- **Attribution required:** "Contains Parliamentary information licensed under the Open Parliament Licence v3.0" — surface this on `/parliament/data` and inside every CSV export.

Files in `2024/`:

| File | Rows | Purpose |
|---|---|---|
| `HoC-GE2024-results-by-constituency.xlsx` | 650 | One row per constituency with winner, valid votes, electorate, majority, per-party vote totals |
| `HoC-GE2024-results-by-candidate.xlsx` | 4515 | One row per candidate with party, votes, vote share, change |
| `MPs-elected.xlsx` | 650 | Reference list of MPs elected at the GE |
| `Defeated-MPs.xlsx` | — | Sitting MPs who lost their seats |
| `Record-of-changes.xlsx` | — | Publisher-maintained changelog of revisions to the dataset |

The ETL reads the constituency and candidate workbooks; the other three are committed for verifiability but are not required inputs for the metrics pipeline.

### Refreshing

To refresh the 2024 dataset:

1. Download the latest workbooks from CBP-10009.
2. Replace the files in `source-data/parliament/2024/` (keep the filenames).
3. Run `bun run refresh-data:parliament`.
4. Review the diff under `src/lib/data/parliament/2024/` and the report at `_bmad-output/etl-reports/parliament-2024.md`.
5. Commit both the source files and the regenerated artefacts together.

To add a new election year:

1. Create `source-data/parliament/{year}/` and drop the publisher's workbooks in.
2. Add an entry above (year, source, licence, attribution, retrieval date).
3. Extend `boundary-sets.json` if the election used a new boundary set.
4. Update `scripts/etl-parliament.mjs` to register the year (Story 2.5 lands the 2024 loader; subsequent years are additive).
