<script lang="ts">
  import Frac from '$lib/components/Frac.svelte';
  let { data } = $props();
  const sourceLabel = $derived(data.sourceLabel);
  const cycles = $derived(data.cycles);
</script>

<svelte:head>
  <title>Methodology — electionresults.uk</title>
  <meta
    name="description"
    content="How every figure on electionresults.uk is computed, where the source data comes from, and the editorial frame that names the voting method (not individual candidates) as the subject."
  />
  <link rel="canonical" href="https://electionresults.uk/councils/methodology" />
  <meta property="og:image" content="https://electionresults.uk/og/flip-map.png" />
  <meta property="og:image:width" content="1016" />
  <meta property="og:image:height" content="841" />
  <meta name="twitter:image" content="https://electionresults.uk/og/flip-map.png" />
</svelte:head>

<main>
  <h1>Methodology</h1>

  <p class="lede">
    This page documents every formula, source, and editorial choice on the
    site. Read it before you cite us. If you find an error, mail
    <a href="mailto:felix.sargent@gmail.com">felix.sargent@gmail.com</a>
    &mdash; I'll publish a correction with date, diff, and impact.
  </p>

  <h2>Editorial frame</h2>
  <p>
    Every page on this site makes
    <strong>the voting method the subject</strong> &mdash; not the
    individual elected on it. We name candidates because the public election
    record names them; we make no claim about any individual candidate's
    conduct, fitness for office, or character. The factual claim — "won X% of
    valid ballots" — is verifiable from the source data linked on
    <a href="/data">/data</a>.
  </p>
  <p>
    We deliberately don't call winners "majority" or "minority"
    winners. Those terms imply First-Past-the-Post and bloc vote have a
    numerical threshold a winner must clear &mdash; they don't. A
    candidate wins under these methods by being top of the poll, full
    stop, regardless of share. Instead we report each elected
    candidate's share against the <strong>proportional quota</strong>
    &mdash; the share they'd need to clinch the seat under a system
    that allocates seats in proportion to votes &mdash; and call out
    the gap.
  </p>
  <p>
    Under proportional systems, results like the ones on this site
    simply don't occur: the proportional quota is the floor that any
    common proportional method requires. The contrast between
    First-Past-the-Post / bloc vote and a proportional alternative is
    the editorial frame throughout the site.
  </p>
  <p>
    <strong>What counts as "proportional"?</strong> The quota threshold
    applies to any method whose <em>overall</em> seat allocation tracks
    the vote distribution &mdash; STV, list PR (D'Hondt, Sainte-Lagu&euml;,
    and similar), proportional approval, and the regional-list portion
    of mixed-member systems like AMS. Mixed-member systems are
    partly First-Past-the-Post in their constituency component, but
    their compensatory list seats restore overall proportionality, so
    the quota framing is still the right benchmark for the system as a
    whole. We deliberately don't single out one preferred method on
    this site &mdash; the editorial argument is against the
    distortion, not for one particular replacement. For comparisons
    between proportional methods, see the sister site
    <a href="https://proportional.uk" rel="external noopener">proportional.uk</a>.
  </p>
  <p>
    Picking the right replacement is exactly what a
    <a href="https://www.open-britain.co.uk/ncer" rel="external noopener">National
    Commission on Electoral Representation</a> would be for. The data
    on this site documents the case for one.
  </p>

  <h2>Winning percentage</h2>
  <p>
    For every elected candidate we report
    <code>candidate_votes / valid_ballots</code>, where
    <code>valid_ballots</code> is the number of <strong>voters who cast
    a valid ballot</strong> &mdash; not the sum of all candidate votes.
    Reporting on a per-voter basis keeps the percentage comparable
    across single-member and multi-member wards (under bloc vote a
    voter casts up to N votes for an N-seat ward, so summing candidate
    votes over-counts voters by ~N&times;).
  </p>
  <p>
    For a multi-member ward we headline the <strong>elected candidate
    with the smallest share of voters</strong> &mdash; the seat-holder
    at the margin in that ward &mdash; because that figure shows how
    little voter support a seat actually needed.
  </p>

  <h3 id="bloc-vote-denominator">A note on the bloc-vote denominator</h3>
  <p>
    <code>valid_ballots</code> is sourced one of two ways:
  </p>
  <ul>
    <li>
      <strong>From the source data when available.</strong> The 2025
      Local Election Handbook publishes per-ward
      <code>Ballots</code> and <code>Invalid&nbsp;votes</code>;
      <code>valid_ballots = Ballots − Invalid&nbsp;votes</code>.
    </li>
    <li>
      <strong>Approximated when not.</strong> The 2021&ndash;2024 LEH
      workbooks and the 2026 Democracy Club CSV don't carry that
      column, so we approximate
      <code>valid_ballots = sum(candidate_votes) / seats</code>. This
      matches the standard ERS adjustment for bloc-vote multi-member
      wards: each voter casts N votes; if everyone uses all N, the sum
      of all candidate votes is N times the number of voters.
    </li>
  </ul>
  <p>
    The approximation has one knowable bias: voters who <em>plump</em>
    (cast fewer than N votes) make the real ballot count higher than
    <code>votes / N</code>, so the marginal winner's voter share is
    slightly <em>lower</em> than the figure we publish. Treat any
    multi-member percentage from a non-LEH-2025 cycle as an upper
    bound; the cleanest figures on the site are the 2025 LEH cycle
    where <code>Ballots − Invalid&nbsp;votes</code> is the actual
    count.
  </p>
  <p>
    <strong>Why the candidate table shows two share columns.</strong>
    For multi-seat wards (2+ seats) the per-candidate row carries both
    <em>share of votes</em> &mdash;
    <code>candidate_votes / total_votes_cast</code>, the figure the
    council publishes &mdash; and <em>share of voters (est.)</em>
    &mdash; <code>candidate_votes / valid_ballots</code>, equivalent
    to the raw share multiplied by the seat count when we are
    approximating. The first reconciles with the official source; the
    second is the figure that is comparable across single- and
    multi-seat wards and the one the proportional-quota indictment is
    measured against. Both are correct; they answer different
    questions, and people coming from the council's results page
    should see both side by side.
  </p>

  <h2 id="quota">Proportional quota and "below quota"</h2>
  <p>
    The <strong>proportional quota</strong> is the share of valid
    ballots a candidate would need to be guaranteed a seat under any
    common proportional voting method:
    <code>quota</code> = <Frac num="1" denom="seats + 1" />. For a 1-seat
    ward this collapses to 50% (a true majority); for 2 seats it is
    33.3%; for 3 seats, 25%. (Technical name for the curious: the
    <em>Droop quota</em>, after H.&nbsp;R.&nbsp;Droop's 1869 paper on
    proportional election methods. The figure is used, in the same or
    near-identical form, by every preferential and party-list system
    we are aware of.)
  </p>
  <p>
    For each race we compute the signed gap
    <code>under_par = winning_pct − quota</code>. A
    <strong>negative</strong> value means the marginal elected
    candidate won less of the valid ballots than the quota &mdash;
    the seat would not have been guaranteed under a proportional
    count. We surface this as <em>"X.X points below quota"</em> and
    treat it as the editorial indictment of the voting method, not
    the candidate. Positive (above-quota) results are mathematically
    clean and pass without comment. The value is a signed gap:
    below-quota results read as a negative number, matching the
    <em>Drift from quota</em> column on per-council pages.
  </p>

  <h2>"If votes were counted by party"</h2>
  <p>
    On every council page we show how the seats would be distributed if
    the party vote totals were allocated proportionally rather than via
    First-Past-the-Post. The arithmetic uses the
    <strong>D'Hondt method</strong> as a
    <strong>proxy for proportionality</strong> &mdash; a measurement
    tool, not a recommendation. D'Hondt is one well-defined way to
    allocate seats to vote shares, which makes it useful as a
    consistent benchmark; the column shows how distorted the actual
    FPTP allocation is against <em>any</em> proportional standard, not
    against D'Hondt specifically. It allocates seats one at a time to
    the party with the highest quotient
    <Frac num="party votes" denom="(seats already won) + 1" />,
    repeating until all seats are filled.
  </p>
  <p>
    <strong>This site doesn't take a stand on which voting method is
    best.</strong> Picking the right replacement for First-Past-the-Post
    is exactly what a
    <a href="https://www.open-britain.co.uk/ncer" rel="external noopener">National
    Commission on Electoral Representation</a> would be for. For more
    on the trade-offs between proportional methods (STV, list PR,
    mixed-member, approval, and others), see the sister site
    <a href="https://proportional.uk" rel="external noopener">proportional.uk</a>.
  </p>
  <p>
    <strong>Caveat &mdash; bloc vote inflation.</strong> In a multi-member
    ward (electing N councillors at once under bloc vote), each voter
    may cast up to N votes &mdash; so parties that ran a full slate get
    up to N&times; the votes of parties that ran a single candidate.
    Aggregating "candidate votes by party" therefore over-counts parties
    with full slates and under-counts parties with partial ones. Treat
    the proportional column as a <em>directional proxy</em> for what
    any list-PR system would deliver, not an exact prediction. Methods
    that count voter rankings (preferential / ranked) don't have this
    aggregation issue at all because they read each voter's full
    preference order rather than summing candidate totals; the LEH
    data doesn't record rankings, so we can't reproduce that
    allocation here.
  </p>

  <h2 id="gallagher">Gallagher disproportionality index</h2>
  <p>
    Above the &ldquo;If votes were counted by party&rdquo; table on every
    council page we show a single number called the
    <strong>Gallagher index</strong> (sometimes
    <strong>LSq</strong>, for least-squares). It is the academic standard
    summary of how proportionally an election translated votes into
    seats &mdash; one number, computed across every party that stood,
    that you can compare from council to council and cycle to cycle.
  </p>
  <p>The formula, from <a href="https://en.wikipedia.org/wiki/Gallagher_index" rel="external noopener">Michael Gallagher (1991)</a>:</p>
  <p class="formula">
    Gallagher = √( ½ &middot; &Sigma; (V<sub>i</sub> &minus; S<sub>i</sub>)<sup>2</sup> )
  </p>
  <p>
    where V<sub>i</sub> and S<sub>i</sub> are party <em>i</em>&rsquo;s
    vote share and seat share, both expressed as percentages (0&ndash;100).
    Squaring the differences before summing means a single very large
    gap (e.g. one party getting 60% of the seats on 35% of the vote)
    contributes much more than several small ones &mdash; the index
    weights big distortions heavily, which is the editorial point.
    Halving the sum and taking the square root puts the result back in
    the same percentage-point units as the inputs, so the number is
    directly readable.
  </p>
  <h3>How to read the number</h3>
  <p>
    Higher means more disproportional. Gallagher's own rough bands,
    widely used in the literature:
  </p>
  <ul>
    <li><strong>0&ndash;5</strong> &mdash; highly proportional. Typical
      list-PR or STV result.</li>
    <li><strong>5&ndash;10</strong> &mdash; moderate distortion. Most
      mixed-member systems sit here.</li>
    <li><strong>10&ndash;15</strong> &mdash; noticeable distortion. The
      seat allocation is visibly skewed from the vote shares.</li>
    <li><strong>15+</strong> &mdash; severe. The norm for UK
      First-Past-the-Post general elections (the 2024 Westminster
      general election scored ~24).</li>
  </ul>
  <h3>Worked example</h3>
  <p>
    Take a council where the cycle delivered:
    Conservative 35.1% votes &rarr; 59.3% seats;
    Labour 30.2% &rarr; 40.7%;
    Green 17.7% &rarr; 0%;
    Reform 10.8% &rarr; 0%;
    Lib&nbsp;Dem 6.2% &rarr; 0%.
    Squaring each (V&minus;S) gap and halving the sum gives
    &asymp;583, whose square root is <strong>~24.1</strong>. That is
    Gallagher saying: across all parties, this election was severely
    disproportional &mdash; not just because the Conservative bonus
    was 24 points, but because the Green, Reform and Lib&nbsp;Dem
    shutouts compound on top.
  </p>
  <h3>Gallagher vs. the per-party Δ table</h3>
  <p>
    The two views are complementary. The per-party
    <strong>Δ</strong> column tells you <em>who</em> the system
    over- and under-represented in this specific cycle &mdash; which
    party got an unearned bonus and which votes counted for nothing.
    Gallagher tells you <em>how bad</em> the overall mismatch was, in a
    single number you can rank councils by or watch over time. Use Δ to
    name the affected parties; use Gallagher to compare elections.
  </p>
  <p>
    A note on what Gallagher is <em>not</em>: it is purely descriptive.
    It scores a particular vote-to-seat translation; it does not
    prescribe what the seats <em>should</em> have been (we use D'Hondt
    on the same page as a separate proxy for that). High Gallagher just
    means &ldquo;these vote shares and these seat shares don't match
    well.&rdquo;
  </p>
  <p class="muted">
    A caveat carries over from the &ldquo;If votes were counted by
    party&rdquo; table: in multi-member bloc-vote wards each voter casts
    multiple votes, so candidate totals over-count parties that ran a
    full slate and under-count those that didn't. The vote shares feeding
    Gallagher inherit that bias; treat the absolute number as
    <em>directional</em> for councils with many multi-member wards.
  </p>

  <h2>Cycle-over-cycle comparison</h2>
  <p>
    Each council overview page (<code>/[council]</code>) compares the
    council across every cycle in our data. Three views:
  </p>
  <ul>
    <li>
      <strong>Council composition.</strong> The actual seat count by
      party as of the most recent year covered by
      <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
      &mdash; one square per seat, hover for the party. Reflects the
      live council including by-elections and defections, not just
      election cycles. Where opencouncildata has no snapshot for a
      council (rare &mdash; mainly LGR-successor councils that didn't
      yet exist when oncd's window starts), we fall back to summing
      elected candidates from cycles within two years of the latest
      cycle, with the heading marked
      <em>(approx.)</em>.
    </li>
    <li id="flips">
      <strong>Council-control changes.</strong> A flip is when the
      largest single party in the council's running composition
      changes between year&nbsp;N&minus;1 and year&nbsp;N for some
      year&nbsp;N where an election was held. Composition is the
      opencouncildata annual snapshot of every council's actual seat
      count by party, including by-elections and defections, so the
      flip reflects a real change in who holds the most seats on the
      whole council &mdash; not just who topped the table in a single
      cycle's election. The <a href="/councils/flips">/councils/flips lens</a> lists
      every council-control change in our window, sorted by recency.
      Per-flip visualisation on each council page shows the running
      composition before and after.
    </li>
    <li>
      <strong>Ward-by-ward grid.</strong> Rows are wards (matched by
      name across cycles); columns are cycles, oldest on the left,
      latest on the right. Each cell shows the top-of-poll candidate's
      party and their share of valid ballots. Empty cells mean the
      ward did not poll that cycle. Caveat: ward names are matched as
      strings — boundary reviews can mean a ward of the same name is
      a slightly different geographical area in a later cycle.
    </li>
  </ul>

  <h2 id="distortion">FPTP per-election distortion</h2>
  <p>
    Distinct from council-control changes (the rare event where a
    council's largest party actually flipped) is the
    <strong>per-election FPTP distortion</strong> story &mdash; the
    systemic phenomenon where, in any single election, the seats
    First-Past-the-Post allocates don't match how a proportional system
    would have allocated them. Even in a stable council where no party
    flips, every cycle's election distorts the vote-to-seat
    relationship; that's the whole point of having an electoral-reform
    audit.
  </p>
  <p>
    For every (council, year) cycle we already compute an
    <em>If votes were counted by party</em> view (the per-council page's
    "If votes were counted by party" table) which gives the FPTP
    allocation alongside the D'Hondt proportional allocation. We rank
    cycles by the
    <strong>seats reallocated</strong> measure:
    <code>sum(|fptp_seats &minus; dhondt_seats|) / 2</code>, summed
    over parties in that cycle. The
    division by two is because every seat FPTP gives a party that
    proportional wouldn't is matched by a seat FPTP withholds from a
    party proportional would &mdash; so the raw sum double-counts. A
    perfectly proportional cycle has all-zero deltas; a cycle where
    FPTP gave one party 2 extra seats has total reallocation = 2.
  </p>
  <p>
    The <a href="/councils/distortion">/councils/distortion lens</a> ranks cycles by
    reallocated share (reallocated seats &divide; total seats elected
    that cycle), so a small council with 4 of 12 seats reallocated
    (33%) ranks above a big council with 4 of 60 (7%). The metric is
    per-cycle and apples-to-apples &mdash; it describes a single
    election in isolation, with no by-thirds caveat needed. Caveat: a
    boundary-review all-out cycle puts every seat up at once, which
    can mechanically produce big reallocation counts if the new ward
    map favours one party; the <em>fact</em> of reallocation is real
    distortion, but the magnitude is partly a function of "more seats
    were up to begin with."
  </p>

  <h2>Council reorganisations</h2>
  <p>
    Eleven councils in our window were created or abolished by the
    2019&ndash;2023 wave of UK local-government reorganisation (LGR).
    Where
    that applies, the council overview page carries an explicit
    warning banner explaining what happened and when, and listing the
    predecessor or successor councils. The list is hand-curated from
    the
    <a
      href="https://en.wikipedia.org/wiki/2019%E2%80%932023_structural_changes_to_local_government_in_England"
      rel="external noopener"
    >Wikipedia record</a> of the LGR wave, cross-checked against the
    Commons Library briefing CBP-9056. The next wave (Surrey 2026,
    Essex 2027/28) will be added when those cycles enter the dataset.
  </p>

  <h2>System anomalies</h2>
  <p>
    Three anomaly lenses are surfaced as their own pages:
  </p>
  <ul>
    <li>
      <a href="/councils/below-quota">/councils/below-quota</a> &middot; every elected
      seat anywhere in the data where the marginal winner's share fell
      below the proportional quota for that ward. Sortable, filterable
      by year, party, and council.
    </li>
    <li>
      <a href="/councils/distortion">/councils/distortion</a> &middot; every cycle in
      our data ranked by FPTP-vs-proportional seats reallocated. See
      <a href="#distortion">FPTP per-election distortion</a> above for
      the metric definition.
    </li>
    <li>
      <a href="/councils/flips">/councils/flips</a> &middot; every council where the
      largest party in the running composition changed between
      consecutive cycle years, sorted by recency. See
      <a href="#flips">council-control changes</a> above for the
      precise definition.
    </li>
  </ul>
  <p>
    Other classical FPTP anomalies &mdash; smallest absolute winning
    vote count, party second in vote share winning the most seats per
    council, vote-share-to-seat-share inversions, multi-member wards
    electing a third-placed party's candidate, high-turnout wards with
    low-mandate winners &mdash; are computable from the SQLite
    database but not yet surfaced as their own lenses on the site.
  </p>

  <h2 id="sources">Sources</h2>
  <p>
    <strong>Election results (2021&ndash;2025)</strong> &mdash; ingested
    from the <strong>Local Election Handbook</strong> (LEH) for the
    relevant year, published by the House of Commons Library under the
    Open Parliament Licence. The per-year ETL adapter normalises
    sheet-name and column-name drift across years.
  </p>
  <p>
    <strong>Scottish STV (2022).</strong> Council elections in Scotland
    use Single Transferable Vote. Per-candidate first preferences,
    round-by-round transfers, per-ward electorate / valid poll / quota
    are sourced from
    <a href="https://election.indylive.radio/download/" rel="external noopener">indylive radio</a>'s
    aggregated CSV (their redistribution of council eCount exports +
    Democracy Club candidate metadata) under
    <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="external noopener">CC&nbsp;BY-SA&nbsp;4.0</a>.
    The raw CSV is mirrored at
    <a href="/data/stv/scotland-2022.csv"><code>/data/stv/scotland-2022.csv</code></a>
    so sister projects (notably
    <a href="https://stv.vote" rel="external noopener">stv.vote</a>) can
    pull the round-by-round data directly. The
    &ldquo;unfairly awarded&rdquo; measure (party first-pref share vs
    party seat share) uses the same arithmetic as the FPTP map; the
    contrast on the homepage is the same metric, different counting
    rule. Wales's 2022 elections were FPTP &mdash; the Local
    Government and Elections (Wales) Act 2021 enables councils to opt
    in to STV from 2027; no Welsh council has yet adopted it.
  </p>
  <p>
    <strong>Election results (2026, preliminary)</strong> &mdash; sourced
    from
    <a href="https://democracyclub.org.uk" rel="external noopener">Democracy Club</a>'s
    candidates dataset, reused here under
    <a href="https://creativecommons.org/licenses/by/4.0/" rel="external noopener">CC&nbsp;BY&nbsp;4.0</a>
    (party logos and candidate photos, which Democracy Club excludes from
    that licence, are not used on this site &mdash; we only consume the
    structured results data). Polling-night data is updated as wards
    report; until a ward's full count is in we drop the race entirely
    (rather than surface partial vote totals that would assign
    &ldquo;elected&rdquo; to the wrong candidates). The 2026 LEH
    replaces this feed as the canonical source when it ships.
  </p>
  <p>
    <strong>Council composition snapshots (2016&ndash;2025)</strong>
    &mdash; annual per-council per-party seat counts (used for the
    running-composition block on each council page and the
    council-control flip definition above) come from
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>,
    a hand-maintained register of UK council membership going back to
    1973, published under
    <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="external noopener">CC&nbsp;BY-SA&nbsp;4.0</a>.
    Snapshot file (<code>source-data/council/history2016-2025.csv</code>) is committed
    in the repo; refresh by re-downloading from oncd. Slug aliases for
    the small number of councils that LEH and oncd name slightly
    differently (Bristol, County Durham, King's Lynn and West Norfolk,
    Kingston upon Hull) are explicit in
    <code>scripts/etl.mjs</code>; the ETL prints any unmatched councils
    on each run.
  </p>
  <p>
    <strong>Council composition snapshots (2026, synthesised)</strong>
    &mdash; opencouncildata publishes its annual snapshot months after
    polling day, so the 2026 row doesn't yet exist. To run the
    flip detector against the just-finished cycle we synthesise a 2026
    snapshot per council from the 2025 oncd per-councillor roster plus
    the 2026 election results: retain every 2025 incumbent whose
    <em>Next Election</em> field is not 2026, then add the 2026
    election winners for the seats that were up. Synthesised snapshots
    are flagged (<code>synthesised: true</code>) in the data and
    surfaced as such in the UI; they are replaced by the real oncd
    row on the next ETL run after oncd publishes 2026.
  </p>
  <ul>
    {#each cycles as c (c.year)}
      <li>
        <strong>{c.electionDateLabel}</strong> &middot;
        {c.councilCount} councils, {c.raceCount} races,
        {c.seatCount} seats elected.
      </li>
    {/each}
  </ul>
  <h2>Reproducibility</h2>
  <p>
    Every number on the published site is derivable from the SQLite database
    on <a href="/data">/data</a> using standard SQL. The schema documentation
    on that page lists every table and column. The site build is
    deterministic: the same git commit and the same source data produce the
    same published bytes.
  </p>

  <h2>What is <em>not</em> here yet</h2>
  <ul>
    <li>DuckDB-WASM widgets for live-querying tables in the browser
      — deferred.</li>
    <li>The full system-anomalies lens beyond
      <a href="/councils/below-quota">/councils/below-quota</a> and <a href="/councils/flips">/councils/flips</a>
      &mdash; smallest absolute winning vote count, vote-share-to-seat-share
      inversions, third-place-by-party-share-wins-seat, and high-turnout
      wards with low-mandate winners are all computable but don't yet
      have their own pages.</li>
    <li>An exact council-composition figure that matches each council's
      live members list — see the "Council composition" caveat above.</li>
    <li>Per-candidate pages and biographies — explicitly excluded by
      editorial design: the unit of analysis is the seat / race, not
      the person.</li>
  </ul>

  <h2>Errata</h2>

  <h3>2026-05-13 — county-council elections mis-attributed in 2021 and 2025</h3>
  <p>
    The LEH workbooks for county-election years (2021, 2025) record the
    upper tier (e.g. Lancashire) as the elected body and the lower tier
    (e.g. Rossendale) as the geographic district that holds each
    division. Our ETL was filing every race under the lower tier, so
    Reform UK's 2025 Lancashire County Council sweep showed up as
    phantom races on Rossendale, Burnley, Pendle, Preston, and West
    Lancashire borough pages, while
    <a href="/councils/lancashire">/councils/lancashire</a> appeared to have no data after
    2017. The fix re-attributes shire-county rows (2021
    <code>Type=SC</code>, 2025 <code>Local authority type=CC</code>) to
    the actual county council. Affected: every district that overlaps a
    two-tier county lost its phantom 2021/2025 cycle; 21 county
    councils gained their 2021 cycle (Norfolk, Lancashire, Surrey,
    Hertfordshire, Hampshire, Kent, Essex, Lincolnshire, West Sussex,
    Suffolk, Derbyshire, Oxfordshire, Staffordshire, Cambridgeshire,
    Devon, Warwickshire, Nottinghamshire, Gloucestershire,
    Leicestershire, Worcestershire, East Sussex), 14 of those gained
    their 2025 cycle (the others had their 2025 elections postponed for
    local-government reorganisation). 18 new county-council flips
    surface in the data — most notably the 2021→2025
    Conservative-collapse rows (Reform UK or Liberal Democrats taking
    13 of the 14 county councils that polled). Total flip count
    218 → 220.
  </p>

  <h3>2026-05-13 — opencouncildata "stale tail" rows hidden</h3>
  <p>
    opencouncildata publishes the year-N composition row in early year
    N+1; until it lands they leave a placeholder identical to the
    previous year. The composition history on each council page was
    surfacing those placeholders as if they were real snapshots — most
    visibly on Rossendale, whose 2025 row was a byte-identical copy of
    its 2024 row because the borough didn't poll in 2025 and oncd
    hadn't refreshed yet. The ETL now flags such tail rows
    <code>staleCopy: true</code> and the data layer hides them from
    public timelines and from the headline "council composition as of
    {'{year}'}" callout. The rows remain in the underlying file so
    they can still serve as a 2025 baseline for the 2026 synthesis
    step. 109 rows are currently flagged.
  </p>
</main>

<style>
  .lede { font-size: 1.1rem; }
  .formula {
    font-size: 1.05rem;
    text-align: center;
    padding: 0.6rem 1rem;
    margin: 0.6rem 0 1rem;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 4px;
    font-family: 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
  }
  @media (prefers-color-scheme: dark) {
    .formula { background: rgba(255, 255, 255, 0.06); }
  }
  code {
    background: rgba(0, 0, 0, 0.05);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.9em;
  }
  @media (prefers-color-scheme: dark) {
    code { background: rgba(255, 255, 255, 0.08); }
  }
</style>
