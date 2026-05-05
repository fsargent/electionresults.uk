/**
 * Sequential colour scale for "share of seats elected below the proportional
 * quota". Anchored on the cream / accent-warn palette already used elsewhere
 * on the site so the choropleth doesn't introduce a new visual identity.
 *
 *   0%  → #f5e9d6  (very light cream — almost no below-quota seats)
 *   33% → #e9b67a
 *   66% → #d27b48
 * 100%  → #b94a2c  (the --warn red used everywhere else)
 */

const STOPS = [
  { t: 0, color: [245, 233, 214] },
  { t: 0.33, color: [233, 182, 122] },
  { t: 0.66, color: [210, 123, 72] },
  { t: 1, color: [185, 74, 44] }
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function belowQuotaColor(share: number): string {
  if (!isFinite(share)) return '#cccccc';
  const t = Math.max(0, Math.min(1, share));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].t) {
      const lo = STOPS[i - 1];
      const hi = STOPS[i];
      const localT = (t - lo.t) / (hi.t - lo.t);
      return rgbToHex(
        lerp(lo.color[0], hi.color[0], localT),
        lerp(lo.color[1], hi.color[1], localT),
        lerp(lo.color[2], hi.color[2], localT)
      );
    }
  }
  return rgbToHex(...(STOPS[STOPS.length - 1].color as [number, number, number]));
}
