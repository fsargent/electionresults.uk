<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyLookup } from '$lib/holyrood/data-display';
  import HrParty from '$lib/holyrood/components/HrParty.svelte';
  import SourcesNote from '$lib/holyrood/components/SourcesNote.svelte';
  import Discrepancies from '$lib/holyrood/components/Discrepancies.svelte';
  let { data } = $props();
  const r = $derived(data.region);
  const party = $derived(partyLookup(data.parties));
</script>
<svelte:head>
  <title>{r.name}: Scottish Parliament {data.year} | electionresults.uk</title>
  <meta name="description" content={`${r.name} regional votes, seven elected list members and the compensatory D’Hondt allocation for ${data.year}.`} />
  <link rel="canonical" href={`https://electionresults.uk/holyrood/${data.year}/region/${r.slug}`} />
</svelte:head>
<main class="wide">
  <p><a href={`/holyrood/${data.year}`}>Scottish Parliament {data.year}</a></p>
  <h1>{r.name}</h1>
  <p>Recorded regional result · 7 May {data.year}</p>
  <p>Seven regional Members of the Scottish Parliament (MSPs) supplement the {r.constituencySlugs.length} constituency members in this region.
    Under the Additional Member System, constituency seats count towards the divisor used to allocate each party’s regional seats.</p>
  <p>{num(r.validVotes)} valid regional votes; {num(r.rejected)} rejected ballots.
    Turnout: {pct(r.turnout)} of {num(r.electorate)} registered voters, including rejected ballots.</p>
  <table><caption>Regional ballot and seats in the region</caption><thead><tr><th>Party or individual</th><th class="num">Regional votes</th><th class="num">Share</th><th class="num">Constituency seats</th><th class="num">Regional seats</th><th class="num">Total seats</th></tr></thead>
    <tbody>{#each r.parties as row (row.partyId)}<tr><td><HrParty party={party(row.partyId)} /></td><td class="num">{num(row.votes)}</td><td class="num">{pct(row.share)}</td><td class="num">{row.constituencySeats}</td><td class="num">{row.regionalSeats}</td><td class="num">{row.constituencySeats + row.regionalSeats}</td></tr>{/each}</tbody>
  </table>
  <h2>Seven regional members elected</h2>
  <table><thead><tr><th>Allocation round</th><th>Member</th><th>Party</th><th class="num">List position</th></tr></thead>
    <tbody>{#each r.members as m}<tr><td>{m.round}</td><td>{m.name}</td><td><HrParty party={party(m.partyId)} /></td><td class="num">{m.listPosition ?? 'Individual'}</td></tr>{/each}</tbody>
  </table>
  <h2>How the regional seats were allocated</h2>
  <p>These rounds are our reconstruction from recorded votes and constituency winners, checked against the official regional seat totals and the published elected members. They are calculations, not an official count transcript or a simulation.</p>
  <p>A party’s allocation figure is its regional votes divided by (constituency seats in this region + regional seats already allocated + 1).
    The highest figure takes the next seat. An independent’s divisor is one; once elected they are removed.
    A party with no remaining eligible list candidates is removed. Constituency winners are skipped on party lists.</p>
  <p>Figures are displayed to two decimal places; comparisons use unrounded ratios. No highest-figure ties occur in these results.
    A tie would require the statutory adjustment of adding one vote and recalculating, with a possible draw of lots;
    the importer stops for evidence rather than choosing a winner.
    See the <a href="https://www.legislation.gov.uk/ukpga/1998/46/section/7">Scotland Act 1998, section 7</a> and <a href="https://www.legislation.gov.uk/ukpga/1998/46/section/8">section 8</a>.</p>
  {#each r.allocation as round}
    <details><summary>Round {round.round}: {party(round.winner).name} — {round.memberName}</summary>
      <table><caption>Round {round.round}: all eligible allocation figures</caption><thead><tr><th>Party or individual</th><th class="num">Votes</th><th class="num">Constituency seats</th><th class="num">Regional seats before round</th><th class="num">Divisor</th><th class="num">Figure</th></tr></thead>
        <tbody>{#each round.figures as f (f.id)}<tr><td><HrParty party={party(f.id)} />{f.id === round.winner ? ' · Seat allocated' : ''}</td><td class="num">{num(f.votes)}</td><td class="num">{f.constituencySeats}</td><td class="num">{f.listSeatsBefore}</td><td class="num">{f.divisor}</td><td class="num">{f.quotient.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>{/each}</tbody>
      </table>
    </details>
  {/each}
  <h2>Constituency members in this region</h2>
  <table><thead><tr><th>Constituency</th><th>Member</th><th>Party</th></tr></thead>
    <tbody>{#each data.constituencies as c (c.slug)}<tr><td><a href={`/holyrood/${data.year}/constituency/${c.slug}`}>{c.name}</a></td><td>{c.winner.name}</td><td><HrParty party={party(c.winner.partyId)} /></td></tr>{/each}</tbody>
  </table>
  <h2>Party lists</h2>
  <p>Within each party list, candidates retain their published positions. Parties below are ordered by regional votes.</p>
  {#each r.lists as list (list.partyId)}
    <details><summary>{party(list.partyId).name}</summary>
      <table><thead><tr><th class="num">Position</th><th>Candidate</th><th>Outcome</th></tr></thead>
        <tbody>{#each list.candidates as candidate}<tr><td class="num">{candidate.position}</td><td>{candidate.name}</td><td>{#if candidate.outcome === 'constituency'}Elected in {#if candidate.constituencySlug}<a href={`/holyrood/${data.year}/constituency/${candidate.constituencySlug}`}>a constituency</a>{:else}a constituency{/if}; skipped on list{:else if candidate.outcome === 'regional'}Elected from list{:else}Not elected{/if}</td></tr>{/each}</tbody>
      </table>
    </details>
  {/each}
  {#if r.individualCandidates.length}<h3>Individual regional candidates</h3><ul>{#each r.individualCandidates as candidate}<li>{candidate.name}: {num(candidate.votes)} votes</li>{/each}</ul>{/if}
  <Discrepancies rows={data.discrepancies} />
  <SourcesNote election={data.sourcesElection} />
</main>
