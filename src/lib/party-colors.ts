/**
 * Hex colour for a party, by canonical full name as it appears in the LEH
 * source data. The major UK parties get their established brand colours;
 * smaller parties get reasonable defaults. Unknown parties fall through to
 * a neutral grey via the heuristic in `partyColor`.
 *
 * Sources used for the canonical hexes:
 *   - Conservative, Labour, Lib Dem, Green: established UK brand colours
 *     (Wikipedia "Political colour" infobox, cross-referenced with each
 *     party's own style guide where one is published).
 *   - Reform UK: party brand teal.
 *   - Independents: neutral grey, since "Independent" is a non-affiliation
 *     rather than a political identity.
 */
const PARTY_COLORS: Record<string, string> = {
  'Conservative and Unionist Party': '#0087DC',
  'Labour Party': '#E4003B',
  'Labour and Co-operative Party': '#E4003B',
  'Liberal Democrats': '#FAA61A',
  'The Liberal Party': '#FFB100',
  'Green Party': '#6AB023',
  'Reform UK': '#12B6CF',
  'UK Independence Party (UKIP)': '#70147A',
  'Social Democratic Party': '#5784D7',

  Independent: '#888888',

  // Cornish nationalist
  'Mebyon Kernow - The Party for Cornwall': '#F7D038',

  // Left-of-Labour / socialist bloc
  'Trade Unionist and Socialist Coalition': '#C41E3A',
  'Workers Party of Britain': '#C41E3A',
  'Communist Party of Britain': '#C41E3A',
  'Socialist Labour Party': '#C41E3A',
  'The Socialist Party of Great Britain': '#C41E3A',
  'Oxford Community Socialists': '#C41E3A',

  // Right of Conservative / nativist
  'Heritage Party': '#5C4033',
  'Homeland Party': '#5C4033',
  'English Democrats': '#5C4033',
  'British Democratic Party': '#5C4033',
  'National Front': '#5C4033',
  'National Housing Party United Kingdom': '#5C4033',

  // Single-issue / fringe
  'Animal Welfare Party': '#7DAF53',
  'Christian Peoples Alliance': '#FFD700',
  'Party Of Women': '#9C27B0',
  'The Official Monster Raving Loony Party': '#FFEB3B',
  'Libertarian Party': '#FFC107',
  'Freedom Alliance': '#FFC107',
  'Alliance for Democracy and Freedom': '#FFC107',
  'Blue Revolution': '#1E90FF',
  Majority: '#999999',
  Transform: '#999999',
  'Transform Party': '#999999',

  // Tower Hamlets-based party associated with Lutfur Rahman; often appears
  // in the source data under its shortcode "ASP" (see PARTY_DISPLAY_NAMES).
  Aspire: '#7B2D8E'
};

/**
 * Map source-data shortcodes to their proper display names. The LEH source
 * data uses inconsistent shortcodes for many smaller parties; this map
 * canonicalises them at render time. Add entries here as you encounter
 * abbreviations in the data — many are still uncanonicalised
 * (AEF, AFP, AWA, BCP, etc. as of 2026-05). Both `partyColor` and
 * `partyDisplayName` consult this map, so a new entry only needs the
 * shortcode → real-name mapping plus (optionally) a colour for the real
 * name in PARTY_COLORS.
 */
const PARTY_DISPLAY_NAMES: Record<string, string> = {
  ASP: 'Aspire'
};

/**
 * Resolve a (possibly abbreviated) source-data party name to its display
 * name. Falls through to the input unchanged when no mapping exists, so
 * full canonical names like "Labour Party" pass through untouched.
 */
export function partyDisplayName(name: string | null | undefined): string {
  if (!name) return 'Unknown';
  return PARTY_DISPLAY_NAMES[name] ?? name;
}

/**
 * Resolve a party name to a swatch colour.
 * Falls through to grey shades for unmapped local groupings; this is
 * deliberately conservative so we never accidentally imply a party
 * affiliation we can't verify.
 */
export function partyColor(name: string | null | undefined): string {
  if (!name) return '#999999';
  const canonical = partyDisplayName(name);
  const direct = PARTY_COLORS[canonical];
  if (direct) return direct;

  // Lightweight heuristics for unknown local groupings — keeps the chart
  // monochrome rather than guessing wrong on red/blue spectrum.
  if (/independent/i.test(canonical)) return '#888888';
  if (/residents|alliance|first|community|borough|group|local/i.test(canonical))
    return '#A8A8A8';

  return '#999999';
}
