<script lang="ts">
  import { num, pct } from '$lib/format';
  import YearAudit from '$lib/parliament/components/YearAudit.svelte';
  import YearSwitcher from '$lib/parliament/components/YearSwitcher.svelte';

  let { data } = $props();

  // Headline editorial figure: the worst minority-winner contest in
  // the latest cycle — same rhetorical move as the home-page lede
  // ("X% of the vote in Y ward"). The leaderboard is sorted ascending
  // by winning share upstream, so [0] is the smallest mandate.
  const worst = $derived(data.summary.lowWinningShareLeaderboard[0] ?? null);
  const minorityShare = $derived(
    data.summary.minorityWinnerCount / Math.max(1, data.summary.totalSeats)
  );
</script>

<svelte:head>
  <title>UK general elections &mdash; electionresults.uk</title>
  <meta
    name="description"
    content={`The ${data.year} UK general election: ${num(data.summary.minorityWinnerCount)} of ${num(data.summary.totalSeats)} seats won without majority support, Gallagher disproportionality ${data.summary.gallagher.toFixed(1)}.`}
  />
  <link rel="canonical" href="https://electionresults.uk/parliament" />
</svelte:head>

<main class="wide">
  <h1>How many UK MPs won when most voters chose someone else?</h1>

  <YearSwitcher
    currentYear={data.year}
    years={data.allYears}
    latestYear={data.latestYear}
  />

  {#if worst}
    <p class="lede">
      The most extreme case in the {data.year} general election: an MP
      elected on
      <strong>{pct(worst.winningShare, 1)}</strong>
      of the vote in
      <a
        href={`/parliament/${data.year}/${worst.constituencySlug}`}
        ><strong>{worst.constituencyName}</strong></a
      >
      &mdash; meaning
      <strong>{pct(1 - worst.winningShare, 1)}</strong>
      of people who voted there chose someone else, and they still won
      the seat. Under First Past the Post that&rsquo;s how every
      Westminster contest works: a candidate wins by being top of the
      poll, regardless of share, with no minimum threshold. Across the
      whole {data.year} cycle that produced
      <strong>{num(data.summary.minorityWinnerCount)}</strong>
      MPs who took less than half the votes in their constituency
      ({pct(minorityShare)} of the
      <strong>{num(data.summary.totalSeats)}</strong> seats), and a
      Gallagher disproportionality index of
      <strong>{data.summary.gallagher.toFixed(1)}</strong>
      &mdash; <a href="/parliament/methodology#gallagher">methodology</a>.
    </p>
  {/if}

  <YearAudit
    year={data.year}
    summary={data.summary}
    partyTotals={data.partyTotals}
    partyRows={data.partyRows}
    constituencyFills={data.constituencyFills}
    constituencies={data.constituencies}
    manifest={data.manifest}
    headingLevel="h2"
  />
</main>

<style>
  h1 {
    max-width: 72ch;
  }
  .lede {
    font-size: 1.15rem;
    max-width: 72ch;
  }
</style>
