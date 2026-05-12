<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import Frac from '$lib/components/Frac.svelte';
  import PartyViewBlock from '$lib/components/PartyViewBlock.svelte';
  import SeatChart from '$lib/components/SeatChart.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  let { data } = $props();
  const council = $derived(data.council);
  const races = $derived(data.races);
  const cycle = $derived(data.cycle);
  const belowQuotaRaces = $derived(races.filter((r) => r.race.isBelowQuota).length);
  // Same composition-segment shape used on the council overview page.
  // Prefer the per-councillor snapshot (partiesDetailed) when present so
  // small parties / independents keep their own labels.
  function compositionSegments(comp: typeof data.compositionBefore) {
    if (!comp) return [];
    if (comp.partiesDetailed) {
      return Object.entries(comp.partiesDetailed)
        .filter(([, n]) => n > 0)
        .map(([party, seats]) => ({ party, seats }))
        .sort((a, b) => b.seats - a.seats);
    }
    return [
      ...Object.entries(comp.parties)
        .filter(([, n]) => n > 0)
        .map(([party, seats]) => ({ party, seats })),
      ...(comp.otherSeats > 0
        ? [{ party: 'Other', seats: comp.otherSeats }]
        : [])
    ].sort((a, b) => b.seats - a.seats);
  }
</script>

<svelte:head>
  <title>{council.council} {cycle.year} — election results audit | electionresults.uk</title>
  <meta
    name="description"
    content={`${council.council}, ${cycle.electionDateLabel}: ${belowQuotaRaces} of ${council.raceCount} ward races elected councillors below the proportional quota.`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/${council.councilSlug}/${cycle.year}`}
  />
  <!-- Per-cycle social-share preview. Generated build-time by
       scripts/build-og.mjs. -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content={`${council.council} ${cycle.year} — election results audit`} />
  <meta
    property="og:description"
    content={`${council.council}, ${cycle.electionDateLabel}: vote share vs seats won.`}
  />
  <meta
    property="og:image"
    content={`https://electionresults.uk/og/${council.councilSlug}-${cycle.year}.png`}
  />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:image"
    content={`https://electionresults.uk/og/${council.councilSlug}-${cycle.year}.png`}
  />
</svelte:head>

<main class="wide">
  <p class="muted">
    <a href="/{council.councilSlug}">← {council.council} (all cycles)</a>
    · <a href="/{cycle.year}">{cycle.electionDateLabel} cohort</a>
  </p>
  <h1>{council.council} <span class="year-badge">{cycle.year}</span></h1>
  <p class="muted election-date">
    Local elections held <strong>{cycle.electionDateLabel}</strong>.
  </p>

  <div class="summary">
    <div class="kpi">
      <span class="figure">{num(council.raceCount)}</span>
      <span class="label">ward races</span>
    </div>
    <div class="kpi">
      <span class="figure">{num(council.totalSeatCount)}</span>
      <span class="label">seats</span>
    </div>
    <div class="kpi">
      <span class="figure warn">{num(council.belowQuotaSeatCount)}</span>
      <span class="label">elected below the proportional quota</span>
    </div>
    <div class="kpi">
      <span class="figure pct">{pct(council.belowQuotaShare)}</span>
      <span class="label">of seats below quota</span>
    </div>
  </div>

  <section class="frame">
    <h2>How to read this page</h2>
    <p>
      Each race below shows the share of valid ballots the marginal
      elected candidate actually won, and compares it to the
      <strong>proportional quota</strong>: the share they'd need to
      clinch the seat under any proportional voting method
      (<Frac num="1" denom="seats + 1" />). For a 1-seat ward
      the quota is 50%; for 2 seats, 33.3%; for 3 seats, 25%.
    </p>
    <p>
      Where the actual winning share fell below the quota, we show
      the signed gap as <strong>points below quota</strong> (a negative
      number) &mdash; the editorial indictment. Above-quota results
      clear the bar and pass without comment. The voting method is
      the subject of every observation here. Named candidates appear
      as the public election record requires; the cause being audited
      is the voting method, not the individuals. See the
      <a href="/methodology">methodology page</a> for derivations.
    </p>
  </section>

  {#if data.partyView && data.partyView.rows.length > 1}
    {@const view = data.partyView}
    <h2 id="party-view">If votes were counted by party</h2>
    <p>
      Across the {data.council.raceCount} ward{data.council.raceCount === 1 ? '' : 's'} in
      this cycle, parties received the vote totals below. The
      <strong>proportional</strong> column shows what each party would
      have won if the {view.totalSeats} seat{view.totalSeats === 1 ? '' : 's'}
      had been shared out in proportion to votes received
      (<a href="/methodology">how, with caveats</a>). The
      <strong>Δ</strong> column is the actual seat count minus the
      proportional seat count &mdash; positive numbers are parties
      First-Past-the-Post over-represented; negative are parties it
      under-represented.
    </p>

    <PartyViewBlock {view} />
  {/if}

  {#if data.compositionBefore || data.compositionAfter}
    {@const fullSeats =
      data.compositionAfter?.totalSeats ??
      data.compositionBefore?.totalSeats ??
      0}
    {@const isAllOut = fullSeats > 0 && council.totalSeatCount >= fullSeats * 0.9}
    <h2 id="composition">Council composition: what this election replaced</h2>
    <p class="muted">
      {#if isAllOut}
        The {cycle.year} cycle was an all-out election &mdash; every seat
        was contested. The two
        <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
        snapshots below show the council immediately after the {cycle.year}
        election (current) and on the eve of it ({cycle.year - 1}), so you
        can see what the result replaced.
      {:else}
        Two
        <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
        snapshots: the council immediately after the {cycle.year} election
        (current) and immediately before it ({cycle.year - 1}). Only ~⅓ of
        seats were contested in {cycle.year} &mdash; most of the bench is
        unchanged, and the cycle's effect on the overall composition is
        what shifts.
      {/if}
    </p>
    <div class="composition-pair">
      {#if data.compositionAfter}
        <div>
          <SeatChart
            label={`Current (${cycle.year})`}
            segments={compositionSegments(data.compositionAfter)}
            minSize={14}
          />
        </div>
      {/if}
      {#if data.compositionBefore}
        <div>
          <SeatChart
            label={`Previous (${cycle.year - 1})`}
            segments={compositionSegments(data.compositionBefore)}
            minSize={14}
          />
        </div>
      {/if}
    </div>
  {/if}

  <h2 id="wards">Wards in this council</h2>
  <p class="muted">
    Sorted with the largest gap below the quota first. Click any ward to jump
    to its full result.
  </p>
  <ul class="toc">
    {#each races as { race } (race.wardSlug)}
      <li>
        <a href={`#${race.wardSlug}`}>{race.wardName}</a>
        <span class="muted">
          · {race.seats === 1 ? '1 seat' : `${race.seats} seats`}
          · won at <span class="pct">{pct(race.winningPct)}</span>
          {#if race.underPar < 0}
            · <span class="warn">{pts(race.underPar)} below quota</span>
          {:else}
            · <span class="muted">above quota</span>
          {/if}
        </span>
      </li>
    {/each}
  </ul>

  <h2>Race results</h2>

  {#each races as { race } (race.wardSlug)}
    {@const votesSum = race.candidates.reduce((a, c) => a + c.votes, 0)}
    <section class="race" id={race.wardSlug}>
      <h3>
        {race.wardName}
        <span class="muted ward-type">
          · {race.seats === 1 ? 'single-seat' : `${race.seats}-seat (bloc vote)`}
        </span>
      </h3>

      <p class="race-stats">
        <span class="stat">
          <span class="stat-label">
            <Tooltip
              icon
              body={race.seats > 1
                ? `Voter-share estimate of the lowest-vote elected candidate. Comparable to the proportional quota. The raw vote share would be ~${race.seats}× smaller.`
                : `Winning candidate's share of valid ballots.`}
            >
              Marginal winner
            </Tooltip>
          </span>
          <span class="stat-value pct" class:warn={race.isBelowQuota}>
            {pct(race.winningPct)}
          </span>
        </span>
        <span class="stat">
          <span class="stat-label">Proportional quota</span>
          <span class="stat-value pct">{pct(race.quota)}</span>
        </span>
        <span class="stat">
          <span class="stat-label">
            <Tooltip
              icon
              body="Marginal winner's share minus the proportional quota for this race. Negative = below; positive = above."
            >
              Below quota
            </Tooltip>
          </span>
          <span class="stat-value pct" class:warn={race.isBelowQuota}>
            {pts(race.underPar)}
          </span>
        </span>
        <span class="stat">
          <span class="stat-label">
            <Tooltip
              icon
              body={race.ballots != null
                ? 'Voters who cast a valid ballot, from source data.'
                : `Estimated voters: total votes ÷ ${race.seats} seats. Source data does not publish a ballot count for this cycle.`}
            >
              {race.ballots != null ? 'Valid ballots' : 'Valid ballots (est.)'}
            </Tooltip>
          </span>
          <span class="stat-value">{num(Math.round(race.validBallots))}</span>
        </span>
      </p>

      {#if race.seats > 1 && race.ballots == null}
        <p class="muted small bloc-note">
          This is a {race.seats}-seat ward under bloc vote — each voter could cast up to {race.seats} votes,
          so summing candidate votes overcounts voters by ~{race.seats}×. We show
          <strong>share of votes</strong> (matches the council's published figure) and
          <strong>share of voters (est.)</strong> (raw share × {race.seats}, the figure
          comparable to the proportional quota). <a href="/methodology#bloc-vote-denominator">Why two columns →</a>
        </p>
      {/if}

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Candidate</th>
            <th>Party</th>
            <th class="num">Votes</th>
            <th class="num">
              <Tooltip
                icon
                body="Candidate votes ÷ total votes cast in this ward. Matches the share the council publishes."
              >
                Share of votes
              </Tooltip>
            </th>
            {#if race.seats > 1}
              <th class="num">
                <Tooltip
                  icon
                  body={`Estimated share of voters who supported this candidate, comparable across single- and multi-seat wards. Each voter could cast up to ${race.seats} votes, so we approximate ballots as total votes ÷ ${race.seats}. This is the figure compared against the proportional quota.`}
                >
                  Share of voters (est.)
                </Tooltip>
              </th>
            {/if}
            <th class="num">
              <Tooltip
                icon
                body="Each elected candidate's share of valid ballots minus the proportional quota for this race. Negative = won the seat below the quota; positive = cleared it."
              >
                Below quota
              </Tooltip>
            </th>
            <th>Elected</th>
          </tr>
        </thead>
        <tbody>
          {#each race.candidates as c (race.wardSlug + ':' + c.rank)}
            {@const rawShare = votesSum > 0 ? c.votes / votesSum : 0}
            {@const voterShare = race.validBallots > 0 ? c.votes / race.validBallots : 0}
            {@const drift = voterShare - race.quota}
            <tr class:elected={c.elected}>
              <td class="num">{c.rank}</td>
              <td>{c.name}</td>
              <td><Party name={c.party} /></td>
              <td class="num">{num(c.votes)}</td>
              <td class="num pct">{pct(rawShare)}</td>
              {#if race.seats > 1}
                <td class="num pct">{pct(voterShare)}</td>
              {/if}
              <td class="num pct" class:warn={c.elected && drift < 0}>
                {#if c.elected}{pts(drift)}{:else}<span class="muted">—</span>{/if}
              </td>
              <td>{#if c.elected}<span aria-label="Elected to seat" title="Elected to seat">Elected</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <p class="muted small race-meta">
        {#if race.electorate}Electorate {num(race.electorate)} · {/if}
        {#if race.ballots}Ballots cast {num(race.ballots)} · {/if}
        {#if race.invalidVotes && race.invalidVotes > 0}Invalid {num(race.invalidVotes)} · {/if}
        {#if race.wardCode}EC ward code {race.wardCode} · {/if}
        <a href="#wards">Back to ward index</a>
      </p>
    </section>
  {/each}
</main>

<style>
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 1.5rem;
  }
  .kpi {
    border: 1px solid var(--rule);
    padding: 0.75rem 0.9rem;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
  }
  .kpi .figure {
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .kpi .figure.warn { color: var(--warn); }
  .kpi .label {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .frame {
    background: rgba(11, 61, 46, 0.05);
    padding: 0.75rem 1.1rem;
    border-left: 3px solid var(--accent);
    font-size: 0.95rem;
    margin: 1rem 0 1.5rem;
  }
  .frame h2 {
    font-size: 1.05rem;
    margin: 0.2rem 0 0.4rem;
  }
  .frame p { margin: 0.4em 0; }
  .toc {
    columns: 22rem 2;
    gap: 1.5rem;
    padding-left: 1.2rem;
    font-size: 0.92rem;
  }
  .toc li {
    margin-bottom: 0.35rem;
    break-inside: avoid;
  }
  section.race {
    border-top: 1px solid var(--rule);
    padding-top: 1rem;
    margin-top: 1.5rem;
    scroll-margin-top: 1rem;
  }
  section.race h3 { margin-top: 0; }
  .ward-type { font-size: 0.9rem; font-weight: 400; }
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
  .stat-value.warn { color: var(--warn); }
  .warn { color: var(--warn); }
  tr.elected td { font-weight: 600; }
  .small { font-size: 0.82rem; }
  .election-date {
    margin-top: -0.5rem;
    font-size: 0.95rem;
  }
  .race-meta { margin: 0.6rem 0 0; }
  .bloc-note {
    margin: 0 0 0.8rem;
    padding: 0.5rem 0.75rem;
    background: rgba(11, 61, 46, 0.04);
    border-left: 2px solid var(--rule);
    line-height: 1.4;
  }

  .composition-pair {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
    margin: 0.8rem 0 1.5rem;
    max-width: 36rem;
  }

  .year-badge {
    font-size: 0.65em;
    font-weight: 500;
    padding: 0.15em 0.5em;
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 4px;
    vertical-align: 0.3em;
    margin-left: 0.3em;
  }
</style>
