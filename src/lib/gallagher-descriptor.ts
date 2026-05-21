/**
 * Plain-language label for a Gallagher disproportionality index value.
 * Numeric bands match the usual academic interpretation:
 *
 *   0–2   nearly proportional (well-functioning PR system)
 *   2–5   mildly disproportional
 *   5–10  moderately disproportional
 *   10–15 highly disproportional (typical FPTP at general elections)
 *   15–25 severely disproportional (UK GE 2024 sits ~23)
 *   25+   extremely disproportional
 *
 * Used in headline KPI tiles and audit summary tables so a
 * non-specialist reader gets the editorial framing without needing to
 * know what the index measures. Numeric value should be shown
 * alongside, parenthesised, for readers who do.
 */
export function gallagherDescriptor(g: number): string {
  if (g < 2) return 'Near-proportional';
  if (g < 5) return 'Mildly disproportional';
  if (g < 10) return 'Moderately disproportional';
  if (g < 15) return 'Highly disproportional';
  if (g < 25) return 'Severely disproportional';
  return 'Extremely disproportional';
}
