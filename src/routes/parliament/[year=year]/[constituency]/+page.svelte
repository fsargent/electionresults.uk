<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import ConstituencyResultTable from '$lib/parliament/components/ConstituencyResultTable.svelte';
  import BoundaryCaveat from '$lib/parliament/components/BoundaryCaveat.svelte';

  let { data } = $props();

  const winner = $derived(data.contest.candidates.find((c) => c.isWinner) ?? null);
  const runnerUp = $derived(
    data.contest.candidates.find((c) => c.position === 2) ?? null
  );
  const winningShare = $derived(winner?.share ?? null);
  // Every Westminster contest is single-member, so the proportional
  // quota is fixed at 50%. Hard-coded for clarity rather than computed
  // — historical multi-member seats are excluded upstream.
  const QUOTA = 0.5;
  const underPar = $derived(
    winningShare != null ? winningShare - QUOTA : null
  );
  const isBelowQuota = $derived(underPar != null && underPar < 0);
  const hasBoundaryCaveat = $derived(
    data.contest.caveats.includes('boundary-comparability-limited')
  );
  // Pull the boundary identifier out of the composite constituencyId
  // (`${boundarySet}:${slug}`) so the BoundaryCaveat can name the
  // review without needing a separate lookup.
  const boundarySet = $derived(
    data.contest.constituencyId.split(':')[0] || undefined
  );
</script>

<svelte:head>
  <title
    >{data.contest.constituencyName} &mdash; {data.year} UK general election
    &mdash; electionresults.uk</title>
  <meta
    name="description"
    content={`Full candidate result for ${data.contest.constituencyName} in the ${data.year} UK general election. ${winner ? `${winner.partyDisplayName} won with ${winningShare != null ? pct(winningShare, 1) : 'an unreported share'} of valid votes.` : ''}`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/parliament/${data.year}/${data.contest.constituencySlug}`}
  />
</svelte:head>

<main class="wide">
  <p class="muted crumbs">
    <a href="/parliament">UK general elections</a> ›
    <a href={`/parliament/${data.year}`}>{data.year}</a> ›
    {data.contest.constituencyName}
  </p>

  <h1>{data.contest.constituencyName} &mdash; {data.year}</h1>

  {#if winner}
    <p>
      <strong>{winner.candidateName}</strong>
      ({winner.partyDisplayName}) was elected with
      <strong>{num(winner.votes)} votes</strong>{#if winningShare != null}
        &mdash;
        <strong>{pct(winningShare, 1)}</strong> of
        {num(data.contest.validVotes ?? 0)} valid votes{/if}.
      {#if isBelowQuota}
        Under First Past the Post, a plurality is enough; a majority is
        not required.
      {/if}
    </p>
  {/if}

  {#if hasBoundaryCaveat}
    <BoundaryCaveat {boundarySet} />
  {/if}

  <section class="race" id={data.contest.constituencySlug}>
    <h2>
      Result
      <span class="muted ward-type">· single-seat</span>
    </h2>

    <p class="race-stats">
      <span class="stat">
        <span class="stat-label">
          <Tooltip icon body="Winning candidate's share of valid votes.">
            Marginal winner
          </Tooltip>
        </span>
        <span class="stat-value pct" class:warn={isBelowQuota}>
          {winningShare != null ? pct(winningShare, 1) : '—'}
        </span>
      </span>
      <span class="stat">
        <span class="stat-label">Proportional quota</span>
        <span class="stat-value pct">{pct(QUOTA, 1)}</span>
      </span>
      <span class="stat">
        <span class="stat-label">
          <Tooltip
            icon
            body="Winning candidate's share minus the proportional quota (50% for a single-member seat). Negative = below; positive = above."
          >
            Below quota
          </Tooltip>
        </span>
        <span class="stat-value pct" class:warn={isBelowQuota}>
          {underPar != null ? pts(underPar) : '—'}
        </span>
      </span>
      <span class="stat">
        <span class="stat-label">
          <Tooltip
            icon
            body="Voters who cast a valid ballot in this constituency, from the published source."
          >
            Valid ballots
          </Tooltip>
        </span>
        <span class="stat-value">
          {data.contest.validVotes != null
            ? num(data.contest.validVotes)
            : '—'}
        </span>
      </span>
    </p>

    <ConstituencyResultTable
      candidates={data.contest.candidates}
      constituencyName={data.contest.constituencyName}
    />

    <p class="muted small race-meta">
      {#if data.contest.electorate != null}Electorate {num(data.contest.electorate)} · {/if}
      {#if data.contest.turnout != null}Turnout {pct(data.contest.turnout, 1)} · {/if}
      {#if winner && runnerUp && winner.votes != null && runnerUp.votes != null}
        Majority {num(winner.votes - runnerUp.votes)} ·
      {/if}
      <a href={`/parliament/${data.year}`}>Back to {data.year} overview</a>
    </p>
  </section>

  {#if data.contest.caveats.length > 0}
    <p class="muted">
      Data caveats on this contest:
      {#each data.contest.caveats as c, i (c)}
        <code>{c}</code>{i < data.contest.caveats.length - 1 ? ', ' : ''}
      {/each}.
      <a href="/parliament/methodology#caveats">What these mean.</a>
    </p>
  {/if}

  <p class="muted">
    Source data:
    <a href={data.manifest.sourceUrl} rel="external noopener"
      >{data.manifest.sourceName}</a>, retrieved
    {data.manifest.retrievalDate}, generated
    {new Date(data.manifest.generatedAt).toISOString().slice(0, 10)}
    ({data.manifest.licence}). ETL version
    <code>{data.manifest.etlVersion}</code>. Methodology:
    <a href="/parliament/methodology">how these numbers are computed</a>.
  </p>
</main>

<style>
  .crumbs {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
  }
  section.race {
    border-top: 1px solid var(--rule);
    padding-top: 1rem;
    margin-top: 1.5rem;
  }
  section.race h2 {
    margin-top: 0;
  }
  .ward-type {
    font-size: 0.9rem;
    font-weight: 400;
  }
  .race-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.6rem;
    margin: 0.5rem 0 0.8rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
  }
  .stat-label {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .stat-value {
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .stat-value.warn {
    color: var(--warn);
  }
  .race-meta {
    margin: 0.6rem 0 0;
  }
  .small {
    font-size: 0.82rem;
  }
</style>
