<script lang="ts">
  import { goto } from '$app/navigation';
  import { constituencyNameToSlug } from '$lib/parliament/constituency-slug';

  interface Props {
    /** Every ingested constituency for the active election year — used
     *  to validate postcode/lookup results and to power the
     *  <datalist> name-autocomplete on free-text input. */
    constituencies: { slug: string; name: string }[];
    /** Year for the destination URL. Constituency results live under
     *  /parliament/{year}/{slug}; the caller passes the latest
     *  ingested year so the front page can route there. */
    year: number;
  }

  let { constituencies, year }: Props = $props();

  // Lowercase set of valid slugs for O(1) match against the slugified
  // postcodes.io constituency name. $derived so Svelte 5 doesn't warn
  // about a prop being captured by a top-level constant.
  const slugSet = $derived(new Set(constituencies.map((c) => c.slug)));
  // Case-folded display name → slug, for matching free-text input
  // against the canonical constituency name from the dataset.
  const nameToSlug = $derived(
    new Map(constituencies.map((c) => [c.name.toLowerCase(), c.slug]))
  );

  let query = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  // BS7666 canonical postcode form; deliberately permissive on case
  // and spacing so we let postcodes.io handle the final validation.
  const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

  function matchConstituencyName(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const exact = nameToSlug.get(trimmed.toLowerCase());
    if (exact) return exact;
    const slug = constituencyNameToSlug(trimmed);
    if (slug && slugSet.has(slug)) return slug;
    return null;
  }

  /**
   * Slugify the postcodes.io 2024-boundary constituency name and check
   * it against the ingested set. Returns the matched slug, or null if
   * the boundary set we ingested doesn't contain it (e.g. the API
   * returns a constituency we haven't pulled in yet).
   */
  function matchSlug(result: {
    parliamentary_constituency_2024?: string | null;
    parliamentary_constituency?: string | null;
  }): { slug: string | null; name: string | null } {
    const name =
      result.parliamentary_constituency_2024 ??
      result.parliamentary_constituency ??
      null;
    if (!name) return { slug: null, name: null };
    const slug = constituencyNameToSlug(name);
    return { slug: slugSet.has(slug) ? slug : null, name };
  }

  async function lookupPostcode(raw: string) {
    const cleaned = raw.trim().toUpperCase();
    if (!POSTCODE_RE.test(cleaned)) {
      error = 'That doesn’t look like a UK postcode.';
      return;
    }
    busy = true;
    error = null;
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`
      );
      if (res.status === 404) {
        error = 'Postcode not found.';
        return;
      }
      if (!res.ok) {
        error = 'Lookup failed. Try again in a moment.';
        return;
      }
      const json = (await res.json()) as {
        result: {
          parliamentary_constituency_2024?: string | null;
          parliamentary_constituency?: string | null;
        };
      };
      const { slug, name } = matchSlug(json.result);
      if (!slug) {
        error = name
          ? `${name} isn’t in our parliament dataset yet.`
          : 'No constituency found for that postcode.';
        return;
      }
      await goto(`/parliament/${year}/${slug}`);
    } catch {
      error = 'Lookup failed. Check your connection.';
    } finally {
      busy = false;
    }
  }

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      error = 'Your browser doesn’t support geolocation.';
      return;
    }
    busy = true;
    error = null;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=1`
          );
          if (!res.ok) {
            error = 'Couldn’t find a constituency near you.';
            return;
          }
          const json = (await res.json()) as {
            result:
              | {
                  parliamentary_constituency_2024?: string | null;
                  parliamentary_constituency?: string | null;
                }[]
              | null;
          };
          const first = json.result?.[0];
          if (!first) {
            error = 'No constituency found near your location.';
            return;
          }
          const { slug, name } = matchSlug(first);
          if (!slug) {
            error = name
              ? `${name} isn’t in our parliament dataset yet.`
              : 'No constituency found near your location.';
            return;
          }
          await goto(`/parliament/${year}/${slug}`);
        } catch {
          error = 'Lookup failed. Check your connection.';
        } finally {
          busy = false;
        }
      },
      (geoErr) => {
        busy = false;
        error =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission denied.'
            : 'Couldn’t read your location.';
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  }

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const raw = query.trim();
    if (!raw) return;
    if (POSTCODE_RE.test(raw.toUpperCase())) {
      await lookupPostcode(raw);
      return;
    }
    const slug = matchConstituencyName(raw);
    if (slug) {
      error = null;
      await goto(`/parliament/${year}/${slug}`);
      return;
    }
    error = `No constituency matching "${raw}". Try a postcode, or pick from the suggestions.`;
  }
</script>

<form class="lookup" onsubmit={onSubmit} aria-label="Find your constituency">
  <label for="constituency-lookup" class="lookup-label">
    Find your MP
  </label>
  <div class="lookup-row">
    <input
      id="constituency-lookup"
      type="text"
      inputmode="text"
      autocomplete="off"
      spellcheck="false"
      list="constituency-suggestions"
      placeholder="Postcode or constituency name"
      bind:value={query}
      disabled={busy}
      aria-describedby={error ? 'constituency-lookup-error' : undefined}
    />
    <button
      type="submit"
      class="primary"
      disabled={busy || query.trim().length === 0}
    >
      {busy ? '…' : 'Go'}
    </button>
  </div>
  <datalist id="constituency-suggestions">
    {#each constituencies as c (c.slug)}
      <option value={c.name}></option>
    {/each}
  </datalist>
  <button
    type="button"
    class="locate"
    onclick={useMyLocation}
    disabled={busy}
  >
    <svg
      class="pin"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8 0a5 5 0 0 0-5 5c0 4 5 11 5 11s5-7 5-11a5 5 0 0 0-5-5Zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
      />
    </svg>
    or use my current location
  </button>
  {#if error}
    <p id="constituency-lookup-error" class="lookup-error" role="alert">{error}</p>
  {/if}
</form>

<style>
  .lookup {
    margin: 1.25rem 0 1.5rem;
    padding: 0.85rem 1rem;
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 6px;
  }
  .lookup-label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: var(--fg);
  }
  .lookup-row {
    display: flex;
    gap: 0.4rem;
    align-items: stretch;
  }
  input {
    flex: 1 1 auto;
    min-width: 0;
    height: 44px;
    box-sizing: border-box;
    padding: 0 0.7rem;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 4px;
  }
  input::placeholder {
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    border-color: var(--accent);
  }
  button.primary {
    flex: 0 0 auto;
    height: 44px;
    padding: 0 1.1rem;
    font: inherit;
    font-weight: 600;
    color: var(--accent-fg);
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    cursor: pointer;
  }
  button.locate {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.5rem;
    padding: 0.25rem 0;
    font: inherit;
    font-size: 0.9rem;
    color: var(--accent);
    background: transparent;
    border: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .pin {
    flex: 0 0 auto;
  }
  .lookup-error {
    margin: 0.5rem 0 0;
    color: var(--warn);
    font-size: 0.9rem;
  }
</style>
