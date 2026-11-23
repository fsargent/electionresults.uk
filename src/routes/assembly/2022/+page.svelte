<script lang="ts">
  import { num, pct } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import SeatChart from '$lib/components/SeatChart.svelte';
  import { assemblyPartyName } from '$lib/assembly/parties';
  let { data } = $props();
  const segments = $derived(data.parties.filter(p=>p.seats>0).map(p=>({party:assemblyPartyName(p.party),seats:p.seats})));
</script>
<svelte:head>
  <title>Northern Ireland Assembly election 2022 | electionresults.uk</title>
  <meta name="description" content="Recorded results of the 5 May 2022 Northern Ireland Assembly election: first preferences, 90 elected members and official count stages in all 18 constituencies." />
  <link rel="canonical" href="https://electionresults.uk/assembly/2022" />
</svelte:head>
<main>
  <h1>Northern Ireland Assembly 2022</h1>
  <p>5 May 2022 · Single Transferable Vote (STV) · 18 constituencies · 90 members</p>
  <p>Each constituency elected five members. Voters ranked candidates; later preferences could help elect candidates through transfers. These are the recorded results, not a simulated count.</p>
  <p>{num(data.validBallots)} valid ballots · {num(data.ballotsCast-data.validBallots)} rejected ballots · {pct(data.ballotsCast/data.electorate)} turnout</p>
  <h2>Elected seats and first preferences</h2>
  <SeatChart {segments} minSize={18} />
  <table><thead><tr><th>Party / independents</th><th class="num">First preferences</th><th class="num">Share</th><th class="num">Seats</th></tr></thead>
    <tbody>{#each data.parties as p}<tr><td><Party name={assemblyPartyName(p.party)} /></td><td class="num">{num(p.firstPreferences)}</td><td class="num">{pct(p.firstPreferences/data.validBallots)}</td><td class="num">{p.seats}</td></tr>{/each}</tbody>
  </table>
  <p class="muted">First preferences count each valid ballot once. Seat totals also reflect later preferences. Independents are grouped for display, not a shared party list. These are election-day outcomes, not today's Assembly membership.</p>
  <h2>Constituency results</h2>
  <ul>{#each data.contests as c}<li><a href={`/assembly/2022/${c.slug}`}>{c.name}</a> · {c.seats} seats · {c.candidates} candidates</li>{/each}</ul>
  <h2>Sources</h2>
  <p><a href={data.source}>Official Electoral Office for Northern Ireland workbooks</a> (Crown copyright). <a href="https://www.niassembly.gov.uk/globalassets/documents/raise/publications/2017-2022/2022/2422.pdf">Assembly Research and Information Service report</a> independently reconciles the national votes and seats. Some source stage totals are incomplete; constituency pages identify them.</p>
  <p>The published count sheets do not include individual ballot rankings. Pairwise comparisons and alternative-method simulations cannot be derived from these totals.</p>
</main>
