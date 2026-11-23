import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const el = JSON.parse(readFileSync('src/lib/data/senedd/2026.json', 'utf8'));
import { describe, expect, it } from 'vitest';
import { nameKey, parseBriefing, parseCsv, parseVoteWalesConstituency, toCsv } from './parse-2026.mjs';

const row = (name, cands, votes, seats) => `
<div class="results__table-row grid">
  <h3 class="results__table-name">${name}</h3>
  <ul class="results__table-candidates">${cands.map((c) => `<li>${c}</li>`).join('')}</ul>
  <p class="results__table-value">${votes}</p>
  <p class="results__table-value">${seats}</p>
</div>`;

const page = `
<h1 class="page__title">Bangor Conwy M&#xF4;n</h1>
<h2 class="results__meta-title">Total valid votes cast</h2>
<p class="results__meta-content">69,130</p>
<h2 class="results__meta-title">Number of seats</h2>
<p class="results__meta-content">6</p>
<h2 class="results__table-title">Elected candidates</h2>
${row('Reform UK Wales', ['Helen Jenner'], '19,440', '1')}
<h2 class="results__table-title">All party and candidates results</h2>
${row('Britain`s Communist Party', ['Jaime Fitter'], '143', '0')}
${row('Reform UK Wales', ['Helen Jenner', 'John Clark'], '19,440', '1')}
${row('Independent candidate', ['Captain Beany'], '504', '0')}
Give feedback about this page`;

describe('parseVoteWalesConstituency', () => {
  it('reads metadata, ordered lists and the elected summary', () => {
    const p = parseVoteWalesConstituency(page);
    expect(p.name).toBe('Bangor Conwy Môn');
    expect(p.totalValidVotes).toBe(69130);
    expect(p.seats).toBe(6);
    expect(p.entries).toHaveLength(3);
    expect(p.entries[1]).toEqual({
      ballotLabel: 'Reform UK Wales',
      candidates: ['Helen Jenner', 'John Clark'],
      votes: 19440,
      seatsWon: 1
    });
    expect(p.electedSummary).toHaveLength(1);
  });
});

describe('parseBriefing', () => {
  it('reads turnout figures and elected members in seat order', () => {
    const text = `
Afan Ogwr Rhondda


Electorate:                         148,732
Valid votes cast:                   66,449
Total rejected ballot papers:           135
Turnout:                            44.68%

Elected Members
Position            Member of the Senedd                        Political Party
    1                      Sera Evans                             Plaid Cymru
    2               Benjamin Hodge McKenna                           Reform UK
    3                      Alun Cox                               Plaid Cymru
    4                     Steve Bayliss                              Reform UK
    5                  Huw Irranca-Davies                        Welsh Labour
    6                    Elyn Stephens                            Plaid Cymru
`;
    const [b] = parseBriefing(text);
    expect(b).toMatchObject({ name: 'Afan Ogwr Rhondda', electorate: 148732, validVotes: 66449, rejectedBallots: 135, turnoutPublishedPct: 44.68 });
    expect(b.elected.map((e) => e.name)).toEqual([
      'Sera Evans',
      'Benjamin Hodge McKenna',
      'Alun Cox',
      'Steve Bayliss',
      'Huw Irranca-Davies',
      'Elyn Stephens'
    ]);
    expect(b.elected[4].party).toBe('Welsh Labour');
  });
});

describe('helpers', () => {
  it('folds names across sources', () => {
    expect(nameKey('Llŷr Powell')).toBe(nameKey('Llyr POWELL'));
    expect(nameKey("Francesca O'Brien")).toBe('francesca o brien');
  });
  it('round-trips CSV with quotes and commas', () => {
    const rows = [{ a: 'x, "y"', b: 'Welsh Christian Party "Proclaiming"' }];
    expect(parseCsv(toCsv(rows, ['a', 'b']))).toEqual(rows);
  });
});

  it('retains verifiable source digests and separate list and candidate records', () => {
    for (const source of el.manifest.sources) {
      const bytes = readFileSync(`source-data/senedd/2026/${source.file}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
    }
    const lists = parseCsv(readFileSync('source-data/senedd/2026/vote-wales-lists.csv', 'utf8'));
    const candidates = parseCsv(readFileSync('source-data/senedd/2026/vote-wales-candidates.csv', 'utf8'));
    expect(lists).toHaveLength(161);
    expect(lists.reduce((sum, row) => sum + Number(row.list_votes), 0)).toBe(el.national.validVotes);
    expect(candidates.every((row) => !('list_votes' in row))).toBe(true);
    expect(candidates.filter((row) => row.elected_source === 'true')).toHaveLength(96);
  });
