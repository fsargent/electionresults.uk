import * as XLSX from 'xlsx';
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const rounded = value => Math.round(value * 100) / 100;
export function parseAssemblyWorkbook(bytes, source) {
  const book = XLSX.read(bytes);
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: null });
  const name = String(rows[1][3]).trim();
  const electorate = number(rows[2][3]);
  const seats = number(rows[2][6]);
  const rejectedBallots = number(rows[2][9]);
  const quota = number(rows[2][12]);
  const ballotsCast = number(rows[3][3]);
  const validBallots = number(rows[3][6]);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tables = rows.flatMap((row, index) => row[2] === 'Candidate' && row[4] === '1st Preference' ? [index] : []);
  if (tables.length < 1 || tables.length > 2) throw Error(`${name}: expected one or two count overview tables`);
  const candidates = rows.slice(tables[0]+1, tables[0]+21).filter(r => typeof r[2] === 'string').map(r => ({
    name: r[2].trim(), party: String(r[3]).trim(), sourceStatus: r[0], sourceElectionOrder: r[1],
    elected: r[0] === 'Elected' || (number(r[1]) >= 1 && number(r[1]) <= seats),
    electionOrder: number(r[1]) >= 1 && number(r[1]) <= seats ? number(r[1]) : null, firstPreferences: number(r[4])
  }));
  if (candidates.length < seats || candidates.filter(c => c.elected).length !== seats) throw Error(`${name}: elected candidate mismatch`);
  if (candidates.reduce((sum,c) => sum+c.firstPreferences,0) !== validBallots) throw Error(`${name}: first preferences mismatch`);
  if (ballotsCast - rejectedBallots !== validBallots) throw Error(`${name}: ballots mismatch`);
  const stages = new Map();
  for (const header of tables) {
    const stageHeaders = rows[header-4];
    const candidateRows = rows.slice(header+1,header+21).filter(r => typeof r[2] === 'string');
    const exhaustedRow = rows[header+21];
    const totalRow = rows[header+22];
    for (let column=4;column<23;column++) {
      const match = /^Stage\s+(\d+)$/.exec(String(stageHeaders[column] ?? '').trim());
      if (!match) continue;
      const stage = Number(match[1]);
      const totalColumn = stage === 1 ? 4 : column+1;
      if (!(number(totalRow[totalColumn]) > 0)) continue; // unused template columns are zero
      const values = candidateRows.map(r => ({ name: String(r[2]).trim(), value: rounded(number(r[totalColumn]) ?? 0) }));
      const exhausted = rounded(number(exhaustedRow[totalColumn]) ?? 0);
      const accounted = rounded(values.reduce((sum,c) => sum+c.value,0)+exhausted);
      const reconciled = Math.abs(accounted-validBallots) <= 0.02;
      const action = stage === 1 ? 'First preferences' : [rows[header-3][column], rows[header-2][column]].filter(v => typeof v === 'string').join(': ');
      const entry = { number: stage, action, candidates: values, nonTransferable: exhausted, accounted, reconciled };
      if (stages.has(stage) && JSON.stringify(stages.get(stage).candidates) !== JSON.stringify(values)) throw Error(`${name}: conflicting stage ${stage}`);
      stages.set(stage, entry);
    }
  }
  const countStages = [...stages.values()].sort((a,b) => a.number-b.number);
  if (!countStages.length || countStages[0].number !== 1) throw Error(`${name}: missing first stage`);
  return { name, slug, electorate, seats, rejectedBallots, quota, ballotsCast, validBallots,
    turnout: ballotsCast/electorate, candidates, stages: countStages, source,
    notes: countStages.filter(s => !s.reconciled).map(s => `Source stage ${s.number}: candidate totals plus non-transferable value do not reconcile to valid ballots.`) };
}
