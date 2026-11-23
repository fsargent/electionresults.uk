<script lang="ts">
  import { num } from '$lib/format';
  let { data } = $props();
</script>

<svelte:head>
  <title>Senedd elections — electionresults.uk</title>
  <meta
    name="description"
    content="Official results of Senedd Cymru elections: every constituency, every party list and the seat-by-seat D'Hondt allocation."
  />
  <link rel="canonical" href="https://electionresults.uk/senedd" />
</svelte:head>

<main>
  <h1>Senedd elections</h1>
  <p>
    The Senedd (Welsh Parliament) has 96 members. Since 2026 they are elected from 16 constituencies,
    six seats each, by closed-list proportional representation. Voters mark one party list or one
    independent candidate. Seats go to lists by the D'Hondt method and are filled in the order the
    party printed its candidates.
  </p>

  <ul class="elections">
    {#each data.elections as e (e.id)}
      <li>
        <a href={e.href}><strong>{e.name}</strong></a>
        <span class="muted">· {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
        <br />
        <span class="muted small">{e.system}. {num(e.seats)} seats in {e.contests} constituencies.</span>
        <br />
        <span class="small">{e.coverage}</span>
      </li>
    {/each}
  </ul>

  <p class="system-note">
    Earlier Senedd elections (1999–2021) elected 60 members: 40 by first past the post in single-member
    constituencies and 20 from five regional lists. The 2026 boundaries, seat count and voting system all
    changed, so 2026 results can't be compared seat-for-seat or swing-for-swing with 2021. We have not
    loaded the earlier elections yet.
  </p>
</main>

<style>
  ul.elections {
    list-style: none;
    padding: 0;
  }
  ul.elections li {
    border-top: 1px solid var(--rule);
    padding: 0.8rem 0;
  }
  .small {
    font-size: 0.9rem;
  }
</style>
