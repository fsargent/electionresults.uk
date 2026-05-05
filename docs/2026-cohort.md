# 2026-05-07 cohort — 136 English principal councils

Source: Democracy Club 2026 election data summary (2026-04-13) and Wikipedia "2026 United Kingdom local elections", cross-checked 2026-05-05.

| Type | All-out | By-thirds | By-halves | Total |
|---|---|---|---|---|
| London boroughs | 32 | 0 | 0 | 32 |
| Metropolitan boroughs | 16 | 16 | 0 | 32 |
| Unitary authorities | 6 | 12 | 0 | 18 |
| County councils | 6 | 0 | 0 | 6 |
| District councils | 3 | 38 | 7 | 48 |
| **Total** | **63** | **66** | **7** | **136** |

Plus 6 directly elected mayors: Croydon, Hackney, Lewisham, Newham, Tower Hamlets, Watford.

## Prior-cycle comparator by group

| Group | Prior election | Source |
|---|---|---|
| London boroughs (all-out) | May 2022 | CBP-9545 + 2022 LEH |
| Metropolitan boroughs all-out | May 2022 (last all-out) or May 2024 (latest cycle) | 2022 LEH / 2024 LEH |
| Metropolitan boroughs by-thirds | May 2024 | 2024 LEH |
| Unitary all-out | May 2022 (last all-out) | 2022 LEH |
| Unitary by-thirds | May 2024 | 2024 LEH |
| County councils (all-out) | May 2021 | 2021 LEH (out of scope of memo) |
| District by-thirds | May 2024 | 2024 LEH |
| District by-halves | May 2024 (or May 2022) | 2024 / 2022 LEH |
| District all-out | May 2022 (last all-out) | 2022 LEH |

> **County councils**: prior cycle is May 2021, not 2022/23/24. None of the three CBP briefings discussed below cover this. Source for 2021 county comparator will be CBP-9228 ("Local elections 2021: Results and analysis") + 2021 LEH — to be confirmed when actually ingested.

## Council list

### London boroughs (32, all-out)
Barking and Dagenham, Barnet, Bexley, Brent, Bromley, Camden, Croydon, Ealing, Enfield, Greenwich, Hackney, Hammersmith and Fulham, Haringey, Harrow, Havering, Hillingdon, Hounslow, Islington, Kensington and Chelsea, Kingston upon Thames, Lambeth, Lewisham, Merton, Newham, Redbridge, Richmond upon Thames, Southwark, Sutton, Tower Hamlets, Waltham Forest, Wandsworth, Westminster.

### Metropolitan boroughs all-out (16)
Barnsley, Birmingham, Bradford, Calderdale, Coventry, Gateshead, Kirklees, Newcastle upon Tyne, Sandwell, Sefton, Solihull, South Tyneside, St Helens, Sunderland, Wakefield, Walsall.

### Metropolitan boroughs by-thirds (16)
Bolton, Bury, Dudley, Knowsley, Leeds, Manchester, North Tyneside, Oldham, Rochdale, Salford, Sheffield, Stockport, Tameside, Trafford, Wigan, Wolverhampton.

### Unitary authorities all-out (6)
East Surrey, Isle of Wight, Milton Keynes, Swindon, Thurrock, West Surrey.

### Unitary authorities by-thirds (12)
Blackburn with Darwen, Halton, Hartlepool, Hull, North East Lincolnshire, Peterborough, Plymouth, Portsmouth, Reading, Southampton, Southend-on-Sea, Wokingham.

### County councils (6, all-out)
East Sussex, Essex, Hampshire, Norfolk, Suffolk, West Sussex.

### District councils all-out (3)
Huntingdonshire, Newcastle-under-Lyme, South Cambridgeshire.

### District councils by-halves (7)
Adur, Cheltenham, Fareham, Gosport, Hastings, Nuneaton and Bedworth, Oxford.

### District councils by-thirds (38)
Basildon, Basingstoke and Deane, Brentwood, Broxbourne, Burnley, Cambridge, Cannock Chase, Cherwell, Chorley, Colchester, Crawley, Eastleigh, Epping Forest, Exeter, Harlow, Hart, Havant, Hyndburn, Ipswich, Lincoln, Norwich, Pendle, Preston, Redditch, Rochford, Rugby, Rushmoor, St Albans, Stevenage, Tamworth, Three Rivers, Tunbridge Wells, Watford, Welwyn Hatfield, West Lancashire, West Oxfordshire, Winchester, Worthing.

## Prior-cycle data files in this directory

All downloaded 2026-05-05 by Felix from parliament.uk (Cloudflare bot challenge blocks automated download — replace by hand if files need refreshing).

| File | Source | Shape | Covers (2026 cohort) |
|---|---|---|---|
| `local_elections_2021_results-2.xlsx` | 2021 LEH | `Candidates-results` (18,046) / `Wards-results` (3,865) | 6 county all-out |
| `local-elections-2022.xlsx` | 2022 LEH | `Candidates-results` (18,483) / `Wards-results` (3,613) | 32 London + 16 met all-out + 6 unitary all-out + 3 district all-out (57) |
| `CBP9545-detailed-results-for-download.xlsx` | CBP-9545 May 2022 summary | `England` (325 council rows) + Scot/Wales + party affiliation | Council-level cross-check for the 57 above |
| `LEH-Candidates-2023.xlsx` | 2023 LEH | `Cand_Table` (25,698) / `Ward_Level` (4,798) — **different schema** | 7 district by-halves |
| `data_tables.xlsx` | CBP-9798 May 2023 summary | `Results` (239) + NEV | Council-level cross-check for 2023 |
| `LEH-2024-results-HoC-version.xlsx` | 2024 LEH | `Candidates-results` (10,031) / `Wards-results` (1,905) | 16 met by-thirds + 12 unitary by-thirds + 38 district by-thirds (66) |
| `LEH-2025-results-HoC.xlsx` | 2025 LEH (dev fixture) | `Candidates results` / `Wards results` — **spaces, not hyphens** | Not a 2026 comparator; ETL dev fixture only |

**Adapter note:** sheet naming differs across years.
- 2021/2022/2024 LEH: hyphenated `Candidates-results` / `Wards-results`
- 2025 LEH: spaced `Candidates results` / `Wards results`
- 2023 LEH: structurally different — `Cand_Table` / `Pivot_Party` / `Ward_Level` / `Party_Names`

The `leh_xlsx_adapter` needs a per-year sheet-name map and a separate column-mapping path for 2023.

### Source URLs (for re-download)

- CBP-9545 (May 2022 results): <https://commonslibrary.parliament.uk/research-briefings/cbp-9545/>
- CBP-9798 (May 2023 results): <https://commonslibrary.parliament.uk/research-briefings/cbp-9798/>
- 2021 LEH: <https://commonslibrary.parliament.uk/2021-local-elections-handbook-and-dataset/>
- 2022 LEH: <https://commonslibrary.parliament.uk/2022-local-elections-handbook-and-dataset/>
- 2023 LEH: <https://commonslibrary.parliament.uk/2023-local-elections-handbook-and-dataset/>
- 2024 LEH: <https://commonslibrary.parliament.uk/2024-local-elections-handbook-and-dataset/>
- 2025 LEH: <https://commonslibrary.parliament.uk/2025-local-elections-handbook-and-dataset/>
- **No standalone 2024 "Results and analysis" briefing exists.** Related 2024 briefings cover separate elections: CBP-9989 (metro-mayors), CBP-10059 (London Mayor + Assembly).

### Cross-checks
- Open Council Data UK (CC BY-SA): <https://opencouncildata.co.uk/>
- Democracy Club 2026 summary: <https://democracyclub.org.uk/blog/2026/04/13/2026-local-election-data-summary/>
- Wikipedia: <https://en.wikipedia.org/wiki/2026_United_Kingdom_local_elections>
