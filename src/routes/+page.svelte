<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>electionresults.uk — auditing how UK councils elect on under-quota support</title>
  <meta
    name="description"
    content="A volunteer audit of UK local-election results. Each ward is compared to the proportional quota — the share that would be needed to win one seat under any proportional method. We surface every seat the actual winner took on less."
  />
  <link rel="canonical" href="https://electionresults.uk/" />
</svelte:head>

<div class="banner">
  Pre-launch preview · showing the <strong>{data.electionDateLabel}</strong>
  English local-elections cohort as a dev fixture. The 2026-05-07 results
  will populate this site as Democracy Club data lands.
</div>

<main>
  <h1>How many of your councillors won with less support than a fair count would require?</h1>

  <p class="lede">
    First-Past-the-Post and bloc vote let a candidate win on whatever
    share the vote-splitting produces &mdash; there is no minimum
    threshold. We compare every elected councillor's share of valid
    ballots to the <strong>proportional quota</strong> &mdash; the share
    that would be needed to be guaranteed that seat under any
    proportional voting method
    (1&nbsp;÷&nbsp;(seats&nbsp;+&nbsp;1)). Of the
    <strong>{num(data.totals.seats)}</strong> seats elected across the
    <strong>{num(data.totals.races)}</strong> races in
    <strong>{num(data.councilCount)}</strong> councils,
    <strong>{num(data.totals.belowQuotaSeats)}</strong>
    ({pct(data.totals.belowQuotaSeats / Math.max(1, data.totals.seats))})
    were elected on less.
  </p>

  <p>
    Where seats are allocated in proportion to votes, results like the
    ones below do not occur &mdash; the proportional quota is the floor
    that any common proportional method requires. The figures below are
    not unusual; they are how First-Past-the-Post and bloc vote work.
    See <a href="/methodology">the methodology page</a> for how every
    number is derived and how to verify it yourself.
  </p>

  <h2>Ten seats furthest below the proportional quota</h2>
  <p class="muted">
    Ranked by the gap between the proportional quota and the share each
    elected councillor actually won. The named councillors appear because
    the public election record names them; the cause being audited is the
    voting method, not the individuals.
  </p>

  <table aria-label="Ten seats furthest below the proportional quota">
    <thead>
      <tr>
        <th>Ward / Council</th>
        <th>Seat-holder (party, per public record)</th>
        <th class="num">Seats</th>
        <th class="num">Won at</th>
        <th class="num">Quota</th>
        <th class="num">Under par</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topUnderPar as r (r.councilSlug + r.wardSlug)}
        <tr>
          <td>
            <a href={`/${r.councilSlug}#${r.wardSlug}`}>
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
    See the <a href="/below-quota">full leaderboard of below-quota seats</a>,
    or browse <a href="#councils">all {data.councilCount} councils</a> below.
  </p>

  <section class="frame">
    <h2>Why isn't my council here?</h2>
    <p>
      The fixture above shows only councils that held elections on
      <strong>{data.electionDateLabel}</strong>. English local government
      runs on staggered cycles &mdash; London Boroughs poll every four
      years (last in 2022, next in 2026), other councils elect in halves
      or thirds, and a separate set holds all-out elections each year.
      Westminster, the other London Boroughs, and any council not on the
      1 May 2025 cohort therefore aren't included in this dev preview.
      Multi-cycle ingest (so the 2026 results can be compared against
      each council's prior cycle) is the next chunk of work.
    </p>
  </section>

  <h2 id="councils">All councils in this cohort</h2>
  <p class="muted">
    Each link goes to that council's full ward-by-ward results.
  </p>
  <ul class="council-list">
    {#each data.councils as c (c.councilSlug)}
      <li>
        <a href={`/${c.councilSlug}`}>{c.council}</a>
        <span class="muted">
          · {c.raceCount} race{c.raceCount === 1 ? '' : 's'}
          · {pct(c.belowQuotaShare)} of seats below quota
        </span>
      </li>
    {/each}
  </ul>
</main>

<style>
  .lede {
    font-size: 1.15rem;
  }
  .frame {
    background: rgba(11, 61, 46, 0.05);
    padding: 0.8rem 1.1rem;
    border-left: 3px solid var(--accent);
    font-size: 0.95rem;
    margin: 2rem 0 1rem;
  }
  .frame h2 {
    font-size: 1.05rem;
    margin: 0.2rem 0 0.4rem;
  }
  .warn { color: var(--warn); }
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
