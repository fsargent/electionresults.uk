# electionresults.uk

A volunteer audit of UK local elections. The voting method is the subject of
every observation; named candidates appear as the public election record
requires but are never the editorial subject. See
[`/methodology`](src/routes/methodology/+page.svelte) for the full frame.

## Stack

- [SvelteKit 2](https://kit.svelte.dev/) + Svelte 5 (runes), every route
  prerendered
- [`adapter-cloudflare`](https://kit.svelte.dev/docs/adapter-cloudflare),
  fully static deploy to Cloudflare Pages
- [Bun](https://bun.sh/) as the package manager and runtime
- [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) +
  [SheetJS](https://sheetjs.com/) for the build-time ETL
- [vitest](https://vitest.dev/) for unit tests

No client-side database, no JS framework on top of Svelte, ≤30KB JS per
editorial page.

## Develop

```bash
bun install
bun run etl     # XLSX → static/data/results.sqlite + CSVs + lib/data/generated.json
bun run dev     # http://localhost:5173 (SvelteKit dev server)
bun test        # vitest, distortion math
bun run check   # svelte-check, type-check
bun run build   # full build incl. ETL → .svelte-kit/cloudflare/
bun run preview # serve the built output at http://localhost:4173
```

`bun run build` re-runs the ETL automatically. If you only changed templates
or styles, `bun run dev` picks up changes without re-running the ETL.

## Data

The development fixture is `docs/LEH-2025-results-HoC.xlsx` — the House of
Commons Library Local Election Handbook for the 1 May 2025 English locals.
It is **not deployed** (the `/data` page documents that this is a dev
fixture; the 2026 LEH lands months out and ingests through the same adapter).

The ETL produces three artefacts in addition to the SQLite + CSVs:
- `static/data/results.sqlite` — full database for sceptics
- `static/data/{councils,races,candidates}.csv` — same data in CSV
- `src/lib/data/generated.json` — typed snapshot consumed by SvelteKit
  server load functions only (never imported from a `.svelte` component,
  or the JSON ships to the browser)

### `Elected` flag

The LEH-2025 source workbook's `Elected` column is internally inconsistent
on roughly 1% of candidacies (e.g. EC 62374 Cramlington Village marks both
Mark David Swinburn at 791 votes and Steve Leyland at 91 votes as elected
for a single-seat race). The ETL ignores the source's `Elected` column and
recomputes it as **top N by vote count where N = ward seats** — the actual
rule under FPTP and bloc vote. The original flag is preserved in SQLite as
`candidates.elected_source` so a sceptic can audit the discrepancy.

## Layout

```
scripts/etl.mjs            ETL: XLSX → SQLite + CSVs + JSON snapshot
src/lib/types.ts           Shared types
src/lib/distortion.ts      Math + system-observation templates (TDD)
src/lib/distortion.test.ts Tests (run with `bun test`)
src/lib/data.ts            Server-only typed accessors over the snapshot
src/lib/format.ts          pct(), num()
src/lib/styles/global.css  Editorial typography + dark-mode palette
src/routes/+layout.svelte  Global shell + footer with editorial-frame note
src/routes/+page.*         Homepage: hero + ten-thinnest table + all councils
src/routes/minority-winners/   Filterable lens
src/routes/[council]/      One prerendered page per council
src/routes/methodology/    Editorial frame + math definitions
src/routes/data/           SQLite + CSV downloads + schema docs
src/routes/sitemap.xml/    Build-time sitemap
```

## Deferred work

See [`_bmad-output/implementation-artifacts/deferred-work.md`](_bmad-output/implementation-artifacts/deferred-work.md)
(local only) for items raised during adversarial review that are real but
out of scope for the current slice.
