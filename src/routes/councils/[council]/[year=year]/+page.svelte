<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import PartyViewBlock from '$lib/components/PartyViewBlock.svelte';
  import SeatChart from '$lib/components/SeatChart.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import { reallocatedSeats } from '$lib/distortion';
  let { data } = $props();
  const isStv = $derived(data.stvContests.length > 0 || data.races.some(r => r.race.system === 'STV'));
  const stv = $derived(data.stvContests);
  const stvSeats = $derived(stv.reduce((n, c) => n + c.seats, 0));
  const stvFilled = $derived(stv.reduce((n, c) => n + c.seatsFilled, 0));
  const stvNoPoll = $derived(stv.filter((c) => !c.contested).length);
  const areaWord = $derived(stv[0]?.areaType === 'DEA' ? 'District Electoral Areas' : 'wards');
  const fmtStage = (v: number | null) => v == null ? '–' : Number.isInteger(v) ? num(v) : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const council = $derived(data.council);
  const races = $derived(data.races);
  const cycle = $derived(data.cycle);
  const belowQuotaRaces = $derived(races.filter((r) => r.race.isBelowQuota).length);
  // Unfairly-awarded ("reallocated") seats — present only when we have
  // a comparable party view. STV councils and councils whose candidates
  // ran almost entirely as independents won't have one, in which case
  // we suppress the related KPIs rather than show "0".
  const partyView = $derived(data.partyView);
  const hasPartyView = $derived(!!partyView && partyView.rows.length > 1);
  const reallocated = $derived(
    hasPartyView ? reallocatedSeats(partyView!.rows) : 0
  );
  const reallocatedShare = $derived(
    hasPartyView && partyView!.totalSeats > 0
      ? reallocated / partyView!.totalSeats
      : 0
  );
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
    content={isStv ? `${council.council} ${cycle.year}: recorded STV winners and first-preference votes.` : `${council.council}, ${data.stvElection ? new Date(`${data.stvElection.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : cycle.electionDateLabel}: ${belowQuotaRaces} of ${council.raceCount} ward races elected councillors below the proportional quota.`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/councils/${council.councilSlug}/${cycle.year}`}
  />
  <!-- Per-cycle social-share preview. Generated build-time by
       scripts/build-og.mjs. -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content={`${council.council} ${cycle.year} — election results audit`} />
  <meta
    property="og:description"
    content={`${council.council}, ${data.stvElection ? new Date(`${data.stvElection.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : cycle.electionDateLabel}: vote share vs seats won.`}
  />
  {#if !isStv}
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
  {/if}
</svelte:head>

<main class="wide">
  <p class="muted">
    <a href="/councils/{council.councilSlug}">← {council.council} (all cycles)</a>
    · <a href="/councils/{cycle.year}">{data.stvElection ? new Date(`${data.stvElection.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : cycle.electionDateLabel} cohort</a>
  </p>
  <h1>{council.council} <span class="year-badge">{cycle.year}</span></h1>
  <p class="muted election-date">
    Local elections held <strong>{data.stvElection ? new Date(`${data.stvElection.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : cycle.electionDateLabel}</strong>.
  </p>

  {#if isStv && stv.length}
    <p>Single Transferable Vote (STV). Winners are the officially declared ones; votes are first preferences.
      Transfers can elect a candidate who was outside the leading places on first preferences.</p>
    <p><strong>{stv.length} {areaWord} · {stvFilled} of {stvSeats} seats filled</strong>{#if stvNoPoll}. {stvNoPoll} had no poll because no more candidates stood than there were seats; those candidates were returned unopposed and have no vote totals.{/if}
      {#if data.stvElection}<a href={data.stvElection.href}>{data.stvElection.name}: coverage and sources →</a>{/if}</p>
    {#each stv as c (c.areaSlug)}
      <section id={c.areaSlug}>
        <h2>{c.area}</h2>
        {#if c.contested}
          <p>{c.seats} seats · {c.validBallots != null ? `${num(c.validBallots)} valid ballots` : 'valid ballots not published'}{#if c.quota != null} · quota {num(c.quota)}{/if}{#if c.electorate} · electorate {num(c.electorate)}{/if}</p>
        {:else}
          <p>{c.seats} seats · no poll (uncontested){#if c.vacancies} · {c.vacancies} {c.vacancies === 1 ? 'seat' : 'seats'} left vacant{/if}</p>
        {/if}
        <table><thead><tr><th>Candidate</th><th>Party</th><th class="num">First preferences</th><th>Result</th></tr></thead>
          <tbody>{#each c.candidates as cand}<tr><td>{cand.name}</td><td><Party name={cand.party || 'Independent'} /></td><td class="num">{cand.firstPreferences == null ? 'No poll' : fmtStage(cand.firstPreferences)}</td><td>{cand.elected ? (c.contested ? 'Elected' : 'Elected unopposed') : 'Not elected'}</td></tr>{/each}</tbody>
        </table>
        {#if c.stages}
          <details>
            <summary>Official count: {c.stages.length} stages</summary>
            <div class="stage-scroll">
              <table class="stages">
                <thead><tr><th>Candidate</th>{#each c.stages as st}<th class="num" title={st.action}>Stage {st.number}{st.incomplete ? ' (incomplete)' : ''}</th>{/each}</tr></thead>
                <tbody>
                  {#each c.candidates as cand, i}<tr><td>{cand.name}</td>{#each c.stages as st}<td class="num">{fmtStage(st.totals[i] ?? null)}</td>{/each}</tr>{/each}
                  <tr><td>Non-transferable</td>{#each c.stages as st}<td class="num">{fmtStage(st.nonTransferable)}</td>{/each}</tr>
                  <tr class="muted"><td>Action</td>{#each c.stages as st}<td>{st.action}</td>{/each}</tr>
                </tbody>
              </table>
            </div>
          </details>
        {/if}
        {#if c.notes.length}<ul class="notes">{#each c.notes as n}<li>{n}</li>{/each}</ul>{/if}
        <p class="muted">Source: {#each c.sources as src, i}{#if i}; {/if}<a href={src.url}>{src.label}</a>{#if src.sheet} (sheet “{src.sheet}”){/if}{/each}.</p>
      </section>
    {/each}
  {:else if isStv}
    <p>Single Transferable Vote (STV). These are recorded winners and first-preference votes.
      Transfers can elect a candidate who was outside the leading places on first preferences.</p>
    {#each races as { race } (race.wardSlug)}
      <section id={race.wardSlug}>
        <h2>{race.wardName}</h2>
        <p>{race.seats} seats · {num(race.validBallots)} valid ballots</p>
        <table><thead><tr><th>Candidate</th><th>Party</th><th class="num">First preferences</th><th>Result</th></tr></thead>
          <tbody>{#each race.candidates as c}<tr><td>{c.name}</td><td><Party name={c.party} /></td><td class="num">{num(c.votes)}</td><td>{c.elected ? 'Elected' : 'Not elected'}</td></tr>{/each}</tbody>
        </table>
      </section>
    {/each}
  {:else}
  <div class="summary">
    <div class="kpi">
      <span class="figure">{num(council.raceCount)}</span>
      <span class="label">ward races</span>
    </div>
    <div class="kpi">
      <span class="figure">{num(council.totalSeatCount)}</span>
      <span class="label">seats</span>
    </div>
    {#if council.belowQuotaSeatCount > 0}
      <div class="kpi">
        <span class="figure warn">{num(council.belowQuotaSeatCount)}</span>
        <span class="label">elected below the proportional quota</span>
      </div>
      <div class="kpi">
        <span class="figure pct">{pct(council.belowQuotaShare)}</span>
        <span class="label">of seats below quota</span>
      </div>
    {/if}
    {#if hasPartyView}
      <div class="kpi">
        <span class="figure" class:warn={reallocated > 0}>{num(reallocated)}</span>
        <span class="label">unfairly awarded seats</span>
      </div>
      <div class="kpi">
        <span class="figure pct" class:warn={reallocatedShare > 0}>
          {pct(reallocatedShare)}
        </span>
        <span class="label">of seats unfairly awarded</span>
      </div>
    {/if}
  </div>

  <p class="muted methodology-note">
    Each race compares the marginal winner's share of valid ballots to
    the <strong>proportional quota</strong> — the share they'd need under
    any common proportional method.
    <a href="/councils/methodology">How the numbers are derived →</a>
  </p>

  <h2 id="party-view">If votes were counted by party</h2>
  {#if data.partyView && data.partyView.rows.length > 1}
    {@const view = data.partyView}
    <p>
      Across the {data.council.raceCount} ward{data.council.raceCount === 1 ? '' : 's'} in
      this cycle, parties received the vote totals below. The
      <strong>proportional</strong> column shows what each party would
      have won if the {view.totalSeats} seat{view.totalSeats === 1 ? '' : 's'}
      had been shared out in proportion to votes received
      (<a href="/councils/methodology">how, with caveats</a>). The
      <strong>Δ</strong> column is the actual seat count minus the
      proportional seat count &mdash; positive numbers are parties
      First-Past-the-Post over-represented; negative are parties it
      under-represented.
    </p>

    <PartyViewBlock {view} />
  {:else}
    <p class="muted">
      Not enough party-aligned candidates stood in this cycle to compare
      vote share against seat share. Most candidates ran as independents
      or were grouped under a single label, so the proportional check
      doesn't have anything to redistribute.
    </p>
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
          comparable to the proportional quota). <a href="/councils/methodology#bloc-vote-denominator">Why two columns →</a>
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
  {/if}
</main>

<style>
  .stage-scroll { overflow-x: auto; }
  table.stages td, table.stages th { white-space: nowrap; font-size: 0.85rem; }
  table.stages tr.muted td { white-space: normal; min-width: 7rem; font-size: 0.75rem; }
  ul.notes { font-size: 0.9rem; }
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
  .methodology-note {
    margin: 0.4rem 0 1.5rem;
    font-size: 0.9rem;
    line-height: 1.45;
  }
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
