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
  <link rel="canonical" href="https://electionresults.uk/methodology" />
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
    whole. We deliberately don't single out one preferred method
    elsewhere on the site &mdash; the editorial argument is against
    the distortion, not for one particular replacement.
  </p>
  <p>
    Picking the right replacement is exactly what a
    <a href="https://www.open-britain.co.uk/ncer" rel="external noopener">National
    Commission on Electoral Representation</a> would be for. The data
    on this site documents the case for one.
  </p>

  <h2>Winning percentage</h2>
  <p>
    For a single-member ward,
    <code>winning_pct = winner_votes / valid_ballots</code>.
  </p>
  <p>
    For a multi-member ward (electing N councillors at once under bloc vote),
    each elected candidate has their own
    <code>candidate_votes / valid_ballots</code>. We headline the
    <strong>elected candidate with the smallest share</strong> — the
    seat-holder at the margin in that ward — because that figure shows
    how little support a seat actually needed under bloc vote.
    Per-candidate shares are also visible in the candidate table on
    every council page.
  </p>
  <p>
    <code>valid_ballots = ballots_cast − invalid_votes</code>. This matches
    the House of Commons Library "Valid vote turnout (HoC method)" definition
    in the source workbook.
  </p>

  <h3>A note on multi-member wards</h3>
  <p>
    In a multi-member ward (electing N councillors at once under bloc vote),
    each voter may cast up to N votes &mdash; so a candidate's
    <code>candidate_votes / valid_ballots</code> ratio understates the
    share of voters who supported them, sometimes by a lot. We report the
    ratio anyway, with the same denominator as single-member wards,
    because (a) it is the figure used by the source workbook and
    consistently comparable across ward types, and (b) any other choice
    would require speculating about how voters distributed their second
    and third votes. Readers interpreting multi-member percentages should
    treat them as a lower bound on candidate support, not an upper one.
    The proportional quota framing (above) is calibrated to this same
    denominator, so the comparison stays apples-to-apples.
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
    clean and pass without comment. (The DB column and TS field are
    named <code>under_par</code> for compatibility with earlier
    snapshots; the value itself is signed-gap, where below-quota
    reads as a negative number — same convention as the
    <em>Drift from quota</em> column on per-council pages.)
  </p>
  <p>
    This is a deliberate departure from the older "minority winner"
    framing (winning_pct &lt; 50%). The 50% threshold is not a rule of
    First-Past-the-Post or bloc vote &mdash; calling someone a "minority winner"
    implies they fell short of a standard the system never required of
    them. The quota framing is the standard a proportional system
    <em>does</em> require, and the gap is the loss attributable to the
    method.
  </p>

  <h2>"If votes were counted by party"</h2>
  <p>
    On every council page we show how the seats would be distributed if
    the party vote totals were allocated proportionally rather than via
    First-Past-the-Post. The arithmetic uses the
    <strong>D'Hondt method</strong> &mdash; the most widely-used
    party-list proportional algorithm worldwide (used by the European
    Parliament, the Scottish Parliament regional list, the Welsh Senedd
    regional list, and the London Assembly). It allocates seats one at
    a time to the party with the highest quotient
    <Frac num="party votes" denom="(seats already won) + 1" />, repeating
    until all seats are filled.
  </p>
  <p>
    <strong>Caveat &mdash; bloc vote inflation.</strong> In a multi-member
    ward (electing N councillors at once under bloc vote), each voter
    may cast up to N votes &mdash; so parties that ran a full slate get
    up to N&times; the votes of parties that ran a single candidate.
    Aggregating "candidate votes by party" therefore over-counts parties
    with full slates and under-counts parties with partial ones. Treat
    the proportional column as a <em>directional proxy</em> for what
    a list-PR system would deliver, not an exact prediction. A
    preferential proportional method that counts voter rankings would
    avoid this distortion, but the LEH data does not record voter
    rankings so we cannot reproduce that allocation here.
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
      <strong>Council-control flips.</strong> A flip is when the
      largest single party in the council's running composition
      changes between year&nbsp;N&minus;1 and year&nbsp;N for some
      year&nbsp;N where an election was held. Composition is the
      opencouncildata annual snapshot &mdash; the truth-set, not our
      cycle-by-cycle approximation. This is a deliberate departure
      from the older "cycle leader" definition (the party that won the
      most seats in a single cycle's election alone), which misled in
      by-thirds councils where one cycle's pickup could top the per-
      cycle table without changing who actually held the most seats on
      the council overall (East Lindsey 2024 is the exemplar &mdash;
      Reform won the seats up that cycle, but Conservatives still hold
      ~28 of 55 seats on the actual council, so calling it a "flip"
      would have been false). For each flip we compute the incoming
      party's <em>composition</em> seat-share shift (year&nbsp;N seat
      share minus year&nbsp;N&minus;1 seat share, the meaningful
      change-of-control number) and the incoming party's <em>cycle</em>
      vote-share shift between the two cycles' elections, both as
      percentage points (pp). Flips are ranked by
      <Frac num="composition seat shift (pp)" denom="max(cycle vote shift (pp), 1 pp)" />
      &mdash; the bigger the change of council control on the smaller
      change in votes that triggered it, the higher the rank. The
      vote-shift denominator is floored at 1 percentage point so a
      flip on near-zero vote movement (e.g. Wealden 2021&rarr;2023,
      0.6&nbsp;pp) doesn't divide by zero. The per-flip visualisation
      on each council page shows the full party breakdown in both
      cycles &mdash; votes as a bar, seats as one square per seat.
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
    Two anomaly lenses are surfaced as their own pages:
  </p>
  <ul>
    <li>
      <a href="/below-quota">/below-quota</a> &middot; every elected
      seat anywhere in the data where the marginal winner's share fell
      below the proportional quota for that ward. Sortable, filterable
      by year, party, and council.
    </li>
    <li>
      <a href="/flips">/flips</a> &middot; every council where the
      largest party in the running composition changed between
      consecutive cycle years, ranked by composition seat-shift
      &divide; cycle vote-shift. See
      <a href="#flips">council-control flips</a> above for the precise
      definition.
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

  <h2>Sources</h2>
  <p>
    <strong>Election results</strong> &mdash; ingested from the
    <strong>Local Election Handbook</strong> (LEH) for the relevant year,
    published by the House of Commons Library under the Open Parliament
    Licence. Workbooks live in the repo at <code>{sourceLabel}</code>;
    the per-year ETL adapter normalises sheet-name and column-name drift
    across years.
  </p>
  <p>
    <strong>Council composition snapshots</strong> &mdash; annual
    per-council per-party seat counts (used for the running-composition
    block on each council page and the council-control flip definition
    above) come from
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>,
    a hand-maintained register of UK council membership going back to
    1973, published under
    <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="external noopener">CC&nbsp;BY-SA&nbsp;4.0</a>.
    Snapshot file (<code>docs/history2016-2025.csv</code>) is committed
    in the repo; refresh by re-downloading from oncd. Slug aliases for
    the small number of councils that LEH and oncd name slightly
    differently (Bristol, County Durham, King's Lynn and West Norfolk,
    Kingston upon Hull) are explicit in
    <code>scripts/etl.mjs</code>; the ETL prints any unmatched councils
    on each run.
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
  <p>
    For the 2026-05-07 cycle, the eventual Commons Library Local Election
    Handbook for that year will be the canonical source.
  </p>

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
    <li>An in-page SQL console (<em>datasette-lite</em>) — deferred.</li>
    <li>DuckDB-WASM widgets for live-querying tables in the browser
      — deferred.</li>
    <li>The full system-anomalies lens beyond
      <a href="/below-quota">/below-quota</a> and <a href="/flips">/flips</a>
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
  <p>
    No errata recorded yet. When a methodological correction is required, an
    entry will be published here with a date, a one-paragraph explanation,
    the diff (what number changed, by how much), and the affected pages.
  </p>
</main>

<style>
  .lede { font-size: 1.1rem; }
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
