# Parliament data sources

Every dataset feeding the `/parliament` surface, with publisher, licence, attribution, and known caveats. Mirrors what's in `source-data/parliament/README.md` (operator-facing) but framed for end users — this is what `/parliament/data` and the methodology page will link out to.

See [`docs/parliament-schema.md`](./parliament-schema.md) for the per-year folder layout and the type contracts that the ETL produces from these sources.

## Current sources

### House of Commons Library — General Election results

- **Briefing:** CBP-10009 — *HoC GE2024 results by constituency / by candidate*
- **URL:** https://commonslibrary.parliament.uk/research-briefings/cbp-10009/
- **Authors:** Carl Baker, Anna Buck, Richard Cracknell, Emily Davis, Louie Pollock, Michael Smethurst, Robert Brook
- **Publisher:** House of Commons Library
- **Licence:** [Open Parliament Licence v3.0](https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/)
- **Attribution string:** "Contains Parliamentary information licensed under the Open Parliament Licence v3.0"
- **Coverage:** 2024 General Election (650 constituencies, 4,515 candidates)
- **Retrieved:** 2026-05-18

The Commons Library obtains results directly from Returning Officers after the election, cross-referenced against the Electoral Commission's candidate register. The dataset is updated periodically — see the `Record-of-changes.xlsx` workbook in the source tree for the revision log.

**Known caveats:**

- The Speaker (Chorley) stands as "Speaker seeking re-election" and is not allocated to a party. Our ETL tags the Chorley seat with the `speaker` caveat and excludes it from national party totals, but includes it in seat counts.
- The constituency workbook reports per-party vote columns for the major parties (Con, Lab, LD, RUK, Green, SNP, PC, DUP, SF, SDLP, UUP, APNI) plus `All other candidates`. The per-candidate workbook is the authoritative source for individual minor-party totals.

## Planned sources (Phase 2)

Historical Commons Library general-election datasets back to 1918 are available in the same publisher format. The ETL is designed to accept additional years without schema redesign — see `_bmad-output/planning-artifacts/epics.md`, "Deferred to Phase 2".

## Reproducibility

Every headline parliamentary metric on this site is reproducible from the source files committed under `source-data/parliament/` and the ETL at `scripts/etl-parliament.mjs`. Run:

```sh
bun run refresh-data:parliament
```

…then compare your generated `src/lib/data/parliament/{year}/national-summary.json` against the values rendered on `/parliament/[year]`. They should match byte-for-byte; the per-run validation report at `_bmad-output/etl-reports/parliament-{year}.md` documents any rows excluded from the headline metrics and why.
