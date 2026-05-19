<script lang="ts">
  // Placeholder for parliament lens pages that are wired into the nav
  // but not yet implemented. Each route imports this and supplies a
  // title + body + canonical path; the wrapper handles the consistent
  // chrome (canonical link, "coming soon" framing, back-link to
  // /parliament).
  //
  // When a real page lands, delete its `+page.svelte` and replace with
  // the proper implementation. The stub is intentionally tiny so the
  // diff to the real page is just additions.

  let {
    title,
    description,
    canonical,
    plannedScope
  }: {
    /** H1 + <title> text. */
    title: string;
    /** Meta description for the head. */
    description: string;
    /** Canonical URL (full https://... form). */
    canonical: string;
    /** One paragraph describing what this lens will do once built. */
    plannedScope: string;
  } = $props();
</script>

<svelte:head>
  <title>{title} &mdash; electionresults.uk</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
</svelte:head>

<main class="wide">
  <h1>{title}</h1>
  <p>
    This page isn&rsquo;t built yet. {plannedScope}
  </p>
  <p>
    In the meantime, head back to the
    <a href="/parliament">parliament audit overview</a>
    for the constituency hex map, vote-vs-seat bars, and the
    minority-winner leaderboard for the latest general election.
  </p>
</main>
