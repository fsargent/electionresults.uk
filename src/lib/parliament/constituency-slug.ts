/**
 * Normalise a Westminster constituency name into the slug form used by
 * the parliament ETL (`constituencySlug` on every IngestedConstituency).
 *
 * NFD-decomposes diacritics and strips combining marks so source-data
 * names like "Glyndŵr", "Ynys Môn", and "Queen's Park" all collapse to
 * the same kebab form the ETL produces. Verified to round-trip 650 / 650
 * constituencies against both:
 *   - the Open Innovations 2023 hex JSON (used by ConstituencyHexMap)
 *   - postcodes.io's `parliamentary_constituency_2024` field
 *
 * Keep the only canonical slugifier here — both consumers import this
 * to avoid drift.
 */
export function constituencyNameToSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
