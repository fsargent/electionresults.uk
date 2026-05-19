<script lang="ts">
  // Year-switcher filter bar, styled to match the homepage cycle
  // toggle. The "latest" year always points at /parliament (the
  // canonical front page); older years go to /parliament/{year}. So
  // /parliament always renders the most-recent ingested election and
  // every year stays one click away.

  let {
    currentYear,
    years,
    latestYear
  }: {
    currentYear: number;
    /** All ingested years, in any order — sorted desc inside. */
    years: number[];
    /** The most-recent ingested year. */
    latestYear: number;
  } = $props();

  const sortedYears = $derived([...years].sort((a, b) => b - a));

  function hrefForYear(y: number): string {
    return y === latestYear ? '/parliament' : `/parliament/${y}`;
  }
</script>

<div
  class="filter-bar filter-bar--top"
  role="group"
  aria-label="General-election year"
>
  <span class="filter-label">General election:</span>
  {#each sortedYears as y (y)}
    {@const active = y === currentYear}
    <a
      class:active
      aria-current={active ? 'page' : undefined}
      href={hrefForYear(y)}
    >
      {y}{#if y === latestYear} (latest){/if}
    </a>
  {/each}
</div>
