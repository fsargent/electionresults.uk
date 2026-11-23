<script lang="ts">let {data}=$props();</script>
<svelte:head><title>Election results by year | electionresults.uk</title><meta name="description" content="Browse available council and parliamentary election results by year, with voting systems and source coverage." /><link rel="canonical" href="https://electionresults.uk/elections" /></svelte:head>
<main>
  <h1>Election results by year</h1>
  <p>Councils, Westminster and devolved parliaments, with each election's voting system and coverage kept separate. This is an index of results in our dataset, not a complete record of every UK election.</p>
  {#each data.years as group}
    <section><h2><a href={`/elections/${group.year}`}>{group.year}</a></h2>
      <ul>{#each group.elections as e}<li><a href={e.href}>{e.name}</a> · {e.seats.toLocaleString('en-GB')} recorded seats</li>{/each}</ul>
    </section>
  {/each}
  <p><a href="/councils/by-elections">Council by-elections</a> · <a href="/">Council audit</a></p>
</main>
