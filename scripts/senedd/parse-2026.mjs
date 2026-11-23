// Pure parsers for the 2026 Senedd sources. No file system access, so
// they can be unit-tested against fixtures.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeHtml(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function toInt(s) {
  const n = Number(String(s).replace(/[,\s]/g, ''));
  if (!Number.isInteger(n)) throw new Error(`not an integer: ${JSON.stringify(s)}`);
  return n;
}

/**
 * Parse one vote.wales constituency results page. Reads the "All party
 * and candidates results" table only; the "Elected candidates" table
 * above it is a subset and is used as a cross-check.
 */
export function parseVoteWalesConstituency(html) {
  const title = html.match(/<h1 class="page__title">([\s\S]*?)<\/h1>/);
  if (!title) throw new Error('vote.wales page: no title');
  const meta = (label) => {
    const re = new RegExp(
      `results__meta-title">\\s*${label}\\s*</h2>\\s*<p class="results__meta-content">([^<]*)<`
    );
    const m = html.match(re);
    if (!m) throw new Error(`vote.wales page: no "${label}"`);
    return toInt(m[1]);
  };

  const parseRows = (section) =>
    section
      .split('results__table-row grid')
      .slice(1)
      .map((row) => {
        const name = row.match(/results__table-name">([\s\S]*?)<\/h3>/);
        const values = [...row.matchAll(/results__table-value">([^<]*)</g)].map((m) => m[1]);
        const candidates = [...row.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => decodeHtml(m[1]));
        if (!name || values.length !== 2) throw new Error('vote.wales page: malformed row');
        return {
          ballotLabel: decodeHtml(name[1]),
          candidates,
          votes: toInt(values[0]),
          seatsWon: toInt(values[1])
        };
      });

  const allIdx = html.indexOf('All party and candidates results');
  const electedIdx = html.indexOf('Elected candidates');
  if (allIdx < 0 || electedIdx < 0) throw new Error('vote.wales page: results tables missing');
  const end = html.indexOf('Give feedback about this page', allIdx);

  return {
    name: decodeHtml(title[1]),
    totalValidVotes: meta('Total valid votes cast'),
    seats: meta('Number of seats'),
    entries: parseRows(html.slice(allIdx, end < 0 ? undefined : end)),
    electedSummary: parseRows(html.slice(electedIdx, allIdx))
  };
}

/** Parse the vote.wales national summary page (party votes + seats). */
export function parseVoteWalesNational(html) {
  const out = [];
  const lines = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((l) => decodeHtml(l))
    .filter(Boolean);
  const declared = lines.findIndex((l) => l === 'Seats declared');
  const seatsDeclared = declared >= 0 ? lines[declared + 1] : null;
  const start = lines.findIndex((l) => l === 'Seats');
  const stop = lines.findIndex((l) => l === 'Results by constituency');
  for (let i = start + 1; i < stop; i++) {
    if (lines[i + 1] === 'Votes cast:') {
      out.push({ partyLabel: lines[i], votes: toInt(lines[i + 2]), seats: toInt(lines[i + 3]) });
      i += 3;
    }
  }
  return { seatsDeclared, parties: out };
}

/**
 * Parse the per-constituency blocks of the Senedd Research briefing
 * (pdftotext -layout output): electorate, valid votes, rejected ballot
 * papers, published turnout, and the elected members in seat order.
 */
export function parseBriefing(text) {
  const re =
    /\n\s*([^\n]+?)\s*\n+\s*Electorate:\s*([\d,]+)\s*\n\s*Valid votes cast:\s*([\d,]+)\s*\n\s*Total rejected ballot papers:\s*([\d,]+)\s*\n\s*Turnout:\s*([\d.]+)%/g;
  const out = [];
  for (const m of text.matchAll(re)) {
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 5000);
    const i = rest.indexOf('Elected Members');
    if (i < 0) throw new Error(`briefing: no elected members for ${m[1]}`);
    const block = rest.slice(i, i + 1200);
    const elected = [...block.matchAll(/^\s*([1-6])\s{2,}(.+?)\s{2,}(\S.*?)\s*$/gm)]
      .slice(0, 6)
      .map((r) => ({ seat: Number(r[1]), name: r[2].trim(), party: r[3].trim() }));
    if (elected.length !== 6) throw new Error(`briefing: ${m[1]} has ${elected.length} elected rows`);
    out.push({
      name: m[1].trim(),
      electorate: toInt(m[2]),
      validVotes: toInt(m[3]),
      rejectedBallots: toInt(m[4]),
      turnoutPublishedPct: Number(m[5]),
      elected
    });
  }
  return out;
}

/** Fold case, accents and punctuation so names from different sources compare. */
export function nameKey(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[`'’.\-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s) {
  return nameKey(s).replace(/ /g, '-');
}

/** Minimal RFC 4180 CSV reader (quoted fields, embedded commas/quotes/newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}
