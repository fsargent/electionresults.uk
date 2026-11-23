<script lang="ts">
  import {num,pct} from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import {assemblyPartyName} from '$lib/assembly/parties';
  let {data}=$props();
  const contest=$derived(data.contest);
  function value(n:number) { return n.toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:2}); }
</script>
<svelte:head>
  <title>{contest.name} — Assembly 2022 | electionresults.uk</title>
  <meta name="description" content={`${contest.name}: recorded winners, first preferences and count stages in the 2022 Northern Ireland Assembly election.`} />
  <link rel="canonical" href={`https://electionresults.uk/assembly/2022/${contest.slug}`} />
</svelte:head>
<main class="wide">
  <p><a href="/assembly/2022">← Northern Ireland Assembly 2022</a></p>
  <h1>{contest.name}</h1>
  <p>5 May 2022 · Single Transferable Vote (STV) · {contest.seats} seats</p>
  <p>{num(contest.validBallots)} valid ballots · {num(contest.rejectedBallots)} rejected · {pct(contest.turnout)} turnout · quota {num(contest.quota)}</p>
  <table><thead><tr><th>Candidate</th><th>Party</th><th class="num">First preferences</th><th class="num">Share</th><th>Result</th></tr></thead>
    <tbody>{#each contest.candidates as c}<tr><td>{c.name}</td><td><Party name={assemblyPartyName(c.party)} /></td><td class="num">{num(c.firstPreferences)}</td><td class="num">{pct(c.firstPreferences/contest.validBallots)}</td><td>{c.elected?'Elected':'Not elected'}</td></tr>{/each}</tbody>
  </table>
  <details>
    <summary>How the recorded count unfolded</summary>
    <p>Published candidate totals and non-transferable vote value at each stage. Values can be fractional. A candidate can be returned without reaching quota when only enough candidates remain.</p>
    {#if contest.notes.length}<p><strong>Source reconciliation:</strong> some published stages are incomplete. Their original values are retained below; they have not been recalculated.</p><ul>{#each contest.notes as note}<li>{note}</li>{/each}</ul>{/if}
    {#each contest.stages as stage}
      <h3>Stage {stage.number}: {stage.action}</h3>
      {#if !stage.reconciled}<p>These published values account for {value(stage.accounted)} of {num(contest.validBallots)} valid ballots. This stage is incomplete or inconsistent in the source workbook.</p>{/if}
      <table><thead><tr><th>Candidate</th><th class="num">Vote value</th></tr></thead><tbody>{#each stage.candidates as c}<tr><td>{c.name}</td><td class="num">{value(c.value)}</td></tr>{/each}<tr><td>Non-transferable value</td><td class="num">{value(stage.nonTransferable)}</td></tr></tbody></table>
    {/each}
  </details>
  <h2>Source</h2>
  <p><a href={contest.source.url}>Original EONI result workbook</a> (Crown copyright). Names and original party descriptions are preserved in the downloadable source. Results use its elected marker or explicit election-order number, not first-preference rank.</p>
  <p class="muted">No individual ballot rankings are supplied, so these count totals cannot establish complete pairwise preferences or results under other voting systems.</p>
</main>
