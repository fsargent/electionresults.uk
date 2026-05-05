<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.cycle.electionDateLabel} — UK local elections | electionresults.uk</title>
  <meta
    name="description"
    content={`The ${data.cycle.electionDateLabel} English local-elections cohort: ${data.cycle.councilCount} councils, ${data.cycle.raceCount} ward races, ${data.cycle.belowQuotaSeatCount} of ${data.cycle.seatCount} seats elected below the proportional quota.`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/${data.cycle.year}`}
  />
</svelte:head>

<main>
  <p class="muted"><a href="/">← All cycles</a></p>

  <h1>{data.cycle.electionDateLabel} cohort</h1>

  <div class="summary">
    <div class="kpi">
      <span class="figure">{num(data.cycle.councilCount)}</span>
      <span class="label">councils polled</span>
    </div>
    <div class="kpi">
      <span class="figure">{num(data.cycle.raceCount)}</span>
      <span class="label">ward races</span>
    </div>
    <div class="kpi">
      <span class="figure">{num(data.cycle.seatCount)}</span>
      <span class="label">seats elected</span>
    </div>
    <div class="kpi">
      <span class="figure warn">{pct(data.cycle.belowQuotaShare)}</span>
      <span class="label">elected below the proportional quota</span>
    </div>
  </div>

  {#if data.topUnderPar.length > 0}
    <h2>Ten seats furthest below the proportional quota in this cycle</h2>
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
              <a href={`/${data.cycle.year}/${r.councilSlug}#${r.wardSlug}`}>
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
  {/if}

  <h2>All councils that polled in {data.cycle.electionDateLabel}</h2>
  <p class="muted">{num(data.councils.length)} councils.</p>
  <ul class="council-list">
    {#each data.councils as c (c.councilSlug)}
      <li>
        <a href={`/${c.year}/${c.councilSlug}`}>{c.council}</a>
        <span class="muted">
          · {c.raceCount} race{c.raceCount === 1 ? '' : 's'}
          · {pct(c.belowQuotaShare)} of seats below quota
        </span>
      </li>
    {/each}
  </ul>
</main>

<style>
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 1.5rem;
  }
  .kpi {
    border: 1px solid var(--rule);
    padding: 0.75rem 0.9rem;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
  }
  .kpi .figure {
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .kpi .figure.warn { color: var(--warn); }
  .kpi .label {
    font-size: 0.85rem;
    color: var(--muted);
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
