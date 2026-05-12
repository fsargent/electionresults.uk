import type { ParamMatcher } from '@sveltejs/kit';
import { partySlugs } from '$lib/data';

const VALID = new Set(partySlugs());

/** Matches one of the seven major-party slugs (labour, conservative,
 *  liberal-democrats, green, reform, snp, plaid-cymru). Disambiguates
 *  /[party] from /[council]. */
export const match: ParamMatcher = (param) => VALID.has(param);
