<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import ConstituencyResultTable from '$lib/parliament/components/ConstituencyResultTable.svelte';
  import BoundaryCaveat from '$lib/parliament/components/BoundaryCaveat.svelte';

  let { data } = $props();

  const winner = $derived(data.contest.candidates.find((c) => c.isWinner) ?? null);
  const runnerUp = $derived(
    data.contest.candidates.find((c) => c.position === 2) ?? null
  );
  const winningShare = $derived(winner?.share ?? null);
  const isMinorityMandate = $derived(
    winningShare != null && winningShare < 0.5
  );
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
    &mdash; electionresults.uk</title
  >
  <meta
    name="description"
    content={`Full candidate result for ${data.contest.constituencyName} in the ${data.year} UK general election. ${winner ? `${winner.partyDisplayName} won with ${winningShare != null ? pct(winningShare, 1) : 'an unreported share'} of valid votes.` : ''}`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/parliament/${data.year}/${data.contest.constituencySlug}`}
  />
</svelte:head>

<main>
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/parliament">UK general elections</a>
    <span aria-hidden="true">›</span>
    <a href={`/parliament/${data.year}`}>{data.year}</a>
    <span aria-hidden="true">›</span>
    <span aria-current="page">{data.contest.constituencyName}</span>
  </nav>

  <h1>
    {data.contest.constituencyName}
    <span class="year-suffix">&mdash; {data.year}</span>
  </h1>

  {#if winner}
    <p class="headline">
      <span
        class="winner-swatch"
        style="background:{partyColor(winner.partyDisplayName)}"
        aria-hidden="true"
      ></span>
      <strong>{winner.candidateName}</strong>
      ({winner.partyDisplayName}) was elected with
      <strong>{num(winner.votes)} votes</strong>
      {#if winningShare != null}&mdash; <strong>{pct(winningShare, 1)}</strong>
        of {num(data.contest.validVotes ?? 0)} valid votes{/if}.
      {#if isMinorityMandate}
        Under First Past the Post, a plurality is enough; a majority is
        not required.
      {/if}
    </p>
  {/if}

  {#if hasBoundaryCaveat}
    <BoundaryCaveat {boundarySet} />
  {/if}

  <h2>Result</h2>
  <ConstituencyResultTable
    candidates={data.contest.candidates}
    constituencyName={data.contest.constituencyName}
  />

  <dl class="contest-meta">
    <div>
      <dt>Electorate</dt>
      <dd>
        {data.contest.electorate != null
          ? num(data.contest.electorate)
          : 'Not reported'}
      </dd>
    </div>
    <div>
      <dt>Valid votes</dt>
      <dd>
        {data.contest.validVotes != null
          ? num(data.contest.validVotes)
          : 'Not reported'}
      </dd>
    </div>
    <div>
      <dt>Turnout</dt>
      <dd>
        {data.contest.turnout != null
          ? pct(data.contest.turnout, 1)
          : 'Not reported'}
      </dd>
    </div>
    {#if winner && runnerUp && winner.votes != null && runnerUp.votes != null}
      <div>
        <dt>Majority</dt>
        <dd>{num(winner.votes - runnerUp.votes)}</dd>
      </div>
    {/if}
    <div>
      <dt>Contest type</dt>
      <dd>{data.contest.contestType.replace('-', ' ')}</dd>
    </div>
  </dl>

  {#if data.contest.caveats.length > 0}
    <p class="muted">
      Data caveats on this contest:
      {#each data.contest.caveats as c, i (c)}
        <code>{c}</code>{i < data.contest.caveats.length - 1 ? ', ' : ''}
      {/each}.
      <a href="/parliament/methodology#caveats">What these mean.</a>
    </p>
  {/if}

  <footer class="page-footer">
    <p class="muted">
      Source data:
      <a href={data.manifest.sourceUrl} rel="external noopener"
        >{data.manifest.sourceName}</a
      >, retrieved {data.manifest.retrievalDate}, generated
      {new Date(data.manifest.generatedAt).toISOString().slice(0, 10)}
      ({data.manifest.licence}). ETL version
      <code>{data.manifest.etlVersion}</code>. Methodology:
      <a href="/parliament/methodology">how these numbers are computed</a>.
    </p>
  </footer>
</main>

<style>
  .crumbs {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: baseline;
  }

  .crumbs a {
    color: var(--muted);
  }

  .crumbs [aria-current='page'] {
    color: var(--fg);
  }

  .year-suffix {
    font-weight: 400;
    color: var(--muted);
  }

  .headline {
    font-size: 1.05rem;
  }

  .winner-swatch {
    display: inline-block;
    width: 0.85rem;
    height: 0.85rem;
    margin-right: 0.35rem;
    border-radius: 2px;
    vertical-align: baseline;
  }

  dl.contest-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem 1rem;
    margin: 1rem 0;
    padding: 0;
  }

  dl.contest-meta div {
    border-left: 3px solid var(--rule);
    padding: 0.1rem 0 0.1rem 0.6rem;
  }

  dl.contest-meta dt {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  dl.contest-meta dd {
    margin: 0.1rem 0 0;
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }

  code {
    background: color-mix(in srgb, var(--rule) 35%, transparent);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .page-footer {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
  }
</style>
