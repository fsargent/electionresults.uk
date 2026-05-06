<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import { partyDisplayName } from '$lib/party-colors';
  let { data } = $props();

  let yearFilter = $state('');
  let fromPartyFilter = $state('');
  let toPartyFilter = $state('');
  let councilFilter = $state('');
  let search = $state('');

  const filtered = $derived(
    data.rows.filter((r) => {
      if (yearFilter && String(r.yearTo) !== yearFilter) return false;
      if (fromPartyFilter && r.fromParty !== fromPartyFilter) return false;
      if (toPartyFilter && r.toParty !== toPartyFilter) return false;
      if (councilFilter && r.councilSlug !== councilFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.council.toLowerCase().includes(q) &&
          !r.fromParty.toLowerCase().includes(q) &&
          !r.toParty.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    })
  );
</script>

<svelte:head>
  <title>Council flips — electionresults.uk</title>
  <meta
    name="description"
    content="Every UK council where the largest party in the running composition changed between consecutive cycle years. Composition data via opencouncildata; ranked by composition seat shift divided by cycle vote shift for the incoming party."
  />
  <link rel="canonical" href="https://electionresults.uk/flips" />
</svelte:head>

<main class="wide">
  <h1>Council flips</h1>
  <p>
    Every council in the dataset where the
    <strong>largest party in the running composition</strong> changed
    between consecutive election cycles. Ranked by
    <strong>composition seat shift ÷ cycle vote shift</strong> for the
    incoming party (with vote shift floored at 1 percentage point so a
    0-shift entry doesn't divide by zero) &mdash; the bigger the change
    of council control, the smaller the change in votes that triggered
    it, the higher the rank. {num(data.rows.length)} flips qualify.
  </p>
  <p class="muted">
    Composition data per
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
    annual snapshots &mdash; reflects the actual seat count after the
    cycle's election plus any by-elections, not just the cycle's
    results. Cycles where one party topped the per-cycle table but the
    council's overall largest party didn't change (e.g. East Lindsey
    2024, where Reform won the seats up but Conservatives still hold ~28
    of 55 council seats) are correctly excluded. See
    <a href="/methodology#flips">methodology</a> for the precise
    definition.
  </p>
  <p class="muted">
    Click a council name for the full per-flip visualisation. Filter or
    search below.
  </p>

  <form class="filters" onsubmit={(e) => e.preventDefault()}>
    <label class="filter">
      Year (to)
      <select bind:value={yearFilter}>
        <option value="">All years</option>
        {#each data.years as y (y)}
          <option value={String(y)}>{y}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      From party
      <select bind:value={fromPartyFilter}>
        <option value="">Any party</option>
        {#each data.parties as p (p)}
          <option value={p}>{partyDisplayName(p)}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      To party
      <select bind:value={toPartyFilter}>
        <option value="">Any party</option>
        {#each data.parties as p (p)}
          <option value={p}>{partyDisplayName(p)}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      Council
      <select bind:value={councilFilter}>
        <option value="">All councils</option>
        {#each data.councils as c (c.councilSlug)}
          <option value={c.councilSlug}>{c.council}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      Search
      <input type="search" bind:value={search} placeholder="e.g. Tamworth" />
    </label>
  </form>

  <p class="muted">{num(filtered.length)} of {num(data.rows.length)} shown.</p>

  {#if filtered.length === 0}
    <p>No flips match the current filters. Try clearing them.</p>
  {/if}

  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Council</th>
        <th>Cycle</th>
        <th>Flip</th>
        <th class="num">Vote shift</th>
        <th class="num">Seat shift</th>
      </tr>
    </thead>
    <tbody>
      {#each filtered as f, i (f.councilSlug + ':' + f.yearFrom + ':' + f.yearTo)}
        <tr>
          <td class="num">{i + 1}</td>
          <td><a href={`/${f.councilSlug}`}><strong>{f.council}</strong></a></td>
          <td class="num">{f.yearFrom} → {f.yearTo}</td>
          <td>
            <Party name={f.fromParty} />
            <span class="muted" aria-hidden="true"> → </span>
            <Party name={f.toParty} />
          </td>
          <td class="num pct">{pts(f.newPartyVoteTo - f.newPartyVoteFrom)}</td>
          <td class="num pct warn">{pts(f.newPartySeatTo - f.newPartySeatFrom)}</td>
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
  .warn { color: var(--warn); }
</style>
