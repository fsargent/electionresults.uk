<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import { partyColor } from '$lib/party-colors';
  let { data } = $props();
  const history = $derived(data.history);
  const flips = $derived(data.flips);
</script>

<svelte:head>
  <title>{history.council} — election results audit | electionresults.uk</title>
  <meta
    name="description"
    content={`${history.council}: every cycle we have data for, with party-control flips between consecutive elections.`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/${history.councilSlug}`}
  />
</svelte:head>

<main class="wide">
  <p class="muted"><a href="/">← All councils</a></p>
  <h1>{history.council}</h1>
  <p class="muted">
    Every election cycle we have data for, most recent first.
  </p>

  <h2>Cycles</h2>
  <ul class="cycle-list">
    {#each history.cycles as c (c.year)}
      <li>
        <a class="cycle" href={`/${history.councilSlug}/${c.year}`}>
          <span class="cycle-year">{c.year}</span>
          <span class="cycle-stats">
            {num(c.raceCount)} race{c.raceCount === 1 ? '' : 's'} ·
            {num(c.totalSeatCount)} seat{c.totalSeatCount === 1 ? '' : 's'}
          </span>
          <span class="cycle-quota">
            <span class="warn">{pct(c.belowQuotaShare)}</span>
            <span class="muted">below quota</span>
          </span>
        </a>
      </li>
    {/each}
  </ul>

  {#if flips.length > 0}
    <h2>Party-control changes between cycles</h2>
    <p>
      Cases where the largest party (by seats won) changed from one cycle to
      the next. Each row shows the new party's vote share in both cycles
      and the seats they took. A small <strong>vote shift</strong> paired
      with a big <strong>seat shift</strong> is the First-Past-the-Post
      volatility story.
    </p>

    {#each flips as f (f.yearFrom + ':' + f.yearTo)}
      {@const newColor = partyColor(f.toParty)}
      {@const oldColor = partyColor(f.fromParty)}
      <section class="flip">
        <h3 class="flip-year">
          <span class="from">{f.yearFrom}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span class="to">{f.yearTo}</span>
        </h3>
        <p class="flip-summary">
          <Party name={f.fromParty} />
          <span class="arrow muted" aria-hidden="true">→</span>
          <Party name={f.toParty} />
        </p>

        <div class="flip-grid">
          <div>
            <span class="lbl">Vote shift (incoming party)</span>
            <span class="val pct" class:warn={f.voteSwingNew < 0.05}>{pts(f.newPartyVoteTo - f.newPartyVoteFrom)}</span>
            <span class="muted small">
              {pct(f.newPartyVoteFrom)} → {pct(f.newPartyVoteTo)}
            </span>
          </div>
          <div>
            <span class="lbl">Seat shift (incoming party)</span>
            <span class="val pct warn">{pts(f.newPartySeatTo - f.newPartySeatFrom)}</span>
            <span class="muted small">
              {pct(f.newPartySeatFrom)} → {pct(f.newPartySeatTo)}
            </span>
          </div>
          <div>
            <span class="lbl">Outgoing party (vote / seats {f.yearFrom} → {f.yearTo})</span>
            <span class="val pct muted">
              {pct(f.oldPartyVoteFrom)} → {pct(f.oldPartyVoteTo)}
            </span>
            <span class="muted small">
              seats: {pct(f.oldPartySeatFrom)} → {pct(f.oldPartySeatTo)}
            </span>
          </div>
        </div>

        <h4 class="bars-heading">Vote share vs seat share</h4>
        <div class="bars" aria-label="Vote and seat share comparison across the two cycles">
          {#each [{ year: f.yearFrom, vNew: f.newPartyVoteFrom, sNew: f.newPartySeatFrom, vOld: f.oldPartyVoteFrom, sOld: f.oldPartySeatFrom }, { year: f.yearTo, vNew: f.newPartyVoteTo, sNew: f.newPartySeatTo, vOld: f.oldPartyVoteTo, sOld: f.oldPartySeatTo }] as row (row.year)}
            <div class="bar-block">
              <div class="bar-year muted">{row.year}</div>
              <div class="bar-row">
                <span class="bar-label">Votes</span>
                <div class="bar">
                  <span class="seg" style:width={`${row.vNew * 100}%`} style:background-color={newColor} title={`${f.toParty}: ${pct(row.vNew)}`}></span>
                  <span class="seg" style:width={`${row.vOld * 100}%`} style:background-color={oldColor} title={`${f.fromParty}: ${pct(row.vOld)}`}></span>
                </div>
              </div>
              <div class="bar-row">
                <span class="bar-label">Seats</span>
                <div class="bar">
                  <span class="seg" style:width={`${row.sNew * 100}%`} style:background-color={newColor} title={`${f.toParty}: ${pct(row.sNew)}`}></span>
                  <span class="seg" style:width={`${row.sOld * 100}%`} style:background-color={oldColor} title={`${f.fromParty}: ${pct(row.sOld)}`}></span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    <p class="muted small">
      <strong>Caveat for by-thirds councils:</strong> only a third of the
      seats are elected in each cycle, so a flip in the "largest party
      this cycle" doesn't necessarily mean a flip in overall council
      control. The vote-vs-seat divergence still tells you something
      about how First-Past-the-Post allocates the seats that
      <em>were</em> contested.
    </p>
  {:else}
    <p class="muted">
      Only one cycle of data for this council so far — no
      between-cycle comparison possible yet.
    </p>
  {/if}
</main>

<style>
  .cycle-list {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.6rem;
    margin: 1rem 0 2rem;
  }
  .cycle {
    display: grid;
    gap: 0.15rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.1s, background 0.1s;
  }
  .cycle:hover {
    border-color: var(--accent);
    background: rgba(11, 61, 46, 0.04);
  }
  .cycle-year {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.45rem;
    font-weight: 700;
    color: var(--accent);
  }
  .cycle-stats,
  .cycle-quota {
    font-size: 0.85rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  section.flip {
    border-top: 1px solid var(--rule);
    padding-top: 1.5rem;
    margin-top: 2rem;
  }
  .flip-year {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    font-variant-numeric: tabular-nums;
  }
  .flip-year .arrow {
    font-size: 1.6rem;
    color: var(--muted);
  }
  .flip-summary {
    margin: 0.4rem 0 0.6rem;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .flip-summary .arrow { font-size: 1.1rem; }
  .flip-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.5rem 1.6rem;
    margin: 0.6rem 0 0.8rem;
  }
  .flip-grid div {
    display: flex;
    flex-direction: column;
  }
  .lbl {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .val {
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .val.warn { color: var(--warn); }
  .small { font-size: 0.78rem; }
  .warn { color: var(--warn); }

  .bars-heading {
    font-size: 0.95rem;
    margin-top: 0.8rem;
    margin-bottom: 0.4rem;
  }
  .bars {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 700px) {
    .bars { grid-template-columns: 1fr; }
  }
  .bar-block {
    display: grid;
    gap: 0.3rem;
  }
  .bar-year {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 4rem 1fr;
    gap: 0.5rem;
    align-items: center;
  }
  .bar-label {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .bar {
    display: flex;
    height: 1rem;
    border: 1px solid var(--rule);
    border-radius: 2px;
    overflow: hidden;
    background: var(--bg);
  }
  .bar .seg {
    display: block;
    height: 100%;
  }
</style>
