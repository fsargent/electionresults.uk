<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import { gallagherDescriptor } from '$lib/gallagher-descriptor';
  import SeatBlocks from '$lib/senedd/components/SeatBlocks.svelte';
  import ShareBars from '$lib/senedd/components/ShareBars.svelte';

  let { data } = $props();
  const el = $derived(data.election);
  const nat = $derived(el.national);

  const winners = $derived(nat.parties.filter((p) => p.seats > 0));
  const others = $derived(nat.parties.filter((p) => p.seats === 0));
  const othersVotes = $derived(others.reduce((s, p) => s + p.votes, 0));

  const nationalSeats = $derived(
    winners.flatMap((p) =>
      Array.from({ length: p.seats }, (_, i) => ({
        party: p.party,
        title: `${p.displayName}: seat ${i + 1} of ${p.seats}`
      }))
    )
  );

  // Gallagher least-squares index over every party and the independents,
  // each counted as a whole: the national figure, not a constituency one.
  const gallagher = $derived(
    Math.sqrt(
      nat.parties.reduce((s, p) => s + (p.share * 100 - p.seatShare * 100) ** 2, 0) / 2
    )
  );

  const seatSum = $derived(winners.map((p) => `${p.seats}`).join(' + '));
  const unexplainedTurnout = $derived(
    el.constituencies.filter((c) => c.turnoutPublishedBasis !== 'valid-votes')
  );
  const dateLabel = $derived(
    new Date(el.date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    })
  );
  const byVotes = $derived([...nat.parties].filter((p) => p.id !== 'independent').sort((a, b) => b.votes - a.votes));
</script>

<svelte:head>
  <title>Senedd election {el.year} results — electionresults.uk</title>
  <meta
    name="description"
    content={`Official results of the ${el.year} Senedd election: ${winners.map((p) => `${p.displayName} ${p.seats}`).join(', ')}. All 16 constituencies, every list and the seat-by-seat D'Hondt allocation.`}
  />
  <link rel="canonical" href={`https://electionresults.uk/senedd/${el.year}`} />
</svelte:head>

<main class="wide">
  <p class="muted crumbs"><a href="/senedd">Senedd elections</a> › {el.year}</p>
  <h1>Senedd election {el.year}</h1>
  <p class="lede">
    Wales elected 96 Members of the Senedd on {dateLabel}, the first election under closed-list
    proportional representation. {byVotes[0].displayName} won the most votes ({pct(byVotes[0].share, 1)})
    and {byVotes[0].seats} seats; {byVotes[1].displayName} came second with {pct(byVotes[1].share, 1)} and
    {byVotes[1].seats} seats. These are the official results, reconciled across vote.wales, Senedd Research and Democracy Club. These are recorded election results; allocation figures below are recalculations of those results.
  </p>

  <div class="kpi-grid">
    <div class="kpi">
      <span class="figure">{nat.seats}</span>
      <span class="label">seats, 6 in each of {el.constituencies.length} constituencies</span>
    </div>
    <div class="kpi">
      <span class="figure">{num(nat.validVotes)}</span>
      <span class="label">valid votes</span>
    </div>
    <div class="kpi">
      <span class="figure">{pct(nat.turnoutValid, 1)}</span>
      <span class="label">turnout (valid votes ÷ electorate of {num(nat.electorate)})</span>
    </div>
    <div class="kpi">
      <span class="figure figure--text">{gallagherDescriptor(gallagher)}</span>
      <span class="label">Gallagher index {gallagher.toFixed(1)}, national seats vs votes</span>
    </div>
  </div>

  <section>
    <h2>Seats</h2>
    <SeatBlocks seats={nationalSeats} label={`Senedd ${el.year} seats by party`} />
    <p class="legend">
      {#each winners as p (p.id)}
        <span class="legend-item"
          ><span class="swatch" style:background-color={partyColor(p.party)}></span>{p.displayName}
          <strong>{p.seats}</strong></span
        >
      {/each}
    </p>
    <p class="muted small">All 96 seats accounted for: {seatSum} = {nat.seats}.</p>

    <ShareBars
      caption="National vote share and seat share. Seats are allocated in each six-seat constituency, not nationally, so small parties need a large local vote to win one."
      rows={winners.map((p) => ({
        party: p.party,
        displayName: p.displayName,
        voteShare: p.share,
        seatShare: p.seatShare
      }))}
    />
  </section>

  <section>
    <h2>Votes by party</h2>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Party</th>
            <th scope="col" class="num">Votes</th>
            <th scope="col" class="num">Vote share</th>
            <th scope="col" class="num">Seats</th>
            <th scope="col" class="num">Seat share</th>
            <th scope="col" class="num">Lists</th>
            <th scope="col" class="num">Candidates</th>
          </tr>
        </thead>
        <tbody>
          {#each nat.parties as p (p.id)}
            <tr>
              <th scope="row">
                <span class="swatch" style:background-color={partyColor(p.party)}></span>{p.displayName}
              </th>
              <td class="num">{num(p.votes)}</td>
              <td class="num">{pct(p.share, 1)}</td>
              <td class="num">{p.seats}</td>
              <td class="num">{pct(p.seatShare, 1)}</td>
              <td class="num">{p.id === 'independent' ? '—' : p.constituenciesContested}</td>
              <td class="num">{p.candidates}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td class="num">{num(nat.validVotes)}</td>
            <td class="num">100.0%</td>
            <td class="num">{nat.seats}</td>
            <td class="num">100.0%</td>
            <td></td>
            <td class="num">{nat.parties.reduce((s, p) => s + p.candidates, 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="muted small">
      Parties and independents without a seat took {num(othersVotes)} votes ({pct(othersVotes / nat.validVotes, 1)}).
      Independent candidates are summed here for reference; each stood alone in one constituency.
      {num(nat.rejectedBallots)} ballot papers were rejected at the count and are not in these totals.
    </p>
  </section>

  <section>
    <h2>Constituencies</h2>
    <p class="muted small">Seats 1–6 in the order D'Hondt awarded them. Select a constituency for its full lists and allocation table.</p>
    <div class="table-scroll">
      <table class="constituencies">
        <thead>
          <tr>
            <th scope="col">Constituency</th>
            <th scope="col">Seats in allocation order</th>
            <th scope="col">Largest list</th>
            <th scope="col" class="num">Valid votes</th>
            <th scope="col" class="num">Turnout</th>
          </tr>
        </thead>
        <tbody>
          {#each el.constituencies as c (c.slug)}
            <tr>
              <th scope="row"><a href={`/senedd/${el.year}/${c.slug}`}>{c.name}</a></th>
              <td>
                <span class="seat-strip" aria-label={c.elected.map((m) => `Seat ${m.seat}: ${m.displayName}`).join(', ')}>
                  {#each c.elected as m (m.seat)}
                    <span
                      class="mini-seat"
                      title={`Seat ${m.seat}: ${m.name} (${m.displayName})`}
                      style:background-color={partyColor(m.party)}
                    >{m.seat}</span>
                  {/each}
                </span>
              </td>
              <td>{c.entries[0].displayName} <span class="muted">{pct(c.entries[0].share, 1)}</span></td>
              <td class="num">{num(c.validVotes)}</td>
              <td class="num">{pct(c.turnoutValid, 1)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>How the seats were allocated</h2>
    <p>
      Each constituency elects six members. Every party list's votes are divided by 1, 2, 3 and so on,
      and the six highest figures win seats. A party's seats go to its candidates in list order, so the
      voter chooses the list, not the person. An independent candidate's votes are never divided and an
      independent can win one seat at most. A list that runs out of candidates (up to eight were allowed)
      drops out.
    </p>
    {#if el.year === 2026}
    <details class="explain">
      <summary>Worked example: Bangor Conwy Môn</summary>
      <p>
        Plaid Cymru had 31,057 votes, Reform UK 19,440 and the Welsh Conservatives 8,555. Plaid's figures are
        31,057, 15,528.5, 10,352.3 and 7,764.3; Reform's are 19,440, 9,720 and 6,480; the Conservatives' first
        is 8,555. The six highest are Plaid 31,057, Reform 19,440, Plaid 15,528.5, Plaid 10,352.3, Reform 9,720
        and Conservative 8,555 — so Plaid 3, Reform 2, Conservatives 1. The next figure, Plaid's 7,764.3,
        just missed out. <a href={`/senedd/${el.year}/bangor-conwy-mon#allocation`}>See the full table.</a>
      </p>
    </details>
    {/if}
    <p>
      If two figures tie for a seat and there aren't enough seats for both, the law adds one vote to each
      tied list and recalculates; if the highest figures still tie for more seats than remain, the returning officer draws lots (Government of
      Wales Act 2006, <a href="https://www.legislation.gov.uk/ukpga/2006/32/section/9" rel="external noopener">section 9</a>).
      No tie arose in {el.year}: we re-ran the statutory allocation for all 16 constituencies and it reproduces
      every published seat, in the published order.
    </p>
  </section>

  {#if el.year === 2026}
  <section>
    <h2>Not comparable with 2021</h2>
    <p>
      In 2021 the Senedd had 60 members: 40 elected by first past the post and 20 from regional lists, with
      two votes per elector. In 2026 there were 96 members, 16 new constituencies and one vote. Senedd
      Research's own analysis notes that changes in seats and vote share can't be directly compared, so we
      don't show swings.
    </p>
  </section>
  {/if}

  <section class="sources" id="sources-and-checks">
    <h2>Sources and checks</h2>
    <ul>
      {#each el.manifest.sources as s (s.file)}
        <li>
          <a href={s.url} rel="external noopener">{s.title}</a> — {s.publisher}. {s.usedFor}.
          <span class="muted small">{s.licence}</span>
          <details class="checksum"><summary>Source file and SHA-256 checksum</summary><code>{s.file}: {s.sha256}</code></details>
        </li>
      {/each}
    </ul>
    <p>Before publishing, the importer checks:</p>
    <ul class="small">
      {#each el.manifest.checks as check (check)}<li>{check}</li>{/each}
    </ul>
    <p class="muted small">
      Turnout here is valid votes ÷ electorate, the basis Senedd Research states. Their national figure is
      {nat.turnoutPublishedPct}%.
      {#if unexplainedTurnout.length}
        For {unexplainedTurnout.map((c) => c.name).join(' and ')}, the briefing's printed constituency turnout
        doesn't match that basis (it is close to ballots at the count ÷ electorate instead); we show our
        computed valid-vote figure and the published one side by side on those pages.
      {/if}
      Data generated {el.manifest.generatedAt.slice(0, 10)}, importer {el.manifest.etlVersion}.
    </p>
  </section>
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
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    font-size: 0.9rem;
  }
  .table-scroll {
    overflow-x: auto;
  }
  tfoot th,
  tfoot td {
    font-weight: 600;
    border-top: 2px solid var(--rule);
  }
  .seat-strip {
    display: inline-flex;
    gap: 2px;
  }
  .mini-seat {
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
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
  .checksum { overflow-wrap: anywhere; font-size: 0.8rem; }
  .sources li {
    margin-bottom: 0.4rem;
  }
</style>
