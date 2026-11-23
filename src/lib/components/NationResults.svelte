<script lang="ts">
  import type { nationResults } from '$lib/server/nation-results';
  import Party from './Party.svelte';
  import CouncilHexMap from './CouncilHexMap.svelte';
  import { num } from '$lib/format';
  let { data }: { data: ReturnType<typeof nationResults> } = $props();
  const scotland = $derived(data.nation === 'scotland' || data.nation === 'northern-ireland');
  const fills = $derived(Object.fromEntries(data.councils.map(c => [c.mapSlug, {
    color: '#0b3d2e', href: `/councils/${c.slug}/${data.year}`,
    title: data.stv
      ? `${c.name}: ${c.wards} ${data.stv.areaLabel}, ${c.seats} of ${c.seatsAvailable} seats filled`
      : `${c.name}: ${c.wards} wards covered, ${c.seats} recorded winners`
  }])));
</script>
<svelte:head>
  <title>{data.name} council results {data.year} | electionresults.uk</title>
  <meta name="description" content={`${data.name} council election results for ${data.year}: recorded winners, votes and data coverage.`} />
  <link rel="canonical" href={`https://electionresults.uk/councils/${data.nation}/${data.year}`} />
</svelte:head>
<main>
  <h1>{data.name} council results {data.year}</h1>
  <nav aria-label="Election year">{#each data.years as year}<a href={`/councils/${data.nation}/${year}`} aria-current={year === data.year ? 'page' : undefined}>{year}</a>{' '}{/each}</nav>
  <p><a href={`/councils/${data.year}`}>All council results for {data.year} →</a></p>
  <p>{#if data.dates.length}{data.dates.join(', ')} · {/if} {scotland ? 'Single Transferable Vote (STV)' : 'First-past-the-post and plurality block voting'}</p>
  {#if data.stv}
    <p><strong>{data.councils.length} councils · {num(data.stv.contests)} {data.stv.areaLabel} · {num(data.stv.seatsFilled)} of {num(data.stv.seats)} seats filled</strong></p>
  {:else}
    <p><strong>{data.councils.length} councils · {num(data.wards)} ward records · {num(data.seats)} recorded winners</strong></p>
  {/if}
  {#if data.wards === 0}
    <p>No council results for {data.name} in {data.year} are included in this dataset. This does not establish that no elections took place. {#if data.years.length}Choose an available year above.{/if}</p>
  {:else if data.stv}
    <p>This covers {num(data.stv.contests)} {data.stv.areaLabel} in {data.councils.length} councils{#if data.nation === 'scotland' && data.councils.length === 32} — every ward in all 32 Scottish councils{/if}.
      {num(data.stv.contested)} went to a poll.
      {#if data.stv.noPoll}{num(data.stv.noPoll)} had no more candidates than seats, so their candidates were returned unopposed; they have no vote totals, which is different from zero votes.{/if}
      {#if data.stv.vacancies}{num(data.stv.vacancies)} {data.stv.vacancies === 1 ? 'seat was' : 'seats were'} left vacant because too few candidates stood.{/if}</p>
    {#if data.nation === 'northern-ireland' && data.stv.contests < 80}
      <p>Northern Ireland has 11 councils and 80 District Electoral Areas. This release includes {data.stv.contests} areas; the remaining count sheets are still being reconciled.</p>
    {/if}
    <p>Votes below are first preferences. Under STV, candidates can be elected on transfers, so first-preference rank does not determine the winners. Winners are the officially declared ones.</p>
  {:else if scotland}
    <p>Votes below are first preferences. Candidates can be elected after transfers, so first-preference rank does not determine the winners.</p>
  {:else}
    <p>Coverage includes records from {data.councils.length} {data.name === 'Wales' ? 'Welsh' : 'English'} councils, but is not a complete register of every seat.
      Uncontested wards and vacancies still need reconciliation.</p>
    <p>Votes below are candidate votes. In multi-member wards one voter could support several candidates;
      these totals do not count individual voters and are not comparable to Scottish first-preference totals.</p>
  {/if}
  {#if data.wards > 0}
  <h2>Recorded votes and seats</h2>
  <table>
    <thead><tr><th>Party / independents</th><th class="num">{scotland ? 'First preferences' : 'Candidate votes'}</th><th class="num">{data.stv ? 'Seats' : 'Recorded seats'}</th></tr></thead>
    <tbody>{#each data.parties as p (p.party)}<tr><td><Party name={p.party} /></td><td class="num">{num(p.votes)}</td><td class="num">{num(p.seats)}</td></tr>{/each}</tbody>
  </table>
  {#if data.stv}
    <p class="muted">Seats include candidates returned unopposed. Independents are grouped for display; they are separate candidates.</p>
  {:else}
    <p class="muted">Totals cover the records above, not all seats nationally. Independents are grouped for display; they are separate candidates.</p>
  {/if}
  <h2>Find a council</h2>
  <CouncilHexMap {fills} title={`${data.name} ${data.year}: councils with results in this extract`} />
  <p class="muted">Green means records are available, not necessarily complete. Grey means no records in this selection. Each hex represents one council.</p>
  {#if data.stv}
    <ul>{#each data.councils as c (c.slug)}<li><a href={`/councils/${c.slug}/${data.year}`}>{c.name}</a> · {c.wards} {data.stv.areaLabel}{#if c.noPoll} ({c.noPoll} uncontested){/if} · {c.seats} of {c.seatsAvailable} seats filled</li>{/each}</ul>
  {:else}
    <ul>{#each data.councils as c (c.slug)}<li><a href={`/councils/${c.slug}/${data.year}`}>{c.name}</a> · {c.wards} wards · {c.seats} recorded winners</li>{/each}</ul>
  {/if}
  {/if}
  <h2>Sources</h2>
  {#if data.stv}
    <ul>{#each data.stv.sources as src}<li><a href={src.url}>{src.label}</a>. {src.licence}.</li>{/each}</ul>
    {#if data.nation === 'scotland'}
      <p>Votes and elected flags are reconciled against the Electoral Management Board for Scotland’s council declaration returns. This corrects one first preference in Ayr North and restores John McColl’s 43 votes in Fraserburgh and District, omitted from the compiled extract. The council-published preference profiles provide an independent first-preference check; no count is simulated.</p>
    {/if}
    {#if data.nation === 'northern-ireland'}
      <p>Official count stages are shown on each council page as published by the Electoral Office for Northern Ireland (EONI). Where a published stage is incomplete or its totals do not add up, we show the figures as published and say so; we do not reconstruct missing transfers. No ballot-level preference data has been published for Northern Ireland.</p>
    {/if}
  {:else if data.nation === 'northern-ireland'}
    <p>Northern Ireland councils use Single Transferable Vote (STV). Results have not yet been imported. <a href="https://www.eoni.org.uk/results-data/local-council-elections-2023-results/">Official 2023 council results — Electoral Office for Northern Ireland</a>.</p>
  {:else if scotland}
    <p>Results compiled by <a href="https://election.indylive.radio/">Gerry Mulvenna / IndyLive</a>, including Democracy Club candidate data, under CC BY-SA 4.0. Original results are published by council Returning Officers.</p>
  {:else if data.nation === 'wales' && data.year === 2022}
    <p><a href="https://commonslibrary.parliament.uk/data/parliament-elections-data/2022-local-elections-handbook-and-dataset/">House of Commons Library, Local Elections Handbook 2022</a>. Contains Parliamentary information licensed under the Open Parliament Licence v3.0.</p>
  {:else}
    <p>Results from the House of Commons Library, Andrew Teale’s Local Elections Archive Project and Democracy Club, depending on year. <a href="/councils/data">Source details and licences</a>.</p>
  {/if}
  <p><a href="/councils/data">Download data</a> · <a href="/councils/methodology">Methodology</a></p>
</main>
