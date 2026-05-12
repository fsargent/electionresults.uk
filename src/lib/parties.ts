// First-class slug map for the seven major parties. Lives in its own
// module (rather than data.ts) because $lib/data is server-only — it
// uses node:fs to load split JSON snapshots — and the param matcher
// at src/params/party.ts needs to run in the browser too.
//
// Slugs intentionally short and URL-friendly; the canonical full name
// from scripts/party-normalize.mjs is the lookup key everywhere else
// in the codebase.
export const PARTY_SLUG_TO_NAME: Record<string, string> = {
  labour: 'Labour Party',
  conservative: 'Conservative Party',
  'liberal-democrats': 'Liberal Democrats',
  green: 'Green Party',
  reform: 'Reform UK',
  snp: 'Scottish National Party',
  'plaid-cymru': 'Plaid Cymru'
};

export const PARTY_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PARTY_SLUG_TO_NAME).map(([slug, name]) => [name, slug])
);

export function partySlugs(): string[] {
  return Object.keys(PARTY_SLUG_TO_NAME);
}

export function partyForSlug(slug: string): string | null {
  return PARTY_SLUG_TO_NAME[slug] ?? null;
}

export function slugForParty(party: string): string | null {
  return PARTY_NAME_TO_SLUG[party] ?? null;
}
