<script lang="ts">
  import { num } from '$lib/format';
  import YearAudit from '$lib/parliament/components/YearAudit.svelte';
  import YearSwitcher from '$lib/parliament/components/YearSwitcher.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.year} UK general election &mdash; electionresults.uk</title>
  <meta
    name="description"
    content={`The ${data.year} UK general election: ${num(data.summary.minorityWinnerCount)} of ${num(data.summary.totalSeats)} seats won without majority support, Gallagher disproportionality ${data.summary.gallagher.toFixed(1)}.`}
  />
  <link rel="canonical" href={`https://electionresults.uk/parliament/${data.year}`} />
</svelte:head>

<main class="wide">
  <h1>How many UK MPs won when most voters chose someone else?</h1>

  <YearSwitcher
    currentYear={data.year}
    years={data.allYears}
    latestYear={data.latestYear}
  />
  <YearAudit
    year={data.year}
    summary={data.summary}
    partyTotals={data.partyTotals}
    partyRows={data.partyRows}
    constituencyFills={data.constituencyFills}
    constituencies={data.constituencies}
    manifest={data.manifest}
  />
</main>

<style>
  h1 {
    max-width: 72ch;
  }
</style>
