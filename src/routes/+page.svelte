<script lang="ts">
  import { pct, num } from '$lib/format';
  let { data } = $props();
</script>

<svelte:head>
  <title>electionresults.uk — auditing how First-Past-the-Post elects UK councillors</title>
  <meta
    name="description"
    content="A volunteer audit of UK local-election results. We surface every council ward where a councillor was elected without majority support — evidence of how First-Past-the-Post distorts representation, ward by ward."
  />
  <link rel="canonical" href="https://electionresults.uk/" />
</svelte:head>

<div class="banner">
  Pre-launch preview · showing the <strong>{data.electionDateLabel}</strong>
  English local-elections cohort as a dev fixture. The 2026-05-07 results
  will populate this site as Democracy Club data lands.
</div>

<main>
  <h1>How many of your councillors were elected on a minority of votes?</h1>

  <p class="lede">
    First-Past-the-Post lets a candidate win with the largest single vote share
    — even when most voters chose someone else. This site audits every council
    ward in the cycle and surfaces the ones where the winner had less than
    majority support. Across the
    <strong>{num(data.totals.races)}</strong> races we have so far, in
    <strong>{num(data.councilCount)}</strong> councils,
    <strong>{num(data.totals.minoritySeats)}</strong> of
    <strong>{num(data.totals.seats)}</strong> seats
    ({pct(data.totals.minoritySeats / Math.max(1, data.totals.seats))})
    were won without majority support.
  </p>

  <p>
    Scotland's councils elect their councillors by the
    <a href="https://stv.vote" rel="external noopener">Single Transferable Vote</a>.
    Scottish councils <em>do not</em> produce ward results like the ones below.
    The results below are not unusual; they are how this voting method works.
    See <a href="/methodology">the methodology page</a> for how every number is
    computed and how to verify it yourself.
  </p>

  <h2>Ten seats elected on the smallest mandates</h2>
  <p class="muted">
    Ten seats this cycle where First-Past-the-Post elected a councillor on
    the smallest share of valid ballots cast in their ward. The named
    councillors appear because the public election record names them; the
    cause being audited is the voting method, not the individuals.
  </p>

  <table aria-label="Ten seats elected on the smallest share of valid ballots">
    <thead>
      <tr>
        <th>Ward / Council</th>
        <th>Seat-holder (party, per public record)</th>
        <th class="num">Votes</th>
        <th class="num">Share</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topMinority as m (m.councilSlug + m.candidateName + m.wardName)}
        <tr>
          <td>
            <a href={`/${m.councilSlug}#${m.wardSlug}`}>
              <strong>{m.wardName}</strong>
            </a>
            <br />
            <span class="muted">{m.council}</span>
          </td>
          <td>
            {m.candidateName}
            <br />
            <span class="muted">{m.partyAbbrev ?? m.party}</span>
          </td>
          <td class="num">{num(m.votes)}</td>
          <td class="num pct minority">{pct(m.winningPct)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p>
    See the <a href="/minority-winners">full leaderboard</a>, or browse
    <a href="#councils">all {data.councilCount} councils</a> below.
  </p>

  <h2 id="councils">All councils in the cycle</h2>
  <p class="muted">
    Each link goes to that council's full ward-by-ward results.
  </p>
  <ul class="council-list">
    {#each data.councils as c (c.councilSlug)}
      <li>
        <a href={`/${c.councilSlug}`}>{c.council}</a>
        <span class="muted">
          · {c.raceCount} races · {pct(c.minorityShare)} of seats won on a
          minority
        </span>
      </li>
    {/each}
  </ul>
</main>

<style>
  .lede {
    font-size: 1.15rem;
  }
  .council-list {
    columns: 18rem 2;
    gap: 1.5rem;
    padding-left: 1.2rem;
    margin-top: 1rem;
    font-size: 0.95rem;
  }
  .council-list li {
    margin-bottom: 0.35rem;
    break-inside: avoid;
  }
</style>
