// Reconciliation tests for the generated 2026 Scottish Parliament data.
// These run against src/lib/data/holyrood/2026.json as shipped, so a
// bad re-import fails CI even if the importer's own checks were edited.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { holyroodSitemapUrls } from '$lib/sitemap/holyrood';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { allocateRegion } from '../../../scripts/lib/holyrood-dhondt.mjs';
import type { CatalogEntry, HolyroodElection } from './types';

const root = resolve(__dirname, '../../..');
const e: HolyroodElection = JSON.parse(readFileSync(resolve(root, 'src/lib/data/holyrood/2026.json'), 'utf8'));
const catalog: { elections: CatalogEntry[] } = JSON.parse(
  readFileSync(resolve(root, 'src/lib/data/holyrood/catalog.json'), 'utf8')
);

// Published by the Electoral Management Board for Scotland
// (Summary sheet of SP_2026___Votes_and_Seats.xlsx). Typed in by hand
// as an independent check on the importer.
const EMB_SEATS: Record<string, [number, number]> = {
  snp: [57, 1],
  lab: [3, 14],
  ref: [0, 17],
  grn: [2, 13],
  con: [4, 8],
  ld: [7, 3]
};

describe('2026 Scottish Parliament: members', () => {
  it('has 129 MSPs: 73 constituency and 56 regional', () => {
    expect(e.msps).toHaveLength(129);
    expect(e.msps.filter((m) => m.seatType === 'constituency')).toHaveLength(73);
    expect(e.msps.filter((m) => m.seatType === 'regional')).toHaveLength(56);
    expect(new Set(e.msps.map((m) => m.name)).size).toBe(129);
  });

  it('matches the EMB seat totals party by party', () => {
    const seats = Object.fromEntries(e.seats.map((s) => [s.partyId, [s.constituency, s.regional]]));
    expect(seats).toEqual(EMB_SEATS);
    expect(e.seats.reduce((a, s) => a + s.total, 0)).toBe(129);
  });

  it('every party and member id resolves to a party record', () => {
    const ids = new Set(e.parties.map((p) => p.id));
    for (const m of e.msps) expect(ids.has(m.partyId)).toBe(true);
    for (const c of e.constituencies) for (const cand of c.candidates) expect(ids.has(cand.partyId)).toBe(true);
  });
});

describe('2026 Scottish Parliament: 73 constituency results', () => {
  it('has 73 unique constituencies, each in one of 8 regions', () => {
    expect(e.constituencies).toHaveLength(73);
    expect(new Set(e.constituencies.map((c) => c.slug)).size).toBe(73);
    const inRegions = e.regions.flatMap((r) => r.constituencySlugs);
    expect(inRegions.sort()).toEqual(e.constituencies.map((c) => c.slug).sort());
  });

  for (const c of e.constituencies) {
    it(`${c.name}: one winner with the most votes, totals add up`, () => {
      const elected = c.candidates.filter((x) => x.elected);
      expect(elected).toHaveLength(1);
      const top = Math.max(...c.candidates.map((x) => x.votes));
      expect(elected[0].votes).toBe(top);
      expect(c.candidates.filter((x) => x.votes === top)).toHaveLength(1);
      expect(c.winner).toEqual({ name: elected[0].name, partyId: elected[0].partyId });
      expect(c.candidates.reduce((a, x) => a + x.votes, 0)).toBe(c.validVotes);
      expect(c.ballotsCounted).toBe(c.validVotes + c.rejected);
      const second = [...c.candidates].sort((a, b) => b.votes - a.votes)[1];
      expect(c.majority).toBe(top - (second?.votes ?? 0));
      expect(c.turnout).toBeGreaterThan(0.3);
      expect(c.turnout).toBeLessThan(0.8);
      const msp = e.msps.find((m) => m.constituencySlug === c.slug);
      expect(msp?.name).toBe(c.winner.name);
    });
  }

  it('national constituency votes equal the sum of the 73 contests', () => {
    const valid = e.constituencies.reduce((a, c) => a + c.validVotes, 0);
    expect(e.constituencyVote.validVotes).toBe(valid);
    expect(e.constituencyVote.validVotes).toBe(2297209); // EMB summary
    expect(e.constituencyVote.rejected).toBe(10000); // EMB summary
    expect(e.constituencyVote.parties.reduce((a, p) => a + p.seats, 0)).toBe(73);
  });
});

describe('2026 Scottish Parliament: 8 regional results', () => {
  it('has 8 regions with 7 list members each', () => {
    expect(e.regions).toHaveLength(8);
    for (const r of e.regions) expect(r.members).toHaveLength(7);
  });

  for (const r of e.regions) {
    it(`${r.name}: re-running the allocation reproduces the members`, () => {
      const constSeats: Record<string, number> = {};
      for (const slug of r.constituencySlugs) {
        const w = e.constituencies.find((c) => c.slug === slug)!.winner.partyId;
        constSeats[w] = (constSeats[w] ?? 0) + 1;
      }
      for (const p of r.parties) expect(p.constituencySeats).toBe(constSeats[p.partyId] ?? 0);
      const { rounds } = allocateRegion(
        r.parties.map((p) => ({
          id: p.partyId,
          votes: p.votes,
          constituencySeats: p.constituencySeats,
          individual: p.partyId.startsWith('ind-'),
          listCapacity: r.lists.find((list) => list.partyId === p.partyId)?.candidates.filter((c) => c.outcome !== 'constituency').length ?? 0
        })),
        7
      );
      expect(rounds.map((x: { winner: string }) => x.winner)).toEqual(r.members.map((m) => m.partyId));
      expect(r.allocation.map((x) => x.memberName)).toEqual(r.members.map((m) => m.name));
      expect(r.parties.reduce((a, p) => a + p.regionalSeats, 0)).toBe(7);
    });

    it(`${r.name}: list members are the highest-placed candidates not already elected`, () => {
      for (const list of r.lists) {
        const positions = list.candidates.map((c) => c.position);
        expect(positions).toEqual(positions.map((_, i) => i + 1));
        const won = list.candidates.filter((c) => c.outcome === 'regional').map((c) => c.position);
        const skippable = list.candidates.filter((c) => c.outcome !== 'not-elected').map((c) => c.position);
        // No unelected candidate sits above an elected list member.
        const lastWon = Math.max(0, ...won);
        for (const c of list.candidates) {
          if (c.position < lastWon) expect(skippable).toContain(c.position);
        }
        for (const c of list.candidates.filter((x) => x.outcome === 'constituency')) {
          const k = e.constituencies.find((x) => x.slug === c.constituencySlug);
          expect(k?.winner.name).toBe(c.name);
        }
      }
    });

    it(`${r.name}: regional totals add up`, () => {
      expect(r.parties.reduce((a, p) => a + p.votes, 0)).toBe(r.validVotes);
      expect(r.ballotsCounted).toBe(r.validVotes + r.rejected);
    });
  }

  it('national regional votes equal the sum of the 8 regions', () => {
    expect(e.regionalVote.validVotes).toBe(e.regions.reduce((a, r) => a + r.validVotes, 0));
    expect(e.regionalVote.rejected).toBe(6137); // EMB summary
    expect(e.regionalVote.parties.reduce((a, p) => a + p.seats, 0)).toBe(56);
  });
});

describe('2026 Scottish Parliament: ballots stay separate', () => {
  it('has no combined constituency + regional vote figure', () => {
    const json = JSON.stringify(e);
    expect(json).not.toMatch(/"combined|"totalVotes"|4606240|4622377/);
  });
});

describe('holyrood catalog contract', () => {
  it('lists the 2026 election with plain fields', () => {
    expect(catalog.elections).toHaveLength(1);
    const c = catalog.elections[0];
    expect(Object.keys(c).sort()).toEqual(
      ['contests', 'coverage', 'date', 'href', 'id', 'name', 'nation', 'seats', 'system', 'year'].sort()
    );
    expect(c).toMatchObject({ year: 2026, date: '2026-05-07', href: '/holyrood/2026', nation: 'scotland', seats: 129, contests: 81 });
    for (const v of Object.values(c)) expect(['string', 'number']).toContain(typeof v);
  });
});


describe('source provenance and navigation', () => {
  it('preserves downloaded bytes with their recorded checksums', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'source-data/holyrood/2026/sources.json'), 'utf8'));
    expect(manifest.sources).toHaveLength(4);
    for (const source of manifest.sources) {
      const bytes = readFileSync(resolve(root, 'source-data/holyrood/2026', source.file));
      expect(bytes.length).toBe(source.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
      expect(e.sources.find((s) => s.file === source.file)?.sha256).toBe(source.sha256);
    }
  });
  it('provides every election and drill-down URL to the shared sitemap integration', () => {
    const urls = holyroodSitemapUrls();
    expect(new Set(urls).size).toBe(83);
    expect(urls).toHaveLength(83);
    expect(urls).toContain('/holyrood');
    expect(urls).toContain(catalog.elections[0].href);
    for (const c of e.constituencies) expect(urls).toContain(`/holyrood/2026/constituency/${c.slug}`);
    for (const r of e.regions) expect(urls).toContain(`/holyrood/2026/region/${r.slug}`);
  });
  it('retains every eligible unrounded regional figure', () => {
    for (const r of e.regions) {
      for (const round of r.allocation) {
        for (const f of round.figures) expect(f.quotient).toBe(f.votes / f.divisor);
        expect(round.figures[0].id).toBe(round.winner);
      }
    }
  });
});
