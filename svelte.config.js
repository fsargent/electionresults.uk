import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Workers Static Assets routes via the [assets] block in
      // wrangler.toml, not _routes.json — but the adapter still emits
      // _routes.json for Pages compatibility, and its default exclude
      // list (every prerendered path) blows past the 100-rule cap and
      // logs a noisy warning at build time. Empty exclude here keeps
      // the file under cap and silences the warning. Behaviour is
      // unchanged because Workers ignores _routes.json entirely.
      routes: { include: ['/*'], exclude: [] }
    }),
    prerender: {
      handleHttpError: ({ path, message }) => {
        // Parliament stack: routes referenced by ingested-year pages
        // land in subsequent stories. Drop entries as each story merges.
        //   /parliament/methodology       — Story 4.1
        //   /parliament/2024/[constituency] — Story 3.5
        const pendingParliamentRoutes = new Set(['/parliament/methodology']);
        if (pendingParliamentRoutes.has(path)) return;
        throw new Error(message);
      },
      handleMissingId: 'fail'
    }
  }
};

export default config;
