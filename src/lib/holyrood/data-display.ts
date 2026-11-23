import type { HolyroodParty } from './types';

// Display helper contains no election snapshot: safe for client components.
export function partyLookup(parties: HolyroodParty[]): (id: string) => HolyroodParty {
  const byId = new Map(parties.map((p) => [p.id, p]));
  return (id) => byId.get(id) ?? { id, name: id, shortName: id, color: '#999999', kind: 'party' };
}
