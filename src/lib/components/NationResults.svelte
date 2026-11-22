<script lang="ts">
  import type { nationResults } from '$lib/server/nation-results';
  import Party from './Party.svelte';
  import CouncilHexMap from './CouncilHexMap.svelte';
  import { num } from '$lib/format';
  let { data }: { data: ReturnType<typeof nationResults> } = $props();
  const scotland = $derived(data.nation === 'scotland');
  const fills = $derived(Object.fromEntries(data.councils.map(c => [c.mapSlug, {
    color: '#0b3d2e', href: `/councils/${c.slug}/${data.year}`,
    title: `${c.name}: ${c.wards} wards covered, ${c.seats} recorded winners`
  }])));
</script>
<svelte:head>
  <title>{data.name} council results {data.year} | electionresults.uk</title>
  <meta name="description" content={`${data.name} council election results for 2022: recorded winners, votes and data coverage.`} />
  <link rel="canonical" href={`https://electionresults.uk/councils/${data.nation}/${data.year}`} />
</svelte:head>
<main>
  <h1>{data.name} council results {data.year}</h1>
  <p>5 May 2022 · {scotland ? 'Single Transferable Vote (STV)' : 'First-past-the-post and plurality block voting'}</p>
  <p><strong>{data.councils.length} councils · {num(data.wards)} ward records · {num(data.seats)} recorded winners</strong></p>
  {#if scotland}
    <p>This release covers {data.wards} wards in {data.councils.length} of Scotland’s 32 councils. Orkney, Shetland,
      Comhairle nan Eilean Siar and North Ayrshire are missing from this extract.
      Missing and uncontested wards are not zero-vote results. Full results and count stages are being reconciled.</p>
    <p>Votes below are first preferences. Candidates can be elected after transfers, so first-preference rank does not determine the winners.</p>
  {:else}
    <p>Coverage includes records from all 22 Welsh councils, but is not a complete register of every seat.
      Uncontested wards and vacancies still need reconciliation.</p>
    <p>Votes below are candidate votes. In multi-member wards one voter could support several candidates;
      these totals do not count individual voters and are not comparable to Scottish first-preference totals.</p>
  {/if}
  <h2>Recorded votes and seats</h2>
  <table>
    <thead><tr><th>Party / independents</th><th class="num">{scotland ? 'First preferences' : 'Candidate votes'}</th><th class="num">Recorded seats</th></tr></thead>
    <tbody>{#each data.parties as p (p.party)}<tr><td><Party name={p.party} /></td><td class="num">{num(p.votes)}</td><td class="num">{num(p.seats)}</td></tr>{/each}</tbody>
  </table>
  <p class="muted">Totals cover the records above, not all seats nationally. Independents are grouped for display; they are separate candidates.</p>
  <h2>Find a council</h2>
  <CouncilHexMap {fills} title={`${data.name} 2022: councils with results in this extract`} />
  <p class="muted">Green means records are available, not necessarily complete. Grey means no records in this selection. Each hex represents one council.</p>
  <ul>{#each data.councils as c (c.slug)}<li><a href={`/councils/${c.slug}/${data.year}`}>{c.name}</a> · {c.wards} wards · {c.seats} recorded winners</li>{/each}</ul>
  <h2>Sources</h2>
  {#if scotland}
    <p>Results compiled by <a href="https://election.indylive.radio/">Gerry Mulvenna / IndyLive</a>, including Democracy Club candidate data, under CC BY-SA 4.0. Original results are published by council Returning Officers.</p>
  {:else}
    <p><a href="https://commonslibrary.parliament.uk/data/parliament-elections-data/2022-local-elections-handbook-and-dataset/">House of Commons Library, Local Elections Handbook 2022</a>. Contains Parliamentary information licensed under the Open Parliament Licence v3.0.</p>
  {/if}
  <p><a href="/councils/data">Download data</a> · <a href="/councils/methodology">Methodology</a></p>
</main>
