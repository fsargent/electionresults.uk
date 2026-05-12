<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import MapDistortion from '$lib/components/MapDistortion.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import { partyDisplayName } from '$lib/party-colors';
  let { data } = $props();

  let yearFilter = $state('');
  let partyFilter = $state('');
  let councilFilter = $state('');
  let search = $state('');

  const filtered = $derived(
    data.rows.filter((r) => {
      if (yearFilter && String(r.year) !== yearFilter) return false;
      if (partyFilter && r.mostOver?.party !== partyFilter) return false;
      if (councilFilter && r.councilSlug !== councilFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.council.toLowerCase().includes(q)) return false;
      }
      return true;
    })
  );
</script>

<svelte:head>
  <title>FPTP distortion — electionresults.uk</title>
  <meta
    name="description"
    content="Single-cycle elections ranked by how many seats First-Past-the-Post reallocated vs a proportional (D'Hondt) allocation. The systemic FPTP failure mode, per election, apples-to-apples."
  />
  <link rel="canonical" href="https://electionresults.uk/distortion" />
  <meta property="og:image" content="https://electionresults.uk/og/flip-map.png" />
  <meta property="og:image:width" content="1016" />
  <meta property="og:image:height" content="841" />
  <meta name="twitter:image" content="https://electionresults.uk/og/flip-map.png" />
</svelte:head>

<main class="wide">
  <h1>FPTP distortion, by single election</h1>
  <p>
    For each cycle in the data, we compute how the seats were actually
    allocated under First-Past-the-Post versus how they would have been
    allocated proportionally (using D'Hondt as a proxy for any
    proportional method &mdash; see
    <a href="/methodology">methodology</a>). The
    <strong>seats reallocated</strong> column is the count of seats
    First-Past-the-Post moved from where a proportional system would
    have placed them. {num(data.rows.length)} cycles ranked by raw count
    (more seats moved = bigger story), share as the tiebreak. The higher
    either number, the more First-Past-the-Post distorted the cycle's
    vote into something else.
  </p>
  <p class="muted">
    This is per-cycle, apples-to-apples: it describes a single election
    in isolation, with no by-thirds caveat. For council-control changes
    (the rare event where the largest party of the running composition
    actually flipped), see <a href="/flips">/flips</a>. For per-seat
    distortion (one councillor elected on a tiny share of valid
    ballots), see <a href="/below-quota">/below-quota</a>.
  </p>
  <p class="muted">
    Click a council name for the full per-cycle visualisation including
    the per-party vote share vs seat share viz. Filter or search below.
  </p>

  <MapDistortion entries={data.mapEntries} />

  <form class="filters" onsubmit={(e) => e.preventDefault()}>
    <label class="filter">
      Year
      <select bind:value={yearFilter}>
        <option value="">All years</option>
        {#each data.years as y (y)}
          <option value={String(y)}>{y}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      Most over-represented party
      <select bind:value={partyFilter}>
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
      <input type="search" bind:value={search} placeholder="e.g. Wealden" />
    </label>
  </form>

  <p class="muted">{num(filtered.length)} of {num(data.rows.length)} shown.</p>

  {#if filtered.length === 0}
    <p>No cycles match the current filters. Try clearing them.</p>
  {/if}

  <table>
    <thead>
      <tr>
        <th>Year</th>
        <th>Council</th>
        <th class="num" title="Total seats elected this single cycle.">Seats</th>
        <th class="num">
          <Tooltip
            icon
            body="Number of seats First-Past-the-Post placed differently from a proportional allocation. 0 = perfectly proportional; higher = more distorted."
          >
            Reallocated
          </Tooltip>
        </th>
        <th class="num">
          <Tooltip
            icon
            body="Reallocated / total seats this cycle. The headline distortion measure: how much of the council's representation FPTP moved."
          >
            % of seats
          </Tooltip>
        </th>
        <th>Most over-represented (FPTP gain vs proportional)</th>
      </tr>
    </thead>
    <tbody>
      {#each filtered as r (r.councilSlug + ':' + r.year)}
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
                ({pts(r.mostOver.fptpSeatShare - r.mostOver.voteShare)} gap)
              </span>
            {:else}
              <span class="muted">—</span>
            {/if}
          </td>
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
  .small { font-size: 0.78rem; }
</style>
