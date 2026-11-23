<script lang="ts">let {data}=$props();</script>
<svelte:head><title>Election results {data.year} | electionresults.uk</title><meta name="description" content={`Available council and parliamentary election results for ${data.year}, with voting systems and coverage.`} /><link rel="canonical" href={`https://electionresults.uk/elections/${data.year}`} /></svelte:head>
<main>
  <p><a href="/elections">← All years</a></p>
  <h1>Election results {data.year}</h1>
  <nav aria-label="Election year">{#each data.years as year}<a href={`/elections/${year}`} aria-current={year===data.year?'page':undefined}>{year}</a>{' '}{/each}</nav>
  <p>All available council and parliamentary results for this year. An absent election means it is not covered here, not that no election was held.</p>
  {#each data.elections as e}
    <section>
      <h2><a href={e.href}>{e.name}</a></h2>
      <p>{e.nation}{#if e.date} · {e.date}{/if} · {e.system}</p>
      <p><strong>{e.seats.toLocaleString('en-GB')} recorded seats · {e.contests.toLocaleString('en-GB')} {e.kind==='council'?'ward / electoral-area records':'constituency / regional records'}</strong></p>
      <p>{e.coverage}</p>
      <p><a href={e.href}>Explore results →</a></p>
    </section>
  {/each}
  <p class="muted">These elections choose different bodies and use different ballots. Their vote totals and seat shares are not combined. Council by-elections are listed <a href="/councils/by-elections">separately</a>.</p>
</main>
