<script lang="ts">
  import ChamberChart from '$lib/holyrood/components/ChamberChart.svelte';
  import HrParty from '$lib/holyrood/components/HrParty.svelte';
  import type { HolyroodParty } from '$lib/holyrood/types';
  let { data } = $props();
  const party = $derived((id: string) => data.latest.parties.find((p) => p.id === id) as HolyroodParty);
</script>

<svelte:head>
  <title>Scottish Parliament election results | electionresults.uk</title>
  <meta
    name="description"
    content="Scottish Parliament (Holyrood) election results: constituency and regional list votes, every MSP elected, and how the regional list compensates for constituency seats."
  />
  <link rel="canonical" href="https://electionresults.uk/holyrood" />
</svelte:head>

<main class="wide">
  <h1>Scottish Parliament elections</h1>
  <p>
    Holyrood has 129 Members of the Scottish Parliament (MSPs). Each voter has two votes. The constituency vote elects 73 MSPs by first past
    the post. The regional vote elects 56 more, seven in each of eight regions, from party lists. The list
    seats are <em>compensatory</em>: a party that already won constituencies in a region needs more regional
    votes for each extra list seat. This is the Additional Member System.
  </p>

  <h2>{data.latest.year}: the Parliament elected</h2>
  <ChamberChart seats={data.latest.seats} {party} label={`Scottish Parliament ${data.latest.year}: 129 MSPs by party and seat type`} />
  <table>
    <thead><tr><th>Party</th><th class="num">Constituency</th><th class="num">Regional</th><th class="num">Total</th></tr></thead>
    <tbody>
      {#each data.latest.seats as s (s.partyId)}
        <tr><td><HrParty party={party(s.partyId)} /></td><td class="num">{s.constituency}</td><td class="num">{s.regional}</td><td class="num"><strong>{s.total}</strong></td></tr>
      {/each}
    </tbody>
  </table>
  <p><a href={`/holyrood/${data.latest.year}`}><strong>Full {data.latest.year} results →</strong></a></p>

  <h2>Elections covered</h2>
  <table>
    <thead><tr><th>Election</th><th>Date</th><th class="num">MSPs</th><th class="num">Contests</th><th>Coverage</th></tr></thead>
    <tbody>
      {#each data.elections as el (el.id)}
        <tr>
          <td><a href={el.href}>{el.name}</a></td>
          <td>{el.date}</td>
          <td class="num">{el.seats}</td>
          <td class="num">{el.contests}</td>
          <td>{el.coverage}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="muted">Contests count the 73 constituency ballots and the 8 regional ballots separately. Earlier Holyrood elections are not yet imported.</p>
</main>
