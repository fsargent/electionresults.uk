<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import Frac from '$lib/components/Frac.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>electionresults.uk — auditing how UK councils elect on under-quota support</title>
  <meta
    name="description"
    content="A volunteer audit of UK local-election results across five cycles (2021-2025). Each ward is compared to the proportional quota — the share that would be needed to win one seat under any proportional method."
  />
  <link rel="canonical" href="https://electionresults.uk/" />
</svelte:head>

<div class="banner">
  Pre-launch preview · five English local-election cycles ingested
  (2021–2025). The 2026-05-07 results will appear as Democracy Club data
  lands.
</div>

<main class="wide">
  <h1>How many UK councillors won with less support than a fair count would require?</h1>

  <p class="lede">
    First-Past-the-Post and bloc vote let a candidate win on whatever
    share the vote-splitting produces &mdash; there is no minimum
    threshold. We compare every elected councillor's share of valid
    ballots to the <strong>proportional quota</strong>: the share that
    would be needed to be guaranteed that seat under any proportional
    voting method (<Frac num="1" denom="seats + 1" />). Across five
    cycles &mdash; <strong>{num(data.totals.councils)}</strong>
    council&times;cycle pairs, <strong>{num(data.totals.races)}</strong>
    ward races, <strong>{num(data.totals.seats)}</strong> seats elected
    &mdash; <strong>{num(data.totals.belowQuotaSeats)}</strong>
    ({pct(data.totals.belowQuotaSeats / Math.max(1, data.totals.seats))})
    were elected on less.
  </p>

  <h2>Pick an election cycle</h2>
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

  <h2>Ten worst seats across all cycles</h2>
  <p class="muted">
    The seats furthest below the proportional quota anywhere in the data.
    Click a ward to jump to its race in context.
  </p>

  <table aria-label="Ten worst seats across all cycles">
    <thead>
      <tr>
        <th>Year</th>
        <th>Ward / Council</th>
        <th>Seat-holder (party, per public record)</th>
        <th class="num">Seats</th>
        <th class="num">Won at</th>
        <th class="num">Quota</th>
        <th class="num">Under par</th>
      </tr>
    </thead>
    <tbody>
      {#each data.topUnderPar as r (r.year + r.councilSlug + r.wardSlug)}
        <tr>
          <td><a href={`/${r.year}`}>{r.year}</a></td>
          <td>
            <a href={`/${r.year}/${r.councilSlug}#${r.wardSlug}`}>
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

  <section class="frame">
    <h2>Why isn't my council in a particular cycle?</h2>
    <p>
      English local government runs on staggered cycles. Most councils
      elect <em>by thirds</em> (a third of seats every year), some
      elect <em>by halves</em>, and others hold all-out elections every
      four years. London Boroughs all polled in May 2022 and will next
      poll in May 2026; the May 2025 cycle was unitaries, counties, and
      a handful of districts. So Westminster, Lambeth and the other
      London Boroughs only appear in the 2022 cycle in this preview.
    </p>
  </section>
</main>

<style>
  .lede {
    font-size: 1.15rem;
  }
  /* Wider main for the worst-seats table; constrain prose blocks for
     readability rather than letting them stretch the full 96ch. */
  h1,
  .lede,
  .frame {
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
</style>
