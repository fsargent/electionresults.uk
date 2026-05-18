<script lang="ts">
  let { data } = $props();

  /** Bytes → human-readable file size. Keeps the unit choice consistent
   *  across rows (KB threshold = 1024, MB threshold = 1024² etc.) so a
   *  download list doesn't mix kB and bytes for visually-similar files. */
  function fmtBytes(bytes: number | null): string {
    if (bytes == null) return 'unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
  }
</script>

<svelte:head>
  <title>Data &mdash; Parliament &mdash; electionresults.uk</title>
  <meta
    name="description"
    content="Download parliamentary election data as CSV. Per-year manifests with source attribution, licence, retrieval date, and column schema."
  />
  <link rel="canonical" href="https://electionresults.uk/parliament/data" />
</svelte:head>

<main>
  <p class="badge" aria-label="Section: Parliament">Parliament</p>
  <h1>Parliament data</h1>
  <p class="lede">
    Every published parliamentary metric is reproducible from these
    files. Source manifest, licence, and schema documentation travel
    with every download.
  </p>
  <p class="muted">
    Looking for council data? See
    <a href="/data">/data</a>.
  </p>

  {#if data.years.length === 0}
    <p>
      No parliamentary elections have been ingested yet. Check back as
      coverage expands.
    </p>
  {:else}
    {#each data.years as y (y.year)}
      <section aria-labelledby={`year-${y.year}-heading`} class="year">
        <h2 id={`year-${y.year}-heading`}>{y.year} UK general election</h2>

        <h3>Downloads</h3>
        <ul class="downloads">
          {#each y.csvs as f (f.filename)}
            <li>
              <a href={f.href} download class="dl">
                <span class="filename">{f.filename}</span>
                <span class="meta">({fmtBytes(f.bytes)})</span>
              </a>
              <p class="desc">{f.description}</p>
            </li>
          {/each}
          <li class="sqlite">
            <span class="filename muted">parliament-{y.year}.sqlite</span>
            <span class="meta muted">(coming soon)</span>
            <p class="desc">
              Bundled SQLite of all per-year tables. Not yet generated;
              the per-table CSVs above carry the same content in the
              meantime.
            </p>
          </li>
        </ul>

        <details class="manifest">
          <summary>Source manifest &amp; licence</summary>
          <dl>
            <div><dt>Source</dt><dd>{y.manifest.sourceName}</dd></div>
            <div>
              <dt>URL</dt>
              <dd>
                <a href={y.manifest.sourceUrl} rel="external noopener"
                  >{y.manifest.sourceUrl}</a>
              </dd>
            </div>
            <div><dt>Licence</dt><dd>{y.manifest.licence}</dd></div>
            <div><dt>Source published</dt><dd>{y.manifest.publicationDate}</dd></div>
            <div><dt>Retrieved</dt><dd>{y.manifest.retrievalDate}</dd></div>
            <div><dt>Generated</dt><dd>{fmtDate(y.manifest.generatedAt)}</dd></div>
            <div><dt>ETL version</dt><dd><code>{y.manifest.etlVersion}</code></dd></div>
            <div>
              <dt>Manifest ID</dt>
              <dd><code>{y.manifest.id}</code></dd>
            </div>
          </dl>
          {#if y.manifest.caveats.length > 0}
            <p class="muted">
              Dataset-level caveats:
              {#each y.manifest.caveats as c, i (c)}
                <code>{c}</code>{i < y.manifest.caveats.length - 1 ? '; ' : ''}
              {/each}.
            </p>
          {/if}
        </details>

        <p class="muted">
          <a href="/parliament/methodology#csv-mapping">Schema &amp; column reference</a>
          &middot; <a href="/parliament/methodology">methodology</a>
        </p>
      </section>
    {/each}
  {/if}
</main>

<style>
  .badge {
    display: inline-block;
    margin: 0 0 0.25rem;
    padding: 0.15rem 0.55rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent-fg);
    background: var(--accent);
    border-radius: 3px;
  }

  .lede {
    font-size: 1.05rem;
  }

  .year {
    margin: 2rem 0;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
  }

  .year:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  ul.downloads {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 1rem;
    display: grid;
    gap: 0.75rem;
  }

  ul.downloads li {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
  }

  .dl {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem 0.6rem;
    text-decoration: none;
    color: var(--accent);
    /* ≥44×44 tap target on mobile (NFR — implicit accessibility) */
    min-height: 44px;
    align-content: center;
  }

  .dl:hover,
  .dl:focus-visible {
    text-decoration: underline;
  }

  .dl:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .filename {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.95rem;
  }

  .meta {
    font-size: 0.85rem;
    color: var(--muted);
  }

  .desc {
    margin: 0.3rem 0 0;
    font-size: 0.9rem;
  }

  li.sqlite .filename {
    /* Visually de-emphasised — the file isn't there yet. */
    text-decoration: line-through;
  }

  .manifest {
    margin: 1rem 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: color-mix(in srgb, var(--rule) 20%, transparent);
  }

  .manifest summary {
    cursor: pointer;
    font-weight: 600;
    /* ≥44px tap target */
    padding: 0.5rem 0;
  }

  .manifest dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.5rem 1rem;
    margin: 0.75rem 0 0.25rem;
  }

  .manifest dl div {
    border-left: 3px solid var(--rule);
    padding: 0.1rem 0 0.1rem 0.6rem;
  }

  .manifest dt {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  .manifest dd {
    margin: 0.1rem 0 0;
    font-size: 0.95rem;
    word-break: break-word;
  }

  code {
    background: color-mix(in srgb, var(--rule) 35%, transparent);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .muted {
    color: var(--muted);
  }
</style>
