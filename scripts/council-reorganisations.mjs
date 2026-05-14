// Hand-curated list of UK council reorganisations covering the cycles in
// our LEH data (2021–2025). Sourced from:
//   - https://en.wikipedia.org/wiki/2019%E2%80%932023_structural_changes_to_local_government_in_England
//   - https://commonslibrary.parliament.uk/research-briefings/cbp-9056/
// (cross-referenced with the official LGBCE timetable, March 2026).
//
// Each entry: a NEW unitary that took over the area of one or more
// abolished councils, with the effective date. We use these to flag
// councils on the site so readers know the data shows two different
// electoral bodies under the same area name across a reorganisation.

export const REORGANISATIONS = [
  // 2019
  {
    date: '2019-04-01',
    newCouncil: 'Bournemouth, Christchurch and Poole',
    abolished: ['Bournemouth', 'Poole', 'Christchurch']
  },
  {
    date: '2019-04-01',
    newCouncil: 'Dorset',
    abolished: [
      'Dorset (county)',
      'East Dorset',
      'North Dorset',
      'Purbeck',
      'West Dorset',
      'Weymouth and Portland'
    ]
  },
  {
    date: '2019-04-01',
    newCouncil: 'Somerset West and Taunton',
    abolished: ['Taunton Deane', 'West Somerset']
  },
  {
    date: '2019-04-01',
    newCouncil: 'East Suffolk',
    abolished: ['Suffolk Coastal', 'Waveney']
  },
  {
    date: '2019-04-01',
    newCouncil: 'West Suffolk',
    abolished: ['Forest Heath', 'St Edmundsbury']
  },
  // 2020
  {
    date: '2020-04-01',
    newCouncil: 'Buckinghamshire',
    abolished: [
      'Buckinghamshire (county)',
      'Aylesbury Vale',
      'Chiltern',
      'South Bucks',
      'Wycombe'
    ]
  },
  // 2021
  {
    date: '2021-04-01',
    newCouncil: 'North Northamptonshire',
    abolished: ['Corby', 'East Northamptonshire', 'Kettering', 'Wellingborough']
  },
  {
    date: '2021-04-01',
    newCouncil: 'West Northamptonshire',
    abolished: ['Daventry', 'Northampton', 'South Northamptonshire']
  },
  // 2023
  {
    date: '2023-04-01',
    newCouncil: 'Cumberland',
    abolished: ['Allerdale', 'Carlisle', 'Copeland']
  },
  {
    date: '2023-04-01',
    newCouncil: 'Westmorland and Furness',
    abolished: ['Barrow-in-Furness', 'Eden', 'South Lakeland']
  },
  {
    date: '2023-04-01',
    newCouncil: 'North Yorkshire',
    abolished: [
      'North Yorkshire (county)',
      'Craven',
      'Hambleton',
      'Harrogate',
      'Richmondshire',
      'Ryedale',
      'Scarborough',
      'Selby'
    ]
  },
  {
    date: '2023-04-01',
    newCouncil: 'Somerset',
    abolished: [
      'Somerset (county)',
      'Mendip',
      'Sedgemoor',
      'Somerset West and Taunton',
      'South Somerset'
    ]
  },
  // Surrey LGR — the 2-tier county is split into two new unitaries that
  // polled for the first time on 2026-05-07. The 11 boroughs are
  // abolished alongside Surrey CC; the boroughs split geographically
  // between the two new unitaries (verified against the May 2026 ward
  // lists DC published — every East Surrey ward sits in one of Elmbridge,
  // Epsom & Ewell, Mole Valley, Reigate & Banstead or Tandridge; every
  // West Surrey ward in Guildford, Runnymede, Spelthorne, Surrey Heath,
  // Waverley or Woking). Surrey (county) is listed under both new
  // unitaries because it's split between them; reorganisationIndex
  // merges the counterparts so /surrey shows both as successors.
  {
    date: '2026-04-01',
    newCouncil: 'East Surrey',
    abolished: [
      'Surrey (county)',
      'Elmbridge',
      'Epsom and Ewell',
      'Mole Valley',
      'Reigate and Banstead',
      'Tandridge'
    ]
  },
  {
    date: '2026-04-01',
    newCouncil: 'West Surrey',
    abolished: [
      'Surrey (county)',
      'Guildford',
      'Runnymede',
      'Spelthorne',
      'Surrey Heath',
      'Waverley',
      'Woking'
    ]
  }
];

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/\s*\(county\)\s*$/i, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns a Map<councilSlug, { event: 'created' | 'abolished', date,
 * counterparts[], year }> covering every council touched by a known
 * reorganisation in our window.
 *
 * If the same slug is both abolished (the old county) and then created
 * again (the new unitary inheriting the geographical name —
 * Buckinghamshire, Dorset, Somerset, North Yorkshire), the 'created'
 * event wins, since that's what readers visiting /[slug] today are
 * looking at.
 */
export function reorganisationIndex() {
  const out = new Map();
  // Pass 1: insert abolished events. When the same abolished slug is
  // referenced by multiple new unitaries (Surrey CC was split between
  // East Surrey and West Surrey), merge the counterparts so the
  // resulting entry lists every successor.
  for (const r of REORGANISATIONS) {
    for (const old of r.abolished) {
      const oldSlug = slugify(old);
      const existing = out.get(oldSlug);
      if (existing && existing.event === 'abolished') {
        if (!existing.counterparts.includes(r.newCouncil)) {
          existing.counterparts.push(r.newCouncil);
        }
        continue;
      }
      out.set(oldSlug, {
        councilSlug: oldSlug,
        councilName: old,
        event: 'abolished',
        date: r.date,
        year: Number(r.date.slice(0, 4)),
        counterparts: [r.newCouncil]
      });
    }
  }
  // Pass 2: insert created events (overwrite abolished where the slug
  // is the same — the slug refers to the new unitary now)
  for (const r of REORGANISATIONS) {
    const newSlug = slugify(r.newCouncil);
    out.set(newSlug, {
      councilSlug: newSlug,
      councilName: r.newCouncil,
      event: 'created',
      date: r.date,
      year: Number(r.date.slice(0, 4)),
      counterparts: r.abolished
    });
  }
  return out;
}
