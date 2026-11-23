# Scottish Parliament results

Coverage: the recorded 7 May 2026 election, all 73 constituencies and eight
regions; 73 constituency and 56 regional Members of the Scottish Parliament
(MSPs). These are the members as elected, not a current membership roll.
The voting system is the Additional Member System, with two separate ballots.

## Sources and reuse

The original downloaded bytes are committed under `2026/`. `sources.json`
records each publisher, landing page, exact download URL, retrieval timestamp,
byte length, SHA-256 checksum, role and source-specific licence statement.
The repository's general licence does not override third-party terms.

- **Electoral Management Board for Scotland (EMB)**: official votes, rejected
  ballots and seats from its [2026 results publication](https://www.emb.scot/news/article/70/scottish-parliament-2026-results).
  No open licence is stated on the download page. This copy preserves the
  published factual election record with attribution; no broader licence to
  the workbook is claimed.
- **Scottish Parliament Information Centre (SPICe)**: constituency-to-region
  lookup on 2026 boundaries, revised electorates and constituency breakdowns
  of regional votes. [Results in full](https://spice-spotlight.scot/2026/05/28/election-2026-results-in-full/),
  workbook updated 14 July 2026. Scottish Parliamentary Corporate Body
  copyright; [Scottish Parliament Copyright Licence](https://www.parliament.scot/about/copyright).
  Contains information licensed under the Scottish Parliament Copyright Licence.
- **Democracy Club**: constituency candidate names and party labels; regional
  candidate list positions and elected flags. Source CSV exports are documented
  in the manifest. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Reproduce

```sh
bun scripts/fetch-holyrood.mjs  # explicit network refresh; changes provenance
bun scripts/etl-holyrood.mjs    # offline import, verifies checksums first
bun run test
bun run check
bun run build
```

The importer writes `src/lib/data/holyrood/2026.json` and `catalog.json`.
No network access is required by the site build. Refresh is an explicit data
maintenance step, separate from the shared council/parliament build scripts.
The catalog provides the coordinator's all-election hub contract; the sitemap
fragment is `src/lib/sitemap/holyrood.ts`. Neither shared layout nor sitemap
endpoint is changed by this branch.

## Reconciliation and calculation limits

EMB is canonical for votes and seats. Every regional party seat total is
checked against its seats sheet; all 56 named regional members are checked
against Democracy Club elected flags. SPICe's revised constituency electorates
are used. Turnout on the site includes rejected ballots, whereas SPICe's
published turnout excludes them. Ballot vote shares use valid votes only.

All source disagreements are retained in the generated `discrepancies` array
and shown on the election page and relevant drill-down. These include candidate
vote transcription differences, inconsistent EMB total cells and Glasgow
electorates, East Kilbride's SPICe party label, and constituency breakdowns of
regional votes that do not reconcile in three regions. Regional seat allocation
always uses the official regional totals, never those non-reconciling breakdowns.

D’Hondt rounds are a reconstruction from recorded votes and constituency seats,
not an official count transcript or hypothetical election. Party divisors are
constituency seats + regional seats already allocated + 1. Exhausted lists and
already elected individuals are excluded; constituency winners are skipped on
lists. All eligible figures are retained at full precision; two decimals are
for display only. Cross-products compare ratios without display rounding.
No highest-figure ties occur in 2026. The importer fails on a tie instead of
inventing a statutory adjustment or a draw-of-lots outcome. See
[Scotland Act 1998 s.7](https://www.legislation.gov.uk/ukpga/1998/46/section/7)
and [s.8](https://www.legislation.gov.uk/ukpga/1998/46/section/8).

The Second Review boundaries were first used in 2026. No automatic swing from
previous constituencies is computed. Constituency and regional votes are never
added together or presented as one vote total.
