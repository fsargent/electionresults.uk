# LEAP — Local Elections Archive Project (Andrew Teale)

Source for ward-level UK local-election candidate results 2016–2019.
Used by `scripts/etl.mjs` to fill the pre-LEH gap (LEH-shape data only
exists in `source-data/council/` from 2021 onwards).

## Files in repo

```
source-data/council/leap/
├── 2016/leap-2016-05-05.csv  (10,880 rows)
├── 2017/leap-2017-05-04.csv  (15,862 rows)
├── 2018/leap-2018-05-03.csv  (16,063 rows)
└── 2019/leap-2019-05-02.csv  (25,848 rows)
```

2020 had no May local elections (postponed to 2021 by COVID). LEAP
covers 2002–2026 if a wider range is ever needed; downloads index at
<https://www.andrewteale.me.uk/leap/downloads>.

## Schema

Positional, **no header row**. Eight fields:

| # | Field | Notes |
|---|---|---|
| 1 | council_name | e.g. `Adur`, `Aberdeen` |
| 2 | council_ons | e.g. `E07000223`, `S12000033` |
| 3 | ward_name | e.g. `Buckingham` |
| 4 | ward_ons | e.g. `E05007562` |
| 5 | candidate_name | |
| 6 | party_short | `C`, `Lab`, `LD`, `Grn`, `UKIP`, `SNP`, `PC`, `Ind` etc. |
| 7 | votes | Integer |
| 8 | elected_flag | `1` if elected, `0` otherwise |

LEAP does **not** carry electorate, ballots issued, invalid votes,
authority type, or vacancies. The ETL derives `seats` from the count of
elected flags per ward and falls back to `validBallots = votesSum / seats`
for multi-member races (same approximation the Democracy Club 2026
adapter uses). Quota gap and distortion analyses are valid; per-ward
turnout is not available from this source.

Party short codes are mapped to canonical names via
`scripts/party-normalize.mjs` (`C → Conservative Party`,
`Grn → Green Party`, `SNP → Scottish National Party`,
`PC → Plaid Cymru`, etc.).

## Scope

Scotland is excluded at ingest. Scottish councils have run STV since
2007, but LEAP only carries first-preference votes — no transfer
rounds — so FPTP-shaped distortion analysis on the data would be
misleading. (For 2022 Scottish STV we use the indylive CC-BY-SA 4.0
export at `source-data/council/scotland-2022-stv-indylive.csv`.)

Wales is included (FPTP for council elections until the 2027 STV
reform).

## Refresh procedure

```bash
mkdir -p source-data/council/leap && cd source-data/council/leap
for url_year in \
    "2016 https://www.andrewteale.me.uk/2016/2016-results.csv.zip" \
    "2017 https://www.andrewteale.me.uk/2017/leap-2017-05-04.zip" \
    "2018 https://www.andrewteale.me.uk/2018/leap-2018-05-03.zip" \
    "2019 https://www.andrewteale.me.uk/2019/leap-2019-05-02.zip"; do
  set -- $url_year
  year=$1; url=$2
  curl --http1.1 -sSL -A "Mozilla/5.0" -o "leap-${year}.zip" "$url"
  mkdir -p "$year" && unzip -o -q "leap-${year}.zip" -d "$year"
done
bun run etl
```

The server requires a real User-Agent and rejects HTTP/2 from `curl`
(use `--http1.1`). Andrew updates older years occasionally as new ward
data arrives via Returning Officers — annual refresh recommended.

## Licence

> All text and images in this website are available for reuse and
> modification under the terms of the Creative Commons
> Attribution-Sharealike 3.0 Unported Licence and the GNU Free
> Documentation Licence (unversioned, with no invariant sections,
> front-cover texts, or back-cover texts).

Dual-licensed CC-BY-SA 3.0 / GFDL.

### What this means for electionresults.uk

- **Attribution**: every page or download that surfaces LEAP-derived
  data must credit Andrew Teale's Local Elections Archive Project with
  a link to <https://www.andrewteale.me.uk/leap/>. Site footer
  attribution + a methodology-page entry is sufficient for general
  derived analyses; per-page attribution is needed where the page is
  primarily LEAP data (e.g. a 2018 council results table).
- **Share-alike**: any **dataset download** that includes LEAP-derived
  rows must itself be released under CC-BY-SA 3.0 or a one-way
  compatible licence (CC-BY-SA 4.0 is the standard upgrade). Keep such
  downloads clearly labelled and segregated from CC-BY datasets so the
  share-alike obligation doesn't accidentally bleed onto downloads
  derived only from CC-BY sources (LEH / Democracy Club).
- **Site code and other content**: not affected. The share-alike
  obligation rides on the data, not on the analysis pipeline or the
  prose around it.

When publishing the cleaned/normalised tables that flow out of the ETL,
mark LEAP-touched downloads `CC-BY-SA 4.0` with attribution to Andrew
Teale; everything else can be `CC-BY 4.0`.
