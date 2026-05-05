export function pct(v: number, digits = 1): string {
  if (!isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number): string {
  if (!isFinite(v)) return '—';
  return v.toLocaleString('en-GB');
}

/**
 * Render a difference of fractions (e.g. underPar) as percentage points,
 * with an explicit sign so the reader can tell above vs below par at a glance.
 */
export function pts(v: number, digits = 1): string {
  if (!isFinite(v)) return '—';
  const points = v * 100;
  if (Math.abs(points) < 0.05) return '0.0 pts';
  const sign = points > 0 ? '+' : '−';
  return `${sign}${Math.abs(points).toFixed(digits)} pts`;
}
