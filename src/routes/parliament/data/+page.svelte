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
  <h1>Parliament data</h1>
  <p>
    Every published parliamentary metric is reproducible from these
    files. Source manifest, licence, and schema documentation travel
    with every download.
  </p>
  <p class="muted">
    Looking for council data? See <a href="/data">/data</a>.
  </p>

  {#if data.years.length === 0}
    <p>
      No parliamentary elections have been ingested yet. Check back as
      coverage expands.
    </p>
  {:else}
    {#each data.years as y (y.year)}
      <h2>{y.year} UK general election</h2>

      <h3>Downloads</h3>
      <ul>
        {#each y.csvs as f (f.filename)}
          <li>
            <a href={f.href} download><code>{f.filename}</code></a>
            <span class="muted">({fmtBytes(f.bytes)})</span> &mdash;
            {f.description}
          </li>
        {/each}
        <li class="muted">
          <code>parliament-{y.year}.sqlite</code> (coming soon) &mdash;
          bundled SQLite of all per-year tables.
        </li>
      </ul>

      <details>
        <summary>Source manifest &amp; licence</summary>
        <table>
          <tbody>
            <tr><th scope="row">Source</th><td>{y.manifest.sourceName}</td></tr>
            <tr>
              <th scope="row">URL</th>
              <td>
                <a href={y.manifest.sourceUrl} rel="external noopener"
                  >{y.manifest.sourceUrl}</a>
              </td>
            </tr>
            <tr><th scope="row">Licence</th><td>{y.manifest.licence}</td></tr>
            <tr>
              <th scope="row">Source published</th>
              <td>{y.manifest.publicationDate}</td>
            </tr>
            <tr><th scope="row">Retrieved</th><td>{y.manifest.retrievalDate}</td></tr>
            <tr>
              <th scope="row">Generated</th>
              <td>{fmtDate(y.manifest.generatedAt)}</td>
            </tr>
            <tr>
              <th scope="row">ETL version</th>
              <td><code>{y.manifest.etlVersion}</code></td>
            </tr>
            <tr>
              <th scope="row">Manifest ID</th>
              <td><code>{y.manifest.id}</code></td>
            </tr>
          </tbody>
        </table>
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
        <a href="/parliament/methodology#csv-mapping"
          >Schema &amp; column reference</a> ·
        <a href="/parliament/methodology">methodology</a>
      </p>
    {/each}
  {/if}
</main>
