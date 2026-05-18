<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import ConstituencyResultTable from '$lib/parliament/components/ConstituencyResultTable.svelte';
  import BoundaryCaveat from '$lib/parliament/components/BoundaryCaveat.svelte';

  let { data } = $props();

  const winner = $derived(data.contest.candidates.find((c) => c.isWinner) ?? null);
  const runnerUp = $derived(
    data.contest.candidates.find((c) => c.position === 2) ?? null
  );
  const winningShare = $derived(winner?.share ?? null);
  const isMinorityMandate = $derived(
    winningShare != null && winningShare < 0.5
  );
  const hasBoundaryCaveat = $derived(
    data.contest.caveats.includes('boundary-comparability-limited')
  );
  // Pull the boundary identifier out of the composite constituencyId
  // (`${boundarySet}:${slug}`) so the BoundaryCaveat can name the
  // review without needing a separate lookup.
  const boundarySet = $derived(
    data.contest.constituencyId.split(':')[0] || undefined
  );
</script>

<svelte:head>
  <title
    >{data.contest.constituencyName} &mdash; {data.year} UK general election
    &mdash; electionresults.uk</title>
  <meta
    name="description"
    content={`Full candidate result for ${data.contest.constituencyName} in the ${data.year} UK general election. ${winner ? `${winner.partyDisplayName} won with ${winningShare != null ? pct(winningShare, 1) : 'an unreported share'} of valid votes.` : ''}`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/parliament/${data.year}/${data.contest.constituencySlug}`}
  />
</svelte:head>

<main class="wide">
  <p class="muted crumbs">
    <a href="/parliament">UK general elections</a> ›
    <a href={`/parliament/${data.year}`}>{data.year}</a> ›
    {data.contest.constituencyName}
  </p>

  <h1>{data.contest.constituencyName} &mdash; {data.year}</h1>

  {#if winner}
    <p>
      <strong>{winner.candidateName}</strong>
      ({winner.partyDisplayName}) was elected with
      <strong>{num(winner.votes)} votes</strong>{#if winningShare != null}
        &mdash;
        <strong>{pct(winningShare, 1)}</strong> of
        {num(data.contest.validVotes ?? 0)} valid votes{/if}.
      {#if isMinorityMandate}
        Under First Past the Post, a plurality is enough; a majority is
        not required.
      {/if}
    </p>
  {/if}

  {#if hasBoundaryCaveat}
    <BoundaryCaveat {boundarySet} />
  {/if}

  <h2>Result</h2>
  <ConstituencyResultTable
    candidates={data.contest.candidates}
    constituencyName={data.contest.constituencyName}
  />

  <table>
    <tbody>
      <tr>
        <th scope="row">Electorate</th>
        <td class="num">
          {data.contest.electorate != null
            ? num(data.contest.electorate)
            : 'Not reported'}
        </td>
      </tr>
      <tr>
        <th scope="row">Valid votes</th>
        <td class="num">
          {data.contest.validVotes != null
            ? num(data.contest.validVotes)
            : 'Not reported'}
        </td>
      </tr>
      <tr>
        <th scope="row">Turnout</th>
        <td class="num">
          {data.contest.turnout != null
            ? pct(data.contest.turnout, 1)
            : 'Not reported'}
        </td>
      </tr>
      {#if winner && runnerUp && winner.votes != null && runnerUp.votes != null}
        <tr>
          <th scope="row">Majority</th>
          <td class="num">{num(winner.votes - runnerUp.votes)}</td>
        </tr>
      {/if}
      <tr>
        <th scope="row">Contest type</th>
        <td class="num">{data.contest.contestType.replace('-', ' ')}</td>
      </tr>
    </tbody>
  </table>

  {#if data.contest.caveats.length > 0}
    <p class="muted">
      Data caveats on this contest:
      {#each data.contest.caveats as c, i (c)}
        <code>{c}</code>{i < data.contest.caveats.length - 1 ? ', ' : ''}
      {/each}.
      <a href="/parliament/methodology#caveats">What these mean.</a>
    </p>
  {/if}

  <p class="muted">
    Source data:
    <a href={data.manifest.sourceUrl} rel="external noopener"
      >{data.manifest.sourceName}</a>, retrieved
    {data.manifest.retrievalDate}, generated
    {new Date(data.manifest.generatedAt).toISOString().slice(0, 10)}
    ({data.manifest.licence}). ETL version
    <code>{data.manifest.etlVersion}</code>. Methodology:
    <a href="/parliament/methodology">how these numbers are computed</a>.
  </p>
</main>

<style>
  .crumbs {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
  }
</style>
