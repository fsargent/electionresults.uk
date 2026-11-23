<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyLookup } from '$lib/holyrood/data-display';
  import ChamberChart from '$lib/holyrood/components/ChamberChart.svelte';
  import HrParty from '$lib/holyrood/components/HrParty.svelte';
  import BallotTable from '$lib/holyrood/components/BallotTable.svelte';
  import SourcesNote from '$lib/holyrood/components/SourcesNote.svelte';
  import Discrepancies from '$lib/holyrood/components/Discrepancies.svelte';
  let { data } = $props();
  const party = $derived(partyLookup(data.parties));
</script>
<svelte:head>
  <title>Scottish Parliament {data.year} results | electionresults.uk</title>
  <meta name="description" content="All 73 constituency and eight regional results from the 2026 Scottish Parliament election, with regional seat allocation and source records." />
  <link rel="canonical" href={`https://electionresults.uk/holyrood/${data.year}`} />
</svelte:head>
<main class="wide">
  <p><a href="/holyrood">Scottish Parliament elections</a></p>
  <h1>{data.name}</h1>
  <p>7 May {data.year} · Recorded election results</p>
  <p>The Additional Member System elects 129 Members of the Scottish Parliament (MSPs):
    73 constituency members by first past the post and 56 regional members, seven in each of eight regions.
    Voters cast separate constituency and regional votes. The regional allocation compensates for constituency seats already won.</p>
  <p>{data.boundaries} No swing from earlier boundaries is calculated. {data.asElected}</p>
  <h2>The Parliament elected</h2>
  <p>{data.majority} seats are needed for a majority.</p>
  <ChamberChart seats={data.seats} {party} label={`Scottish Parliament ${data.year}: 129 seats by party and seat type`} />
  <table>
    <caption>Seats by party</caption>
    <thead><tr><th>Party</th><th class="num">Constituency</th><th class="num">Regional</th><th class="num">Total</th></tr></thead>
    <tbody>{#each data.seats as row (row.partyId)}<tr><td><HrParty party={party(row.partyId)} /></td><td class="num">{row.constituency}</td><td class="num">{row.regional}</td><td class="num">{row.total}</td></tr>{/each}</tbody>
  </table>
  <BallotTable ballot={data.constituencyVote} {party} label="Constituency vote" />
  <BallotTable ballot={data.regionalVote} {party} label="Regional vote" />
  <p>Each share uses valid votes on that ballot alone. Regional seats are compensatory additions;
    their number alone does not represent a party’s total entitlement. Turnout here includes rejected ballots;
    the Scottish Parliament Information Centre’s published turnout excludes them.</p>
  <h2>Eight regions</h2>
  <p>Open a region to see its votes, elected members, party lists and all seven allocation rounds.</p>
  <table><thead><tr><th>Region</th><th class="num">Constituencies</th><th class="num">Regional turnout</th></tr></thead>
    <tbody>{#each data.regions as r (r.slug)}<tr><td><a href={`/holyrood/${data.year}/region/${r.slug}`}>{r.name}</a></td><td class="num">{r.constituencyCount}</td><td class="num">{pct(r.turnout)}</td></tr>{/each}</tbody>
  </table>
  <h2>73 constituencies</h2>
  <table><thead><tr><th>Constituency</th><th>Elected member</th><th>Party</th><th class="num">Vote share</th><th class="num">Majority</th></tr></thead>
    <tbody>{#each data.constituencies as c (c.slug)}<tr><td><a href={`/holyrood/${data.year}/constituency/${c.slug}`}>{c.name}</a></td><td>{c.winner.name}</td><td><HrParty party={party(c.winner.partyId)} /></td><td class="num">{pct(c.share)}</td><td class="num">{num(c.majority)}</td></tr>{/each}</tbody>
  </table>
  <Discrepancies rows={data.discrepancies} />
  <SourcesNote election={data.sourcesElection} />
</main>
