# Northern Ireland council STV results, 18 May 2023

Downloaded from EONI's official results index:
https://www.eoni.org.uk/results-data/local-council-elections-2023-results/

61 documents, 5,789,771 bytes, downloaded without errors: 59 result files
covering 80 District Electoral Areas in 11 councils (38 spreadsheet sheets +
42 PDF count sheets), plus turnout XLSX and Waterside petition PDF.
Expected total: 462 elected seats. This coverage is inventoried, not yet fully
parsed or reconciled candidate-by-candidate.

manifest.json records URL, label, council, file length, SHA-256, content type.
fetch.py reproduces downloads. index.html snapshots the source index.
workbook-inventory.json inventories all spreadsheet sheets. text/ contains
layout-preserving PDF text and lossless spreadsheet-cell JSON for import.

These are official COUNT-STAGE RESULTS, NOT cast vote records. No published
individual-ballot rankings/preference profiles have been found in the EONI
release or searches of NI data archives. Count-stage totals do not reconstruct
full rankings, pairwise tables, or counterfactual ballots. NI counts are manual.
Do not run the Cambridge whole-vote tabulator on fabricated preference data.

Belfast workbook: ten DEA sheets. Each starts with electorate, valid/invalid
ballots, seats, quota; candidate table begins around row 14, with explicit
E for elected, candidate names/descriptions, first preferences, then paired
transfer and total columns. Other workbooks differ. PDFs contain stage totals,
transfer/exclude headers, elected labels and non-transferable totals.
Preserve decimal transfer values, election stages, exhaustion and source labels.

The Waterside petition PDF is scanned (pdftotext returns no meaningful text).
Visually inspected: certificate dated 17 August 2023, case 23/046064, says Martin
Reilly is duly elected to serve for Waterside. It confirms rather than replaces
the result. Keep it linked as an outcome/legal provenance note.

copyright.html follows EONI's Crown Copyright link, which redirects to National
Archives general Crown copyright guidance. That page describes OGL as the default
for most Crown information; it is not an asset-specific licence statement.
Preserve EONI attribution and verify applicable reuse terms before republishing
whole workbooks; do not arbitrarily relicense everything CC BY-SA.

Requested integration: stv.vote recorded-count reports. Gate features that need
ballot-level data (pairwise/Condorcet, ranking distributions, method simulations)
with unavailable state. Verify 80 reports, 462 winners, per-DEA first-preference
sums and valid ballots, quotas and stage conservation. Include >2-candidate
index filter and year-first collapsed-country navigation from existing site.
