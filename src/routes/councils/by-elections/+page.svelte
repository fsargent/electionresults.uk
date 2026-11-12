<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  let { data } = $props();

  const s = $derived(data.stats);
  const councilPages = $derived(new Set(data.councilsWithPages));

  function dateLabel(iso: string): string {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }
  function dateLabelLong(iso: string): string {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  let nationFilter = $state('');
  let partyFilter = $state('');
  let sortBy = $state<'date' | 'share'>('date');
  let search = $state('');

  const filtered = $derived(
    data.rows
      .filter((r) => {
        if (nationFilter && r.nation !== nationFilter) return false;
        if (partyFilter && r.winnerParty !== partyFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !r.wardName.toLowerCase().includes(q) &&
            !r.council.toLowerCase().includes(q) &&
            !r.winnerName.toLowerCase().includes(q)
          ) return false;
        }
        return true;
      })
      .sort((a, b) =>
        sortBy === 'share'
          ? a.winningPct - b.winningPct
          : b.electionDate.localeCompare(a.electionDate) || a.council.localeCompare(b.council)
      )
  );
</script>

<svelte:head>
  <title>By-elections since {dateLabelLong(data.after)} — electionresults.uk</title>
  <meta
    name="description"
    content={`${s.belowQuota} of ${s.counted} council by-elections in England and Wales since ${dateLabelLong(data.after)} elected a councillor with less than half of the vote.`}
  />
  <link rel="canonical" href="https://electionresults.uk/councils/by-elections" />
  <meta property="og:image" content="https://electionresults.uk/og/flip-map.png" />
  <meta property="og:image:width" content="1016" />
  <meta property="og:image:height" content="841" />
  <meta name="twitter:image" content="https://electionresults.uk/og/flip-map.png" />
</svelte:head>

<main class="wide">
  <h1>By-elections since {dateLabelLong(data.after)}</h1>
  <p class="lede">
    A by-election fills one council seat partway through a term,
    usually after a councillor dies or resigns. In England and Wales
    every by-election uses First Past the Post. The candidate with the
    most votes wins, with or without a majority.
  </p>
  <p>
    Councils have held <strong>{num(s.held)}</strong> by-elections since
    the {dateLabelLong(data.after)} local elections. Of the
    {num(s.counted)} with a declared result,
    <strong>{num(s.belowQuota)}</strong>
    ({pct(s.belowQuota / Math.max(1, s.counted))}) elected a councillor
    with less than half of the vote. For one seat, half the vote is the
    proportional quota &mdash; see the
    <a href="/councils/methodology">methodology</a>.
  </p>
  {#if s.medianTurnout != null}
    <p>
      Median turnout was <strong>{pct(s.medianTurnout, 0)}</strong>.
      {#if s.medianWinnerShareOfElectorate != null}
        In the median by-election, the winner had the votes of
        <strong>{pct(s.medianWinnerShareOfElectorate, 0)}</strong> of
        the people on the electoral roll.
      {/if}
    </p>
  {/if}
  <p class="muted">
    These by-elections are not in the 2026 cycle figures on the rest of
    this site, because they are not part of a council's full election.
    {#if s.stv > 0}
      The {num(s.stv)} Scottish by-elections are also not in these
      figures. Scotland uses the Single Transferable Vote, so a winner
      needs a quota after transfers, and Democracy Club does not
      publish those vote counts.
    {/if}
    {#if s.awaiting > 0}
      {num(s.awaiting)} by-elections are waiting for a declared result.
    {/if}
    Covers by-elections held up to
    {data.lastDate ? dateLabelLong(data.lastDate) : '—'}. Results from
    <a href="https://democracyclub.org.uk" rel="external noopener">Democracy Club</a>.
  </p>

  <h2>Seats won by party</h2>
  <table class="party-wins">
    <thead>
      <tr>
        <th>Party</th>
        <th class="num">Seats won</th>
        <th class="num">With less than half the vote</th>
      </tr>
    </thead>
    <tbody>
      {#each data.partyWins as p (p.party)}
        <tr>
          <td><Party name={p.party} /></td>
          <td class="num">{num(p.wins)}</td>
          <td class="num">{num(p.belowQuota)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h2>Every by-election</h2>
  <form class="filters" onsubmit={(e) => e.preventDefault()}>
    <label class="filter">
      Nation
      <select bind:value={nationFilter}>
        <option value="">England and Wales</option>
        <option value="england">England</option>
        <option value="wales">Wales</option>
      </select>
    </label>
    <label class="filter">
      Winning party
      <select bind:value={partyFilter}>
        <option value="">All parties</option>
        {#each data.parties as p (p)}
          <option value={p}>{p}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      Sort
      <select bind:value={sortBy}>
        <option value="date">Newest first</option>
        <option value="share">Lowest winning share first</option>
      </select>
    </label>
    <label class="filter">
      Search ward, council or winner
      <input type="search" bind:value={search} placeholder="e.g. Swansea" />
    </label>
  </form>

  <p class="muted">
    {num(filtered.length)} of {num(data.rows.length)} shown. Each ward name
    links to the council's published result.
  </p>

  {#if filtered.length === 0}
    <p>No by-elections match the current filters. Try clearing them.</p>
  {/if}

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Ward / Council</th>
        <th>Winner (party)</th>
        <th>Runner-up (party)</th>
        <th class="num">Won at</th>
        <th class="num">
          <Tooltip
            icon
            body="Winner's share of the vote minus the proportional quota (half the vote for one seat). Negative = below."
          >
            Below quota
          </Tooltip>
        </th>
        <th class="num">Turnout</th>
      </tr>
    </thead>
    <tbody>
      {#each filtered as r (r.ballotId)}
        <tr>
          <td class="date">{dateLabel(r.electionDate)}</td>
          <td>
            {#if r.resultsSource}
              <a href={r.resultsSource} rel="external noopener nofollow" title="Council result notice"
                ><strong>{r.wardName}</strong></a
              >
            {:else}
              <strong>{r.wardName}</strong>
            {/if}
            <br />
            {#if councilPages.has(r.councilSlug)}
              <a class="muted" href={`/councils/${r.councilSlug}`}>{r.council}</a>
            {:else}
              <span class="muted">{r.council}</span>
            {/if}
          </td>
          <td>
            {r.winnerName}
            <br />
            <span class="muted"><Party name={r.winnerParty} /></span>
          </td>
          <td>
            {#if r.runnerUpName}
              {r.runnerUpName}
              <br />
              <span class="muted"><Party name={r.runnerUpParty} /></span>
            {:else}
              <span class="muted">—</span>
            {/if}
          </td>
          <td class="num pct" class:warn={r.isBelowQuota}>{pct(r.winningPct)}</td>
          <td class="num pct" class:warn={r.isBelowQuota}>{pts(r.underPar)}</td>
          <td class="num pct">{r.turnout == null ? '—' : pct(r.turnout, 0)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</main>

<style>
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.5rem;
    margin: 1rem 0 0.5rem;
  }
  .party-wins {
    max-width: 36rem;
  }
  .date {
    white-space: nowrap;
  }
  .warn { color: var(--warn); }
</style>
