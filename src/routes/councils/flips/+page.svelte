<script lang="ts">
  import { num } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import MapFlips from '$lib/components/MapFlips.svelte';
  import { partyColor, partyDisplayName } from '$lib/party-colors';
  import type { CompositionSnapshot } from '$lib/types';
  let { data } = $props();

  // Build a sorted list of {party, seats, color} from a composition
  // snapshot. Prefer the per-councillor breakdown (partiesDetailed)
  // when we have it — every party gets its actual label (Ashfield
  // Independents, Aspire, Independent / Other, etc.). Falls back to
  // (named parties + Other bucket) when no per-councillor snapshot
  // exists. partyColor handles unknown party names via its
  // independents/locals heuristic.
  function compositionRows(c: CompositionSnapshot) {
    if (c.partiesDetailed) {
      return Object.entries(c.partiesDetailed)
        .filter(([, n]) => n > 0)
        .map(([party, seats]) => ({ party, seats, color: partyColor(party) }))
        .sort((a, b) => b.seats - a.seats);
    }
    const rows = Object.entries(c.parties)
      .filter(([, n]) => n > 0)
      .map(([party, seats]) => ({ party, seats, color: partyColor(party) }));
    if (c.otherSeats > 0) {
      rows.push({ party: 'Other', seats: c.otherSeats, color: '#888888' });
    }
    return rows.sort((a, b) => b.seats - a.seats);
  }

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
    content="Every UK council where the largest party in the running composition changed between consecutive cycle years. Composition data via opencouncildata, sorted by recency."
  />
  <link rel="canonical" href="https://electionresults.uk/councils/flips" />
  <meta property="og:image" content="https://electionresults.uk/og/flip-map.png" />
  <meta property="og:image:width" content="1016" />
  <meta property="og:image:height" content="841" />
  <meta name="twitter:image" content="https://electionresults.uk/og/flip-map.png" />
</svelte:head>

<main class="wide">
  <h1>Council-control changes</h1>
  <p>
    Every council in the dataset where the
    <strong>largest party in the running composition actually changed</strong>
    between consecutive election cycles. {num(data.rows.length)} changes
    qualify, most recent first.
  </p>
  <p class="muted">
    Composition data per
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
    annual snapshots &mdash; reflects the actual seat count after the
    cycle's election plus any by-elections, not just the cycle's results.
    Cycles where one party topped the per-cycle table but the council's
    overall largest party didn't change (e.g. East Lindsey 2024, where
    Reform won the seats up but Conservatives still hold ~28 of 55
    council seats) are correctly excluded.
  </p>
  <p class="muted">
    For the FPTP-distortion story &mdash; small vote shifts producing
    big seat reallocations &mdash; see <a href="/councils/distortion">/councils/distortion</a>.
    See <a href="/councils/methodology#flips">methodology</a> for the precise
    definition of a council-control change.
  </p>

  <MapFlips entries={data.mapEntries} />

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
        <th>Cycle</th>
        <th>Council</th>
        <th>Largest party changed</th>
        <th>Composition before</th>
        <th>Composition after</th>
      </tr>
    </thead>
    <tbody>
      {#each filtered as f (f.councilSlug + ':' + f.yearFrom + ':' + f.yearTo)}
        <tr>
          <td class="num">{f.yearFrom} → {f.yearTo}</td>
          <td><a href={`/councils/${f.councilSlug}`}><strong>{f.council}</strong></a></td>
          <td>
            <Party name={f.fromParty} />
            <span class="muted" aria-hidden="true"> → </span>
            <Party name={f.toParty} />
          </td>
          <td class="comp-cell">
            {#if f.compositionFrom}
              <span class="comp-label muted">{f.yearFrom}</span>
              <span class="comp-bar" aria-label={`Composition ${f.yearFrom}: ${f.compositionFrom.totalSeats} seats`}>
                {#each compositionRows(f.compositionFrom) as row (row.party)}
                  <span
                    class="comp-seg"
                    style:flex={row.seats}
                    style:background-color={row.color}
                    title={`${partyDisplayName(row.party)}: ${row.seats} of ${f.compositionFrom.totalSeats} seats`}
                  ></span>
                {/each}
              </span>
            {:else}
              <span class="muted small">—</span>
            {/if}
          </td>
          <td class="comp-cell">
            {#if f.compositionTo}
              <span class="comp-label muted">{f.yearTo}</span>
              <span class="comp-bar" aria-label={`Composition ${f.yearTo}: ${f.compositionTo.totalSeats} seats`}>
                {#each compositionRows(f.compositionTo) as row (row.party)}
                  <span
                    class="comp-seg"
                    style:flex={row.seats}
                    style:background-color={row.color}
                    title={`${partyDisplayName(row.party)}: ${row.seats} of ${f.compositionTo.totalSeats} seats`}
                  ></span>
                {/each}
              </span>
            {:else}
              <span class="muted small">—</span>
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
  .small { font-size: 0.78rem; }
  .comp-cell {
    min-width: 12rem;
  }
  .comp-label {
    display: block;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.2rem;
  }
  .comp-bar {
    display: flex;
    width: 100%;
    height: 0.85rem;
    border: 1px solid var(--rule);
    border-radius: 2px;
    overflow: hidden;
    background: var(--bg);
  }
  .comp-seg {
    display: block;
    height: 100%;
  }
</style>
