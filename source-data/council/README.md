# Council source data

Raw, untransformed source files for UK local elections. Committed bytes — the council ETL (`scripts/etl.mjs`) reads these directly and produces `static/data/results.sqlite`, the CSV downloads under `static/data/`, and `src/lib/data/generated.json`.

The hexmap builder (`scripts/build-hexmap.mjs`) reads `uk-lad-2025.hexjson` from here and writes `src/lib/data/hexes.json`.

This tree is **read-only at build time**. The ETL must never mutate a file here; if a source publisher revises a dataset, swap the file in a deliberate commit and let the diff in `src/lib/data/generated.json` and the published CSVs document the impact.

## Layout

```
source-data/council/
├── README.md                                       (this file)
├── LEH-{year}-…xlsx                                House of Commons Library Local Election Handbook (2024, 2025)
├── LEH-Candidates-2023.xlsx                        2023 LEH (different publisher filename convention)
├── local_elections_2021_results-2.xlsx             2021 LEH
├── local-elections-2022.xlsx                       2022 LEH
├── CBP9545-detailed-results-for-download.xlsx      CBP-9545 cohort detail
├── data_tables.xlsx                                CBP cohort summary tables
├── leap/{2016..2019}/leap-YYYY-MM-DD.csv           Andrew Teale LEAP ward-level (CC-BY-SA 3.0 / GFDL)
├── opencouncildata_councillors_{2016..2025}.csv    Open Council Data UK councillor rosters (CC BY-SA 4.0)
├── history2016-2025.csv                            Open Council Data UK council-control snapshot
├── dc-candidates-…csv                              Democracy Club 2026-05-07 cohort exports
├── downloaded-…dc-candidates-…csv                  Earlier DC export (kept for diffing)
├── scotland-2022-stv-indylive.csv                  Scottish 2022 STV first-preferences (IndyLive, CC BY-SA 4.0)
└── uk-lad-2025.hexjson                             ODI Leeds UK Local Authority District hexmap
```

## Sources & licences

| Source | Files | Licence | Notes |
|---|---|---|---|
| House of Commons Library — LEH series | `LEH-*`, `local-elections-*`, `local_elections_*`, `CBP9545-*`, `data_tables.xlsx` | [Open Parliament Licence v3.0](https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/) | Annual Local Election Handbook + cohort briefings; canonical comparator for the 2026 cycle |
| Andrew Teale — Local Elections Archive Project (LEAP) | `leap/{2016..2019}/leap-*.csv` | CC BY-SA 3.0 / GFDL — see [`docs/leap-source.md`](../../docs/leap-source.md) | Pre-LEH ward-level data; share-alike obligation rides on derived downloads |
| Open Council Data UK | `opencouncildata_councillors_*.csv`, `history2016-2025.csv` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Sitting-councillor rosters + council-control snapshots |
| Democracy Club | `dc-candidates-*.csv`, `downloaded-*dc-candidates-*.csv` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Live 2026 cohort export; refresh by dropping a newer file into this directory (ETL picks the most recent by mtime) |
| IndyLive Scotland | `scotland-2022-stv-indylive.csv` | CC BY-SA 4.0 | 2022 Scottish council STV first-preferences only |
| ODI Leeds | `uk-lad-2025.hexjson` | [ODC-BY](https://opendatacommons.org/licenses/by/) | UK Local Authority District hexmap geometry |

The 2026 cohort planning notes live in [`docs/2026-cohort.md`](../../docs/2026-cohort.md).

## Refreshing

To refresh a single dataset:

1. Re-download the file from the publisher (URLs in the table above and in [`docs/leap-source.md`](../../docs/leap-source.md)).
2. Replace the file in `source-data/council/` (keep the filename so the ETL path doesn't need editing).
3. Run `bun run etl`.
4. Review the diff under `src/lib/data/generated.json`, `static/data/*.csv`, and `static/data/results.sqlite`.
5. Commit source + regenerated artefacts together.

For Democracy Club refreshes, just drop the new CSV in alongside the previous one — the ETL picks the most recent `dc-candidates-*results_true-*.csv` by mtime; keeping older exports is useful for diffing.
