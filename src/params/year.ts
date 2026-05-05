import type { ParamMatcher } from '@sveltejs/kit';

/** Matches a 4-digit year, e.g. 2025. Used to disambiguate /[year] from /[council]. */
export const match: ParamMatcher = (param) => /^\d{4}$/.test(param);
