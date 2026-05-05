export function pct(v: number, digits = 1): string {
  if (!isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number): string {
  if (!isFinite(v)) return '—';
  return v.toLocaleString('en-GB');
}
