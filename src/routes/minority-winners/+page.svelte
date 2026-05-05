<script lang="ts">
  import { pct, num } from '$lib/format';
  let { data } = $props();

  let partyFilter = $state('');
  let councilFilter = $state('');
  let search = $state('');

  const filtered = $derived(
    data.rows.filter((r) => {
      if (partyFilter && r.marginalPartyAbbrev !== partyFilter) return false;
      if (councilFilter && r.councilSlug !== councilFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.wardName.toLowerCase().includes(q) &&
          !r.council.toLowerCase().includes(q) &&
          !r.marginalCandidate.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    })
  );
</script>

<svelte:head>
  <title>Minority winners — electionresults.uk</title>
  <meta
    name="description"
    content="Every council ward where the elected councillor won less than half of the valid ballots cast. Sorted by winning share, ascending."
  />
  <link rel="canonical" href="https://electionresults.uk/minority-winners" />
</svelte:head>

<main class="wide">
  <h1>Minority winners</h1>
  <p>
    Every ward in the cycle where the elected councillor (or, in multi-member
    wards, the most-marginal of the elected councillors) won less than half of
    the valid ballots cast in their ward. {num(data.rows.length)}
    races qualify.
  </p>
  <p class="muted">
    Sorted by winning share, ascending — the thinnest mandate first. Tiebreak:
    fewer absolute votes first. Filter or search below.
  </p>

  <form class="filters" onsubmit={(e) => e.preventDefault()}>
    <label class="filter">
      Party
      <select bind:value={partyFilter}>
        <option value="">All parties</option>
        {#each data.parties as p (p)}
          <option value={p}>{p}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      Council
      <select bind:value={councilFilter}>
        <option value="">All councils</option>
        {#each data.councils as c (c.slug)}
          <option value={c.slug}>{c.council}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      Search ward, council or candidate
      <input type="search" bind:value={search} placeholder="e.g. Lambeth" />
    </label>
  </form>

  <p class="muted">{num(filtered.length)} of {num(data.rows.length)} shown.</p>

  {#if filtered.length === 0}
    <p>No races match the current filters. Try clearing them.</p>
  {/if}

  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Ward / Council</th>
        <th>Most-marginal seat-holder (party)</th>
        <th class="num">Seats</th>
        <th class="num">Votes</th>
        <th class="num">Share</th>
      </tr>
    </thead>
    <tbody>
      {#each filtered as r, i (r.councilSlug + r.wardSlug)}
        <tr>
          <td class="num">{i + 1}</td>
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
            <span class="muted">{r.marginalPartyAbbrev ?? r.marginalParty}</span>
          </td>
          <td class="num">{r.seats}</td>
          <td class="num">{num(r.marginalVotes)}</td>
          <td class="num pct minority">{pct(r.winningPct)}</td>
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
</style>
