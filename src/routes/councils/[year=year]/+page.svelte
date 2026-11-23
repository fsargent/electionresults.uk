<script lang="ts">
  import CouncilHexMap from '$lib/components/CouncilHexMap.svelte';
  import { num } from '$lib/format';
  let { data } = $props();
  const fills = $derived(Object.fromEntries(data.groups.flatMap(g => g.councils.map(c => [c.mapSlug, {
    color: '#0b3d2e', href: `/councils/${c.slug}/${data.year}`,
    title: `${c.name}: ${c.wards} ward records, ${c.seats} recorded winners`
  }]))));
</script>
<svelte:head>
  <title>All council results {data.year} | electionresults.uk</title>
  <meta name="description" content={`All available council election results for ${data.year}, grouped by England, Scotland, Wales and Northern Ireland, with voting systems and coverage.`} />
  <link rel="canonical" href={`https://electionresults.uk/councils/${data.year}`} />
</svelte:head>
<main>
  <h1>All council results {data.year}</h1>
  <p><a href={`/elections/${data.year}`}>All elections in {data.year} →</a></p>
  <nav aria-label="Election year">{#each data.years as year}<a href={`/councils/${year}`} aria-current={year === data.year ? 'page' : undefined}>{year}</a>{' '}{/each}</nav>
  <p><strong>{num(data.councils)} councils · {num(data.wards)} ward records · {num(data.seats)} recorded winners</strong></p>
  <p>All council election results held in this dataset for {data.year}, grouped by nation.
    Coverage is incomplete. Northern Ireland council results are not included.
    These are council results, not parliamentary elections. By-elections are listed <a href="/councils/by-elections">separately</a>.</p>
  <CouncilHexMap {fills} title={`Councils with result records for ${data.year}`} />
  <p class="muted">Green means records are available, not necessarily complete. Grey means no records in this selection, not necessarily no election. Some historical authorities are absent from this map; the lists below include them.</p>
  {#each data.groups as group (group.nation)}
    <section aria-labelledby={group.nation}>
      <h2 id={group.nation}><a href={`/councils/${group.nation}/${data.year}`}>{group.name}</a></h2>
      {#if group.wards > 0}
        <p>{group.dates.join(', ')} · {(group.nation === 'scotland' || group.nation === 'northern-ireland') ? 'Single Transferable Vote (STV)' : 'First-past-the-post and plurality block voting'}</p>
        <p>{group.councils.length} councils · {num(group.wards)} ward records · {num(group.seats)} recorded winners. <a href={`/councils/${group.nation}/${data.year}`}>Votes, seats and coverage →</a></p>
        <ul>{#each group.councils as c (c.slug)}<li><a href={`/councils/${c.slug}/${data.year}`}>{c.name}</a> · {c.wards} wards · {c.seats} recorded winners</li>{/each}</ul>
      {:else}
        <p>No results included for this nation in {data.year}. <a href={`/councils/${group.nation}/${data.year}`}>Browse available years →</a></p>
      {/if}
    </section>
  {/each}
  <p>Candidate votes in plurality elections and first preferences in STV elections measure different things. Vote totals are shown on the nation pages rather than combined.</p>
  <p><a href="/councils/data">Data and sources</a> · <a href="/councils/methodology">Methodology</a></p>
</main>
