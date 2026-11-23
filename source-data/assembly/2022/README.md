# Northern Ireland Assembly 2022

Official EONI result workbooks for the 5 May 2022 election, linked at
https://www.eoni.org.uk/results-data/ni-assembly-election-2022-results/ .
Original Crown copyright files are preserved with source URLs, SHA-256 and sizes
in sources.json. These upstream files are not relicensed under the repository's
Creative Commons licence. Attribution: Electoral Office for Northern Ireland.

Reproduce: `bun scripts/import-assembly.mjs --download` fetches all 18 files;
`bun scripts/import-assembly.mjs` verifies checksums and imports offline.

Independent reconciliation: NI Assembly Research and Information Service paper
24/22 (11 May 2022), preserved as assembly-report.pdf, reports 239 candidates,
90 members, 862,700 valid ballots, 873,787 total ballots and electorate 1,373,731.
Its party vote and seat totals match these source workbooks.

Some final overview tables contain candidate statuses 0 with explicit elected
order (David Hilditch, Trevor Clarke and Mike Nesbitt). Preserve both source
fields and treat numeric election order 1–5 as explicit election evidence, not
as a first-preference rank. Seats are never inferred from first preferences.

The workbooks contain unused template stages and sometimes a continuation
overview after stage 10. Import stages with published positive total rows;
ignore zero-total template columns. Reconcile duplicate continuation stages.
Five published stages do not conserve valid ballot value: Belfast East 11,
East Antrim 6, Foyle 14, Lagan Valley 8, Mid Ulster 8. Preserve original values
and flag them in reports rather than reconstructing unrecorded transfers.

These are recorded count-stage results, NOT cast vote records. Full ranking,
pairwise and counterfactual analyses are unavailable.
