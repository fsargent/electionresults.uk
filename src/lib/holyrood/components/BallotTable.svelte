<script lang="ts">
  import { num, pct } from '$lib/format';
  import HrParty from './HrParty.svelte';
  import ShareBar from './ShareBar.svelte';
  import type { BallotSummary, HolyroodParty } from '../types';
  let { ballot, party, label }: { ballot: BallotSummary; party: (id: string) => HolyroodParty; label: string } = $props();
</script>
<h2>{label}</h2>
<p>{num(ballot.validVotes)} valid votes; {num(ballot.rejected)} rejected ballots.
  Turnout: {pct(ballot.turnout)} of {num(ballot.electorate)} registered voters, including rejected ballots.</p>
<ShareBar rows={ballot.parties} {party} label={`${label}: share of valid votes`} />
<table>
  <caption>{label}: votes and seats</caption>
  <thead><tr><th>Party or individual</th><th class="num">Votes</th><th class="num">Share</th><th class="num">Seats</th></tr></thead>
  <tbody>{#each ballot.parties as row (row.partyId)}
    <tr><td><HrParty party={party(row.partyId)} /></td><td class="num">{num(row.votes)}</td><td class="num">{pct(row.share)}</td><td class="num">{row.seats}</td></tr>
  {/each}</tbody>
</table>
