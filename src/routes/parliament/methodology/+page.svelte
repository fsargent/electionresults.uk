<svelte:head>
  <title>Methodology &mdash; Parliament &mdash; electionresults.uk</title>
  <meta
    name="description"
    content="How every parliamentary metric on electionresults.uk is computed: winning vote share, Gallagher disproportionality index, minority-winner count, boundary caveats, and source attribution."
  />
  <link rel="canonical" href="https://electionresults.uk/parliament/methodology" />
</svelte:head>

<main>
  <h1>Methodology &mdash; Parliament</h1>

  <p class="lede">
    This page documents every formula, source, and editorial choice on
    the <a href="/parliament">/parliament</a> surface. Read it before
    you cite us. If you find an error, mail
    <a href="mailto:felix.sargent@gmail.com">felix.sargent@gmail.com</a>
    &mdash; we&rsquo;ll publish a correction with date, diff, and
    impact.
  </p>

  <nav class="toc" aria-label="On this page">
    <h2 id="toc-heading">On this page</h2>
    <ul aria-labelledby="toc-heading">
      <li><a href="#fptp-distortion">What FPTP distortion is</a></li>
      <li><a href="#scope">Parliamentary scope &amp; coverage</a></li>
      <li><a href="#winning-share">Winning vote share</a></li>
      <li><a href="#gallagher">Gallagher disproportionality index</a></li>
      <li><a href="#minority-winners">Minority-winner count</a></li>
      <li><a href="#caveats">Data caveats &amp; tokens</a></li>
      <li><a href="#sources">Source lineage &amp; attribution</a></li>
      <li><a href="#reproducibility">Reproducibility</a></li>
      <li><a href="#csv-mapping">CSV column mapping</a></li>
      <li><a href="#errata">Errata &amp; corrections</a></li>
    </ul>
  </nav>

  <h2 id="fptp-distortion">What FPTP distortion is</h2>
  <p>
    Under First Past the Post, the candidate with the largest pile of
    votes in a constituency wins the seat &mdash; no majority required.
    Aggregated across hundreds of constituencies, that rule routinely
    converts a party&rsquo;s national vote share into a seat share that
    looks nothing like it. The same mechanism is the subject of the
    council audit at
    <a href="/councils/methodology">/councils/methodology</a>;
    differences between the two surfaces are domain-specific, not
    methodological. The voting method is the subject of analysis on
    every page here &mdash; never any individual candidate.
  </p>

  <h2 id="scope">Parliamentary scope &amp; coverage</h2>
  <p>
    The parliamentary surface currently covers the
    <strong>2024 UK general election</strong>. Coverage will expand as
    we ingest earlier elections; each year ships as an independent data
    artefact under <code>src/lib/data/parliament/&lt;year&gt;/</code> so
    older years can be added without touching the published numbers
    for newer ones (see &ldquo;Reproducibility&rdquo; below).
  </p>
  <p>
    Every contest is a UK Parliament constituency election. The
    parliamentary audit is structurally distinct from the council
    audit: constituencies are single-member, the electorate is
    national, and boundary reviews redraw the map every few elections.
    Comparisons across boundary sets are flagged with the
    <code>boundary-comparability-limited</code> caveat
    (see &sect;<a href="#caveats">Data caveats</a>).
  </p>

  <h2 id="winning-share">Winning vote share</h2>
  <p>
    For a single-member constituency contest, the winning vote share
    is:
  </p>
  <p class="formula">
    <em>winning share</em> = winning candidate&rsquo;s votes &divide;
    total valid votes cast in the contest
  </p>
  <p>
    Winning shares below 50% indicate that the elected candidate took
    less than a majority of the votes that were cast. Under FPTP this
    is unremarkable mechanically &mdash; the rules only require a
    plurality &mdash; but it&rsquo;s the headline number on every
    audit page because it&rsquo;s the most direct measure of how often
    the system seats a candidate whom most voters did not back.
  </p>

  <h2 id="gallagher">Gallagher disproportionality index</h2>
  <p>
    The Gallagher index (sometimes called the least-squares index) is
    the academic standard for measuring how far an election&rsquo;s
    seat shares diverged from its vote shares. It is computed
    nationally over every party that contested the election:
  </p>
  <p class="formula">
    Gallagher = &radic;( &frac12; &times; &Sigma; <em>(v<sub>i</sub>
    &minus; s<sub>i</sub>)</em><sup>2</sup> ) &times; 100
  </p>
  <p>
    where <em>v<sub>i</sub></em> is party <em>i</em>&rsquo;s share of
    valid national votes (as a fraction) and <em>s<sub>i</sub></em> is
    its share of total seats. The result scales 0&ndash;100; 0 is
    perfectly proportional, higher is more distorted. Numbers above 15
    are unusual in established democracies.
  </p>
  <h3>Worked example</h3>
  <p>
    A toy three-party election awards 10 seats. Party A takes 50% of
    votes and 8 seats (80%); Party B takes 30% of votes and 2 seats
    (20%); Party C takes 20% of votes and 0 seats (0%). The squared
    differences are (0.50 &minus; 0.80)<sup>2</sup> = 0.09, (0.30
    &minus; 0.20)<sup>2</sup> = 0.01, (0.20 &minus;
    0.00)<sup>2</sup> = 0.04. Sum = 0.14; half of that = 0.07;
    &radic;0.07 &asymp; 0.265. Multiplied by 100, Gallagher &asymp;
    26.5. The 2024 UK general election scored 23.7 by this measure
    &mdash; close to the toy example, and one of the highest values
    on record for a UK general election.
  </p>

  <h2 id="minority-winners">Minority-winner count</h2>
  <p>
    The minority-winner count is the number of constituencies in
    which the elected candidate&rsquo;s winning share was strictly
    below 50%. Single-member contests only; multi-member historical
    contests are excluded.
  </p>
  <p>
    The denominator is total seats audited. The count is precomputed
    by the ETL so the same value appears on every page that cites it
    (overview, year audit, methodology). For the 2024 general
    election the count was 554 of 649 seats.
  </p>

  <h2 id="caveats">Data caveats &amp; tokens</h2>
  <p>
    Every contest and candidate row carries a
    <code>caveats[]</code> field (possibly empty, never null). The
    tokens are stable strings so downstream pages, exports, and
    machine consumers can branch on them without parsing prose. The
    canonical list:
  </p>
  <table>
    <thead>
      <tr>
        <th scope="col">Token</th>
        <th scope="col">Meaning</th>
        <th scope="col">Effect on headline metrics</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row"><code>uncontested</code></th>
        <td>
          Single candidate on the ballot. No valid runner-up share to
          report.
        </td>
        <td>
          Excluded from the minority-winner count and the
          low-winning-share leaderboard.
        </td>
      </tr>
      <tr>
        <th scope="row"><code>speaker</code></th>
        <td>
          The Speaker of the House of Commons stood as
          &ldquo;Speaker seeking re-election,&rdquo; not under a party
          label. Major parties traditionally do not contest the seat.
        </td>
        <td>
          Counted in seat totals; excluded from the disproportionality
          index party-by-party calculation as a Speaker-bucket row.
        </td>
      </tr>
      <tr>
        <th scope="row"><code>missing-turnout</code></th>
        <td>
          Source dataset does not report electorate or valid-votes
          for this contest, so turnout cannot be computed.
        </td>
        <td>
          The contest still appears with its candidate-level result;
          turnout-derived numbers render as &ldquo;Not reported.&rdquo;
        </td>
      </tr>
      <tr>
        <th scope="row"><code>multi-member-historical</code></th>
        <td>
          Pre-1950 multi-member constituency &mdash; voters had
          multiple votes and there were multiple winners per contest.
          Modern single-member metrics do not generalise cleanly.
        </td>
        <td>
          Excluded from single-member-only metrics (minority-winner
          count, low-winning-share leaderboard).
        </td>
      </tr>
      <tr>
        <th scope="row"><code>boundary-comparability-limited</code></th>
        <td>
          The constituency&rsquo;s geography changed in the most
          recent boundary review. A like-named seat in an earlier
          election may cover a different area.
        </td>
        <td>
          Headline numbers are unaffected; the caveat surfaces in the
          UI to discourage casual time-series comparison.
        </td>
      </tr>
      <tr>
        <th scope="row"><code>source-discrepancy</code></th>
        <td>
          Source data contains an internal inconsistency (e.g.
          candidate vote total doesn&rsquo;t reconcile with
          declared turnout). The ETL takes the source row as-is and
          tags it.
        </td>
        <td>
          The row remains in the dataset; downstream consumers can
          filter out as needed. Headline metrics include it.
        </td>
      </tr>
    </tbody>
  </table>

  <h2 id="sources">Source lineage &amp; attribution</h2>
  <p>
    The 2024 general-election ingest is built from the
    <a
      href="https://commonslibrary.parliament.uk/research-briefings/cbp-10009/"
      rel="external noopener">House of Commons Library general election
    results 2024 (CBP-10009)</a>
    dataset, published under the
    <a
      href="https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/"
      rel="external noopener">Open Parliament Licence v3.0</a>. The raw
    source file lives under
    <code>source-data/parliament/2024/</code> in the repository; the
    ETL never mutates it.
  </p>
  <p>
    Source attribution travels with every published artefact &mdash;
    the per-year <code>manifest.json</code> embeds source name, URL,
    licence, retrieval date, publication date, ETL run timestamp, and
    ETL version. Per-page footers cite the same manifest.
  </p>

  <h2 id="reproducibility">Reproducibility</h2>
  <p>
    Every published number is reproducible from the source files in
    this repository:
  </p>
  <ol>
    <li>
      Clone the repo and check out the version tag that produced the
      page you&rsquo;re citing (the manifest <code>etlVersion</code>
      identifies it).
    </li>
    <li>
      Re-run the parliament ETL:
      <code>bun run refresh-data:parliament</code>. The script reads
      <code>source-data/parliament/&lt;year&gt;/</code> and writes
      <code>src/lib/data/parliament/&lt;year&gt;/</code> &mdash;
      same files as shipped.
    </li>
    <li>
      Diff the regenerated JSON against the committed JSON. Identical
      output is the reproducibility guarantee.
    </li>
  </ol>
  <p>
    For analyst workflows (pandas, R, Excel) the same numbers ship as
    CSV exports under <code>/data/parliament/&lt;year&gt;/</code>;
    column mappings are documented at
    <a href="/parliament/data">/parliament/data</a>.
  </p>

  <h2 id="csv-mapping">CSV column mapping</h2>
  <p>
    CSV downloads under
    <a href="/parliament/data">/parliament/data</a> use
    <strong>snake_case</strong> headers &mdash; the analyst convention
    in pandas, R, and Excel &mdash; distinct from the camelCase JSON
    served to the SvelteKit loaders. The translation is mechanical:
    every JSON <code>partyDisplayName</code> becomes a CSV
    <code>party_display_name</code> column, <code>isWinner</code>
    becomes <code>is_winner</code> (rendered as <code>1</code> /
    <code>0</code>, matching the council CSV convention),
    <code>caveats[]</code> becomes a semicolon-joined string in a
    <code>caveats</code> column.
  </p>
  <p>
    Three CSV files per ingested year:
  </p>
  <ul>
    <li>
      <code>parliament-&lt;year&gt;-constituencies.csv</code> &mdash;
      one row per contest, with winner, runner-up, and majority
      denormalised onto the row so analysts can compute headline
      numbers without a join.
    </li>
    <li>
      <code>parliament-&lt;year&gt;-candidates.csv</code> &mdash; one
      row per candidate. The full unpivoted result set.
    </li>
    <li>
      <code>parliament-&lt;year&gt;-national-totals.csv</code> &mdash;
      one row per party, with vote share, seat share, and seat-delta.
    </li>
  </ul>
  <p>
    Full column reference (every column, every type, every source
    field) is in
    <a
      href="https://github.com/fsargent/electionresults.uk/blob/main/docs/parliament-schema.md"
      rel="external noopener"
      ><code>docs/parliament-schema.md</code></a>
    in the repository &mdash; the same document the ETL author and
    UI loaders both reference.
  </p>

  <h2 id="errata">Errata &amp; corrections</h2>
  <p>
    When a published parliamentary metric needs correcting we
    document it here, in this section, with:
  </p>
  <ul>
    <li>Date the issue was discovered and date it was fixed.</li>
    <li>Affected metric and affected pages.</li>
    <li>
      What changed (e.g. <em>&ldquo;source row for X corrected from
      12,453 to 12,543 votes&rdquo;</em>) and the resulting impact on
      the headline number.
    </li>
    <li>Commit or pull-request link to the fix.</li>
  </ul>
  <p>
    No parliamentary errata to date. Errors are inevitable &mdash;
    this section is here so corrections are first-class, not back-of-
    page footnotes.
  </p>
</main>

<style>

  .formula {
    /* Block-quoted formula, system-note styling so it reads as
       editorial annotation rather than running prose. */
    border-left: 3px solid var(--accent);
    padding: 0.4rem 0.8rem;
    background: rgba(11, 61, 46, 0.06);
    margin: 1rem 0;
    font-family: Georgia, 'Times New Roman', serif;
  }
</style>
