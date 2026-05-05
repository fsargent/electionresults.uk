<script lang="ts">
  import { pct, num } from '$lib/format';
  let { data } = $props();
  const council = $derived(data.council);
  const races = $derived(data.races);
  const minorityRaces = $derived(races.filter((r) => r.race.winningPct < 0.5).length);
</script>

<svelte:head>
  <title>{council.council} — election results audit | electionresults.uk</title>
  <meta
    name="description"
    content={`${council.council}: ${minorityRaces} of ${council.raceCount} ward races elected councillors without majority support. Full ward-by-ward results.`}
  />
  <link rel="canonical" href={`https://electionresults.uk/${council.councilSlug}`} />
</svelte:head>

<main class="wide">
  <p class="muted"><a href="/">← All councils</a></p>
  <h1>{council.council}</h1>
  <p class="muted election-date">Local elections held <strong>{data.electionDateLabel}</strong>.</p>

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
      <span class="figure minority">{num(council.minorityWinnerSeatCount)}</span>
      <span class="label">won without a majority</span>
    </div>
    <div class="kpi">
      <span class="figure pct">{pct(council.minorityShare)}</span>
      <span class="label">of seats elected on minority support</span>
    </div>
  </div>

  <p class="frame">
    The voting method is the subject of every observation below.
    Named candidates appear as the public election record requires; the system
    observation locates the cause in First-Past-the-Post (or, in multi-member
    wards, in the bloc-vote variant), not in the named individual. See
    <a href="/methodology">methodology</a> for how every figure is derived.
  </p>

  <h2>Races</h2>
  <p class="muted">
    Sorted by winning share, ascending — the thinnest mandate first.
  </p>

  {#each races as { race, observation } (race.wardSlug)}
    <details class="race" id={race.wardSlug} open={race.winningPct < 0.5 && race === races[0].race}>
      <summary>
        <span>
          <strong>{race.wardName}</strong>
          <span class="muted"> · {race.seats === 1 ? 'single-seat' : `${race.seats}-seat (bloc vote)`}</span>
        </span>
        <span class="num muted">{num(race.validBallots)} valid ballots</span>
        <span class="num pct" class:minority={race.winningPct < 0.5}>
          {pct(race.winningPct)}
        </span>
      </summary>

      <p class="muted small race-meta">
        {race.seats} seat{race.seats === 1 ? '' : 's'} ·
        {race.candidates.length} candidate{race.candidates.length === 1 ? '' : 's'} ·
        {#if race.seats === 1}
          a candidate wins by being top of the poll, regardless of share —
          no minimum threshold under First-Past-the-Post
        {:else}
          top {race.seats} candidates by vote count win — no minimum
          threshold under bloc vote. Under
          <a href="https://stv.vote" rel="external noopener">STV</a>, the
          equivalent quota would be roughly
          {pct(1 / (race.seats + 1), 0)} per seat
        {/if}
      </p>

      <!-- HTML produced entirely by systemObservation() in $lib/distortion;
           safe to render. -->
      <div class="system-note">{@html observation}</div>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Candidate</th>
            <th>Party</th>
            <th class="num">Votes</th>
            <th class="num">Share</th>
            <th>Elected</th>
          </tr>
        </thead>
        <tbody>
          {#each race.candidates as c (race.wardSlug + ':' + c.rank)}
            <tr class:elected={c.elected}>
              <td class="num">{c.rank}</td>
              <td>{c.name}</td>
              <td>{c.partyAbbrev ?? c.party}</td>
              <td class="num">{num(c.votes)}</td>
              <td class="num pct">{pct(race.validBallots > 0 ? c.votes / race.validBallots : 0)}</td>
              <td>{#if c.elected}<span aria-label="Elected to seat" title="Elected to seat">Elected</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <p class="muted small">
        Electorate {num(race.electorate)} · Ballots cast {num(race.ballots)} ·
        Invalid {num(race.invalidVotes)} · EC ward code {race.wardCode}
      </p>
    </details>
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
  .kpi .figure.minority { color: var(--warn); }
  .kpi .label {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .frame {
    background: rgba(11, 61, 46, 0.05);
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--accent);
    font-size: 0.92rem;
  }
  tr.elected td { font-weight: 600; }
  .small { font-size: 0.82rem; }
  .election-date {
    margin-top: -0.5rem;
    font-size: 0.95rem;
  }
  .race-meta {
    margin: 0.4rem 0 0.6rem;
  }
</style>
