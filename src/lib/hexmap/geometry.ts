// Hex-cartogram geometry helpers (odd-r layout).
// Adapted from proportional.uk's hexmap module.

export const HEX_SIZE = 14;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const HEX_HEIGHT = HEX_SIZE * 2;

export interface HexPosition {
  q: number;
  r: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

/** Convert odd-r offset coordinates to pixel coordinates. */
export function oddRToPixel(
  q: number,
  r: number,
  size = HEX_SIZE
): PixelPosition {
  const x = Math.sqrt(3) * size * (q + 0.5 * (r & 1));
  const y = size * 1.5 * -r; // negate so larger r is up the screen
  return { x, y };
}

/** Six corner points for a flat-side-up hexagon centred at (x, y). */
export function hexCorners(
  x: number,
  y: number,
  size = HEX_SIZE
): PixelPosition[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return { x: x + size * Math.cos(angle), y: y + size * Math.sin(angle) };
  });
}

/** SVG `points` attribute for a hexagon centred at (x, y). */
export function hexPolygonPoints(
  x: number,
  y: number,
  size = HEX_SIZE
): string {
  return hexCorners(x, y, size)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

/**
 * Project a list of (q, r) hexes to pixel coordinates and translate so
 * everything fits in a positive-coordinate viewport with `padding` pixels
 * around the edge. Returns positions plus the SVG width and height.
 */
export function layoutHexes<T extends HexPosition & { id: string }>(
  hexes: T[],
  size = HEX_SIZE,
  padding = size * 1.5
): {
  positions: Array<T & PixelPosition>;
  width: number;
  height: number;
} {
  const projected = hexes.map((h) => ({
    ...h,
    ...oddRToPixel(h.q, h.r, size)
  }));
  if (projected.length === 0) {
    return { positions: projected, width: 0, height: 0 };
  }
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const positions = projected.map((p) => ({
    ...p,
    x: p.x - minX + padding,
    y: p.y - minY + padding
  }));
  return {
    positions,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  };
}
