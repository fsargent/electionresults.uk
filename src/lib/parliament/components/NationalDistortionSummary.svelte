<script lang="ts">
  import { num, pct } from '$lib/format';
  import type { NationalSummary } from '../types';

  let { summary }: { summary: NationalSummary } = $props();

  const minorityShare = $derived(summary.minorityWinnerCount / summary.totalSeats);

  // Pick the most over- and under-represented parties for the headline
  // gap callout. voteVsSeatGap rows are already sorted descending by gap
  // in the ETL output (Story 2.6), so most-over is first and most-under
  // is last — but resorting locally keeps the component robust to ETL
  // output-order changes.
  const mostOver = $derived(
    [...summary.voteVsSeatGap].sort((a, b) => b.gap - a.gap)[0] ?? null
  );
  const mostUnder = $derived(
    [...summary.voteVsSeatGap].sort((a, b) => a.gap - b.gap)[0] ?? null
  );
</script>

<section aria-labelledby="national-distortion-heading" class="summary">
  <h2 id="national-distortion-heading">National FPTP audit</h2>

  <dl>
    <div class="metric">
      <dt>Seats won without majority support</dt>
      <dd>
        <span class="value">{num(summary.minorityWinnerCount)}</span>
        <span class="of">of {num(summary.totalSeats)}</span>
        <span class="aux">({pct(minorityShare, 0)})</span>
      </dd>
      <p class="explain">
        Under First Past the Post, the winning candidate needs only the
        largest pile of votes &mdash; not a majority. This counts
        constituencies where the winner took below 50% of valid votes.
      </p>
    </div>

    <div class="metric">
      <dt>Disproportionality (Gallagher index)</dt>
      <dd>
        <span class="value">{summary.gallagher.toFixed(1)}</span>
        <span class="aux">0 = perfectly proportional</span>
      </dd>
      <p class="explain">
        The standard academic measure of how far seat shares diverged
        from vote shares. Higher is more distorted.
        <a href="/parliament/methodology#gallagher">How this is computed.</a>
      </p>
    </div>

    {#if mostOver && mostOver.gap > 0}
      <div class="metric">
        <dt>Largest over-representation</dt>
        <dd>
          <span class="value">{mostOver.partyDisplayName}</span>
          <span class="aux">
            +{pct(mostOver.gap, 1)} seat share above vote share
          </span>
        </dd>
        <p class="explain">
          The party whose seat share most exceeded its national vote
          share &mdash; the biggest FPTP &ldquo;bonus&rdquo; this
          election.
        </p>
      </div>
    {/if}

    {#if mostUnder && mostUnder.gap < 0}
      <div class="metric">
        <dt>Largest under-representation</dt>
        <dd>
          <span class="value">{mostUnder.partyDisplayName}</span>
          <span class="aux">
            {pct(mostUnder.gap, 1)} seat share below vote share
          </span>
        </dd>
        <p class="explain">
          The party whose national vote share most exceeded its seat
          share &mdash; the largest pool of voters FPTP left without
          proportional representation this election.
        </p>
      </div>
    {/if}

    <div class="metric">
      <dt>Total seats audited</dt>
      <dd>
        <span class="value">{num(summary.totalSeats)}</span>
        <span class="aux">across {num(summary.totalVotes)} valid votes</span>
      </dd>
    </div>
  </dl>

  {#if summary.excludedFromMetrics.length > 0}
    <p class="muted excluded">
      Excluded from headline metrics:
      {#each summary.excludedFromMetrics as ex, i (ex.caveat)}
        {num(ex.count)} {ex.caveat}{i < summary.excludedFromMetrics.length - 1
          ? ', '
          : ''}
      {/each}.
      <a href="/parliament/methodology#caveats">What these tokens mean.</a>
    </p>
  {/if}
</section>

<style>
  .summary {
    margin: 1.5rem 0 2rem;
  }

  dl {
    margin: 1rem 0;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  .metric {
    padding: 0.9rem 1rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
  }

  dt {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  dd {
    margin: 0.25rem 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem 0.7rem;
  }

  .value {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.7rem;
    font-weight: 600;
    color: var(--accent);
    line-height: 1.1;
  }

  .of,
  .aux {
    font-size: 0.95rem;
    color: var(--muted);
  }

  .explain {
    margin: 0.55rem 0 0;
    font-size: 0.92rem;
    color: var(--fg);
  }

  .excluded {
    font-size: 0.9rem;
  }

  @media (min-width: 720px) {
    dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
