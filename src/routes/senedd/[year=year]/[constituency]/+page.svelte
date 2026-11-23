<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import SeatBlocks from '$lib/senedd/components/SeatBlocks.svelte';
  import AllocationTable from '$lib/senedd/components/AllocationTable.svelte';

  let { data } = $props();
  const c = $derived(data.constituency);
  const winners = $derived(c.entries.filter((e) => e.seatsWon > 0));
  const seatBlocks = $derived(
    c.elected.map((m) => ({
      party: m.party,
      title: `Seat ${m.seat}: ${m.name}, ${m.displayName}`,
      mark: String(m.seat)
    }))
  );
  const lists = $derived(c.entries.filter((e) => e.kind === 'party'));
  const individuals = $derived(c.entries.filter((e) => e.kind === 'individual'));
  const voteWales = $derived(data.sources.find((s) => s.file === 'vote-wales-lists.csv'));
  const briefing = $derived(data.sources.find((s) => s.file.endsWith('.pdf')));
</script>

<svelte:head>
  <title>{c.name} — Senedd election {data.year} results — electionresults.uk</title>
  <meta
    name="description"
    content={`${c.name} Senedd ${data.year} result: ${winners.map((e) => `${e.displayName} ${e.seatsWon}`).join(', ')}. Every party list in order, list votes and the D'Hondt allocation of all six seats.`}
  />
  <link rel="canonical" href={`https://electionresults.uk/senedd/${data.year}/${c.slug}`} />
</svelte:head>

<main class="wide">
  <p class="muted crumbs">
    <a href="/senedd">Senedd elections</a> ›
    <a href={`/senedd/${data.year}`}>{data.year}</a> › {c.name}
  </p>
  <h1>{c.name}</h1>
  <p class="lede">
    Six Members of the Senedd, elected by closed-list proportional representation:
    {#each winners as e, i (e.id)}{i > 0 ? (i === winners.length - 1 ? ' and ' : ', ') : ''}<strong
        >{e.displayName} {e.seatsWon}</strong
      >{/each}.
  </p>

  <div class="kpi-grid">
    <div class="kpi">
      <span class="figure">{num(c.validVotes)}</span>
      <span class="label">valid votes</span>
    </div>
    <div class="kpi">
      <span class="figure">{pct(c.turnoutValid, 2)}</span>
      <span class="label">turnout (valid votes ÷ electorate of {num(c.electorate)})</span>
    </div>
    <div class="kpi">
      <span class="figure">{num(c.rejectedBallots)}</span>
      <span class="label">ballot papers rejected at the count ({num(c.ballotsAtCount)} counted in all)</span>
    </div>
  </div>
  {#if c.turnoutPublishedBasis !== 'valid-votes'}
    <p class="system-note">
      Senedd Research's briefing prints turnout here as {c.turnoutPublishedPct.toFixed(2)}%. That doesn't
      match its stated basis, valid votes ÷ electorate ({pct(c.turnoutValid, 2)});
      {#if c.turnoutPublishedBasis === 'ballots-at-count'}
        it equals ballots at the count, including rejected papers, ÷ electorate ({pct(c.turnoutBallotsAtCount, 2)}).
      {:else}
        the nearest alternative, ballots at the count ÷ electorate, is {pct(c.turnoutBallotsAtCount, 2)}.
      {/if}
      We show the valid-vote figure for consistency with the other constituencies.
    </p>
  {/if}

  <section>
    <h2>Elected members</h2>
    <SeatBlocks seats={seatBlocks} label={`${c.name}: seats in allocation order`} size={30} />
    <ol class="elected">
      {#each c.elected as m (m.seat)}
        <li>
          <span class="swatch" style:background-color={partyColor(m.party)}></span>
          <strong>{m.name}</strong> — {m.displayName}
          <span class="muted small">(seat {m.seat}, list position {m.listPosition})</span>
        </li>
      {/each}
    </ol>
  </section>

  <section>
    <h2>Party lists</h2>
    <p class="muted small">
      Votes are cast for a whole list, so there is one total per list and none per candidate. Names appear in
      the order printed on the ballot paper; a list's seats are filled from the top. Ticks mark elected members.
    </p>
    <div class="lists">
      {#each lists as e (e.id)}
        <article class="list" style:border-top-color={partyColor(e.party)}>
          <header>
            <h3>{e.displayName}</h3>
            <p class="tally">
              <strong>{num(e.votes)}</strong> votes · {pct(e.share, 1)} ·
              <strong>{e.seatsWon}</strong>
              {e.seatsWon === 1 ? 'seat' : 'seats'}
            </p>
            {#if e.ballotLabel !== e.displayName}
              <p class="muted small ballot-label">On the ballot: “{e.ballotLabel}”</p>
            {/if}
          </header>
          <ol>
            {#each e.candidates as cand (cand.position)}
              <li class:elected={cand.elected}>
                {cand.name}{#if cand.elected}
                  <span class="tick" aria-label={`elected, seat ${cand.seat}`}>✓ seat {cand.seat}</span>{/if}
              </li>
            {/each}
          </ol>
        </article>
      {/each}
    </div>

    {#if individuals.length}
      <h3>Independent candidates</h3>
      <p class="muted small">An independent stands alone and can win one seat at most; their votes are not divided.</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col" class="num">Votes</th>
            <th scope="col" class="num">Share</th>
            <th scope="col" class="num">Seat</th>
          </tr>
        </thead>
        <tbody>
          {#each individuals as e (e.id)}
            <tr>
              <th scope="row">{e.candidates[0].name}</th>
              <td class="num">{num(e.votes)}</td>
              <td class="num">{pct(e.share, 1)}</td>
              <td class="num">{e.seatsWon ? `Seat ${e.candidates[0].seat}` : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section id="allocation">
    <h2>How the six seats were allocated</h2>
    <p>
      D'Hondt: divide each list's votes by 1, 2, 3 …; the six highest figures win, one seat each.
      {#if c.tiesInAllocation === 0}No figures tied, so no tie-break was needed.{/if}
    </p>
    <details class="explain">
      <summary>Show the allocation table and seat-by-seat order</summary>
      <AllocationTable {c} />
    </details>
  </section>

  <nav class="pager" aria-label="Other constituencies">
    <a href={`/senedd/${data.year}/${data.prev.slug}`}>← {data.prev.name}</a>
    <a href={`/senedd/${data.year}`}>All constituencies</a>
    <a href={`/senedd/${data.year}/${data.next.slug}`}>{data.next.name} →</a>
  </nav>

  <p class="muted small sources">
    Sources: <a href={c.voteWalesUrl} rel="external noopener">official result on vote.wales</a> (lists, votes,
    seats){#if voteWales}, {voteWales.publisher}{/if};
    {#if briefing}<a href={briefing.url} rel="external noopener">{briefing.title}</a> (electorate, rejected
      ballots, turnout, elected order);{/if}
    Democracy Club list positions (Creative Commons Attribution 4.0). Our D'Hondt recalculation matches every published seat.
    <a href={`/senedd/${data.year}#sources-and-checks`}>All sources and checks</a>.
  </p>
</main>

<style>
  .crumbs {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
  }
  .lede {
    font-size: 1.05rem;
  }
  section {
    border-top: 1px solid var(--rule);
    margin-top: 1.5rem;
    padding-top: 0.5rem;
  }
  .small {
    font-size: 0.88rem;
  }
  .swatch {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 2px;
    margin-right: 0.35rem;
    vertical-align: -1px;
  }
  ol.elected {
    padding-left: 1.4rem;
  }
  ol.elected li {
    margin-bottom: 0.2rem;
  }
  .lists {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 0.9rem;
  }
  article.list {
    border: 1px solid var(--rule);
    border-top: 5px solid;
    border-radius: 4px;
    padding: 0.5rem 0.8rem;
  }
  article.list h3 {
    margin: 0;
    font-size: 1rem;
  }
  .tally {
    margin: 0.2rem 0;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }
  .ballot-label {
    margin: 0.1rem 0 0.3rem;
    font-size: 0.78rem;
  }
  article.list ol {
    padding-left: 1.3rem;
    margin: 0.3rem 0;
    font-size: 0.9rem;
  }
  article.list li.elected {
    font-weight: 600;
  }
  .tick {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--accent);
    margin-left: 0.3rem;
    white-space: nowrap;
  }
  details.explain {
    border-left: 3px solid var(--accent);
    padding: 0.3rem 0.8rem;
    margin: 0.5rem 0 1rem;
  }
  details.explain summary {
    cursor: pointer;
    font-weight: 500;
  }
  .pager {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-top: 1px solid var(--rule);
    margin-top: 1.5rem;
    padding-top: 0.8rem;
    font-size: 0.92rem;
  }
</style>
