<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import MapBelowQuota from '$lib/components/MapBelowQuota.svelte';
  import MapDistortion from '$lib/components/MapDistortion.svelte';
  import MapFlips from '$lib/components/MapFlips.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>electionresults.uk — auditing UK council seats won when most voters chose someone else</title>
  <meta
    name="description"
    content="A volunteer audit of UK local-election results across five cycles (2021–2025). For every ward, we ask: did the winner clear the share of votes a fair, proportional system would require?"
  />
  <link rel="canonical" href="https://electionresults.uk/" />
</svelte:head>

<div class="banner">
  Pre-launch preview · five English local-election cycles loaded
  (2021–2025). The 2026-05-07 results will appear as the source data
  for that cycle is published.
</div>

<main class="wide">
  <h1>How many UK councillors won when most voters chose someone else?</h1>

  <p class="lede">
    The most extreme case in our data: a councillor elected on
    <strong>{pct(data.lowestWinner.winningPct)}</strong> of the vote
    in {data.lowestWinner.wardName} ({data.lowestWinner.council},
    {data.lowestWinner.year}) &mdash; meaning
    <strong>{pct(1 - data.lowestWinner.winningPct)}</strong>
    of people who voted in that ward chose someone else, and they
    still won the seat. Under First-Past-the-Post and bloc vote,
    that's allowed: a candidate wins by being top of the poll,
    regardless of share, with no minimum threshold. We compare every
    elected councillor's share of votes to the share they would need
    under a system where seats match votes.<sup class="fn"><a
      href="/methodology#quota"
      title="See the methodology page for the formula and worked examples"
    >(1)</a></sup> Across five cycles of UK local elections &mdash;
    covering county councils, unitary authorities, metropolitan
    boroughs, district councils and London boroughs &mdash; that's
    <strong>{num(data.totals.councils)}</strong> council-cycles,
    <strong>{num(data.totals.races)}</strong> ward races and
    <strong>{num(data.totals.seats)}</strong> seats. Of those,
    <strong>{num(data.totals.belowQuotaSeats)}</strong>
    ({pct(data.totals.belowQuotaSeats / Math.max(1, data.totals.seats))})
    fell short of that fair share.
  </p>

  <h2>Year-over-year flips</h2>
  <p class="muted">
    Each council where the leading party changed between consecutive cycles,
    coloured by the party that took the lead. Councils that haven't
    flipped (or that we only have one cycle for) stay grey. Hover for
    the cycle and the party transition; click to see the council's full
    history.
  </p>
  <MapFlips entries={data.flipMapEntries} />

  <h3>Ten biggest council-control changes</h3>
  <p class="muted">
    Ranked by composition shift &mdash; the incoming party's gain in
    seat share of the full council. A big shift on a small vote swing
    is the FPTP signature: a few percentage points of vote movement
    can land enough seats to swap which party leads the council. A
    flip = the largest party in the council's running composition
    actually changed between cycles (per
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>'s
    annual snapshot). See <a href="/flips">/flips</a> for the full list.
  </p>
  <table aria-label="Ten biggest council-control changes by composition shift">
    <thead>
      <tr>
        <th>Cycle</th>
        <th>Council</th>
        <th>Largest party changed</th>
        <th class="num" title="Incoming party's seat share of the full council in the year-after minus the year-before — composition truth-set, not per-cycle.">Composition shift (incoming)</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topFlipsByShift as f (f.councilSlug + ':' + f.yearFrom + ':' + f.yearTo)}
        <tr>
          <td class="num">{f.yearFrom} → {f.yearTo}</td>
          <td><a href={`/${f.councilSlug}`}><strong>{f.council}</strong></a></td>
          <td>
            <Party name={f.fromParty} />
            <span class="muted" aria-hidden="true"> → </span>
            <Party name={f.toParty} />
          </td>
          <td class="num pct warn">{pts(f.newPartySeatTo - f.newPartySeatFrom)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h2>FPTP distortion, latest cycle</h2>
  <p class="muted">
    For each cycle in our data, we compute the seats actually allocated
    by First-Past-the-Post and the seats a proportional system (D'Hondt)
    would have allocated from the same vote totals. The map shades every
    UK council by how many of its seats were reallocated by FPTP in its
    most recent cycle (darker = more seats reallocated). The table below
    picks out the ten elections with the largest absolute reallocation.
    See <a href="/distortion">/distortion</a> for the full leaderboard.
  </p>
  <MapDistortion entries={data.distortionMapEntries} />

  <h3>Ten most FPTP-distorted single elections</h3>

  <table aria-label="Ten most FPTP-distorted single elections">
    <thead>
      <tr>
        <th>Year</th>
        <th>Council</th>
        <th class="num">Seats</th>
        <th class="num">Reallocated</th>
        <th class="num">% of seats</th>
        <th>Most over-represented</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topDistortedCycles as r (r.councilSlug + ':' + r.year)}
        <tr>
          <td class="num"><a href={`/${r.year}`}>{r.year}</a></td>
          <td>
            <a href={`/${r.councilSlug}/${r.year}#party-view`}>
              <strong>{r.council}</strong>
            </a>
          </td>
          <td class="num">{r.totalSeats}</td>
          <td class="num warn">{r.reallocated}</td>
          <td class="num pct warn">{pct(r.reallocatedShare)}</td>
          <td>
            {#if r.mostOver}
              <Party name={r.mostOver.party} />
              <span class="muted small">
                · {pct(r.mostOver.voteShare)} of votes →
                {pct(r.mostOver.fptpSeatShare)} of seats
              </span>
            {:else}
              <span class="muted">—</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h2>Distorted elections</h2>
  <p class="muted">
    Councils where seats went to candidates with less support than
    a proportional system would require. The map shades every UK council
    by how many of its seats fell below that bar in its most recent
    cycle (darker = more seats below). The table lists the ten seats
    won on the smallest share of the vote anywhere in the data.
  </p>
  <MapBelowQuota councils={data.latestByCouncil} />

  <h3>Ten seats won on the smallest share of the vote</h3>
  <p class="muted">
    The seats furthest below the proportional quota anywhere in the data
    — councillors elected on the smallest share of votes in their ward.
    Click a ward to see the full race.
  </p>

  <table aria-label="Ten seats won on the smallest share of the vote across all cycles">
    <thead>
      <tr>
        <th>Year</th>
        <th>Ward / Council</th>
        <th>Seat-holder (party, per public record)</th>
        <th class="num">Seats</th>
        <th class="num">Won at</th>
        <th class="num">Quota</th>
        <th
          class="num"
          title="Marginal winner's share minus the proportional quota for this race. Negative = below; positive = above."
        >Below quota</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topLowestShares as r (r.year + r.councilSlug + r.wardSlug)}
        <tr>
          <td><a href={`/${r.year}`}>{r.year}</a></td>
          <td>
            <a href={`/${r.councilSlug}/${r.year}#${r.wardSlug}`}>
              <strong>{r.wardName}</strong>
            </a>
            <br />
            <span class="muted">{r.council}</span>
          </td>
          <td>
            {r.marginalCandidate}
            <br />
            <span class="muted"><Party name={r.marginalParty} /></span>
          </td>
          <td class="num">{r.seats}</td>
          <td class="num pct warn">{pct(r.winningPct)}</td>
          <td class="num pct">{pct(r.quota)}</td>
          <td class="num pct warn">{pts(r.underPar)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p>
    See the <a href="/below-quota">full leaderboard of below-quota seats</a>
    across all cycles.
  </p>

  <h2>All councils</h2>
  <p class="muted">
    {num(data.allCouncils.length)} councils with at least one cycle of
    data. Click a name to see every cycle and any changes in the
    leading party.
  </p>
  <ul class="all-councils">
    {#each data.allCouncils as c (c.councilSlug)}
      <li><a href={`/${c.councilSlug}`}>{c.council}</a></li>
    {/each}
  </ul>

  <h2>Council elections by year</h2>
  <ul class="cycle-list">
    {#each data.cycles as c (c.year)}
      <li>
        <a href={`/${c.year}`} class="cycle">
          <span class="cycle-year">{c.year}</span>
          <span class="cycle-date">{c.electionDateLabel}</span>
          <span class="cycle-stats">
            {num(c.councilCount)} councils · {num(c.raceCount)} races ·
            <span class="warn">{pct(c.belowQuotaShare)} below quota</span>
          </span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  .lede {
    font-size: 1.15rem;
  }
  .fn { font-size: 0.7em; }
  .fn a { text-decoration: none; color: var(--muted); }
  .fn a:hover { text-decoration: underline; color: var(--accent); }
  /* Wider main for the worst-seats table; constrain prose blocks for
     readability rather than letting them stretch the full 96ch. */
  h1,
  .lede {
    max-width: 72ch;
  }
  .cycle-list {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.7rem;
    margin: 1rem 0 2rem;
  }
  .cycle {
    display: grid;
    gap: 0.15rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.1s, background 0.1s;
  }
  .cycle:hover {
    border-color: var(--accent);
    background: rgba(11, 61, 46, 0.04);
  }
  .cycle-year {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--accent);
  }
  .cycle-date {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .cycle-stats {
    font-size: 0.85rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .warn { color: var(--warn); }

  .all-councils {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0 2rem;
    columns: 16rem 4;
    column-gap: 1.5rem;
    font-size: 0.95rem;
  }
  .all-councils li {
    margin-bottom: 0.25rem;
    break-inside: avoid;
  }

  .small { font-size: 0.78rem; }
</style>
