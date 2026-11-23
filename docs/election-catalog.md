# All-election year index

`/elections` lists available years, and `/elections/{year}` links the recorded
council, Westminster and devolved elections for that year. Council years keep
`/councils/{year}` and do not incorporate parliamentary votes or seats.

The server-only registry reads existing council and Westminster accessors plus
optional `src/lib/data/{assembly,senedd,holyrood}/catalog.json`. Optional catalogs
allow domain PRs to land independently; absent catalogs produce no invented
results or dead navigation links. Each catalog lists elections with id, year,
name, href, nation, system, seats, contests and coverage, optionally date.

Counts describe imported records. Do not replace them with the statutory size
of the elected body where the source excludes seats. Display coverage notes.
Do not combine votes across different bodies, ballot types or election dates.

New domain sitemap helpers under src/lib/sitemap/{senedd,holyrood}.ts export
`*SitemapUrls()`; Vite discovers available helpers at build time. The final build
checks every sitemap URL against generated output. Shared navigation discovers
only installed domain catalogs. No external data fetch occurs at page load.
