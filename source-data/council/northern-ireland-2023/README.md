# Northern Ireland council election, 18 May 2023

Official Electoral Office for Northern Ireland (EONI) results:
https://www.eoni.org.uk/results-data/local-council-elections-2023-results/

`originals/` preserves all 61 original EONI downloads (including turnout and
Waterside petition), plus six council declarations from Fermanagh and Omagh.
`eoni-manifest.json` records the EONI URLs, retrieval date, byte lengths and
SHA-256 checksums. Council declaration URLs/checksums are in `relatedSources`
in `scanned-counts.json`. `index.html` and `copyright.html` preserve the source
index and linked copyright guidance.

Normalized counts cover all 80 District Electoral Areas in 11 councils and
462 elected seats: 38 spreadsheet areas, 35 text PDF areas, seven scanned areas.
These are recorded first preferences and published count stages, not individual
ballot rankings. No simulated transfers or inferred final winners are included.

Scripts in `scripts/ni2023/` reproduce the normalization. Python dependencies:
openpyxl, PyMuPDF, opencv-python and numpy; Tesseract is optional for scan OCR
comparison. From the repository root:

```
python scripts/ni2023/convert_spreadsheets.py --source source-data/council/northern-ireland-2023/originals
python scripts/ni2023/convert_pdfs.py source-data/council/northern-ireland-2023/originals source-data/council/northern-ireland-2023/pdf-counts.json
python scripts/ni2023/convert_scans.py --source source-data/council/northern-ireland-2023/originals --related-source source-data/council/northern-ireland-2023/originals
bun run etl
```

The scan script validates manually transcribed, visually audited fixtures against
source hashes and count arithmetic; `--dump DIR` runs cell OCR for comparison.
Enniskillen and Erne East screenshots precede the final declarations: final
winners follow the signed council declarations, while `sourceStatus` retains
the intermediate scan labels. West Tyrone's cropped stage 5 remains null and
incomplete; its quota is unpublished in the scan. Castle's blank quota is null.
Sperrin's stage 11 and The Mournes' stage 9 retain published incomplete figures.
Per-area notes record source arithmetic errors, clipped cells and other issues.

Independent importer audit checked all first-preference sums and declared seat
counts, spreadsheet raw cells, 241 text-PDF stages, and 45 complete scanned
stages. Known source deficits are retained, not repaired. Website tests verify
coverage, original checksums, first preferences, winners and stage alignment.

## Reuse

EONI material is Crown copyright. Its copyright link leads to general National
Archives guidance describing the Open Government Licence as the default for
most Crown information, not an asset-specific licence grant. Preserve attribution
and consult the publisher's terms; these originals are not relicensed under the
repository's CC BY licence. Council declarations retain their publisher's terms.
