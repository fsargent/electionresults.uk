<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyLookup } from '$lib/holyrood/data-display';
  import HrParty from '$lib/holyrood/components/HrParty.svelte';
  import SourcesNote from '$lib/holyrood/components/SourcesNote.svelte';
  import Discrepancies from '$lib/holyrood/components/Discrepancies.svelte';
  let { data } = $props();
  const c = $derived(data.constituency);
  const party = $derived(partyLookup(data.parties));
</script>
<svelte:head>
  <title>{c.name}: Scottish Parliament {data.year} | electionresults.uk</title>
  <meta name="description" content={`${c.name} constituency result: candidates, votes, turnout and the regional ballot in ${data.year}.`} />
  <link rel="canonical" href={`https://electionresults.uk/holyrood/${data.year}/constituency/${c.slug}`} />
</svelte:head>
<main class="wide">
  <p><a href={`/holyrood/${data.year}`}>Scottish Parliament {data.year}</a> · <a href={`/holyrood/${data.year}/region/${data.region.slug}`}>{data.region.name}</a></p>
  <h1>{c.name}</h1>
  <p>Recorded constituency result · 7 May {data.year}</p>
  <p><strong>{c.winner.name}</strong> elected by first past the post, with a majority of {num(c.majority)} votes.
    One Member of the Scottish Parliament (MSP) is elected here.</p>
  <p>{num(c.validVotes)} valid votes; {num(c.rejected)} rejected ballots.
    Turnout: {pct(c.turnout)} of {num(c.electorate)} registered voters, including rejected ballots.</p>
  <table><caption>Constituency ballot</caption><thead><tr><th>Candidate</th><th>Party</th><th class="num">Votes</th><th class="num">Share</th><th>Outcome</th></tr></thead>
    <tbody>{#each c.candidates as candidate}<tr><td>{candidate.name}</td><td><HrParty party={party(candidate.partyId)} /></td><td class="num">{num(candidate.votes)}</td><td class="num">{pct(candidate.share)}</td><td>{candidate.elected ? 'Elected' : 'Not elected'}</td></tr>{/each}</tbody>
  </table>
  <p>Shares use valid constituency votes. New boundaries were first used in 2026; no prior-election swing is calculated.</p>
  {#if c.regionalVote}
    <h2>The separate regional ballot counted here</h2>
    <p>These votes contribute to the <a href={`/holyrood/${data.year}/region/${data.region.slug}`}>{data.region.name} regional allocation</a>.
      They do not elect another constituency member. This breakdown is from the Scottish Parliament Information Centre (SPICe).</p>
    {#if !data.region.reconciles}<p class="muted">The SPICe constituency breakdown does not fully reconcile with the official regional totals. The regional allocation uses the Electoral Management Board for Scotland totals. See the region’s source differences.</p>{/if}
    <table><caption>Regional votes counted in {c.name}</caption><thead><tr><th>Party or individual</th><th class="num">Votes</th><th class="num">Share</th></tr></thead>
      <tbody>{#each c.regionalVote.parties as row (row.partyId)}<tr><td><HrParty party={party(row.partyId)} /></td><td class="num">{num(row.votes)}</td><td class="num">{pct(row.share)}</td></tr>{/each}</tbody>
    </table>
  {/if}
  <Discrepancies rows={data.discrepancies} />
  <SourcesNote election={data.sourcesElection} />
</main>
