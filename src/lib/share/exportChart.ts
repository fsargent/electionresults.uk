// Square (1080×1080) PNG export for chart elements, intended for social
// sharing. Rasterises the source chart with html-to-image (lazy-loaded
// so the lib stays out of the initial bundle), then composites onto a
// 2× canvas with a hard-coded light-theme palette + title + footer so
// the exported image is consistent regardless of the visitor's OS theme.

const SIZE = 1080;          // logical square edge
const SCALE = 2;            // export at 2× for retina + social recompression
const CANVAS_PX = SIZE * SCALE;

// Hard-coded to the site's light palette. Social previews don't honour
// prefers-color-scheme and we want a single recognisable look.
const BG = '#f6f5ee';
const FG = '#1a1a1a';
const MUTED = '#5a5a5a';
const ACCENT = '#0b3d2e';
const RULE = '#d8d4c4';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif";
const SERIF_STACK = "Georgia, 'Times New Roman', serif";

export interface ExportChartOptions {
  /** The chart node to capture. Can be SVG or HTML. */
  source: HTMLElement | SVGElement;
  /** Optional metric/year-span context, rendered in the card footer. */
  subtitle?: string;
  /** Download filename without extension. */
  filename: string;
}

/** Render the given chart node as a 1080×1080 PNG and trigger download. */
export async function exportChartAsPng(opts: ExportChartOptions): Promise<void> {
  // Largest physical dimension the chart bitmap will need to fill on
  // the share card. The slot spans the full inner width (1080 - 120 =
  // 960 logical px) at 2× — anything smaller than this would force a
  // blurry upscale during composite.
  const targetMaxPhysical = (SIZE - 120) * SCALE;
  const chartBitmap = await rasteriseSource(opts.source, targetMaxPhysical);
  const blob = await composeShareCard(chartBitmap, opts);
  triggerDownload(blob, `${opts.filename}.png`);
}

async function rasteriseSource(
  source: HTMLElement | SVGElement,
  targetMaxPhysical: number
): Promise<HTMLImageElement> {
  // Dynamic import keeps html-to-image (~17kb) out of the initial bundle —
  // it only loads when a visitor actually clicks a share button.
  const { toPng } = await import('html-to-image');

  const rect = source.getBoundingClientRect();
  // Pick a pixelRatio that guarantees the captured bitmap is at least
  // as large as the slot it'll be drawn into. SlopeChart in the grid
  // renders at ~220px wide — at pixelRatio:2 that's a 440px bitmap
  // stretched across a 960px slot, which reads as soft. Compute the
  // ratio from the source's natural size so chart instances at any
  // breakpoint export crisply.
  const maxSourceDim = Math.max(rect.width, rect.height, 1);
  const pixelRatio = Math.max(SCALE, Math.ceil(targetMaxPhysical / maxSourceDim));

  const dataUrl = await toPng(source as HTMLElement, {
    width: rect.width,
    height: rect.height,
    pixelRatio,
    cacheBust: true,
    // Force the light palette so dark-mode users still get the branded
    // look. html-to-image draws onto a transparent surface by default;
    // the explicit background also ensures rule lines that use
    // theme-aware colours composite correctly.
    backgroundColor: BG,
    // Skip cross-origin web fonts / external stylesheets — we only use
    // the system stack, which html-to-image can resolve directly.
    skipFonts: true,
    // Strip the share button itself out of the capture — it lives
    // inside the chart figure for layout reasons, but should never
    // appear in the exported image.
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      if (node.classList?.contains('share-btn')) return false;
      return true;
    }
  });

  return await loadImage(dataUrl);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function composeShareCard(
  chart: HTMLImageElement,
  opts: ExportChartOptions
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context');

  // Render at 2× — set the transform once and use logical units below.
  ctx.scale(SCALE, SCALE);

  // Background.
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const HPAD = 48;
  const TOP = 36;
  const BOTTOM = SIZE - 36;

  // Footer band: subtitle (year-span / metric context) on the left,
  // wordmark on the right. The chart carries its own title so we don't
  // repeat it; the only brand mark on the card is the right-aligned
  // wordmark below the rule.
  const footerTop = BOTTOM - 36;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(HPAD, footerTop);
  ctx.lineTo(SIZE - HPAD, footerTop);
  ctx.stroke();

  if (opts.subtitle) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 18px ${FONT_STACK}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(opts.subtitle, HPAD, footerTop + 14);
  }

  ctx.fillStyle = ACCENT;
  ctx.font = `600 18px ${FONT_STACK}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillText('electionresults.uk', SIZE - HPAD, footerTop + 14);
  ctx.textAlign = 'left';

  // Chart slot — fills almost everything between the top edge and the
  // footer band. No top wordmark anymore, so the slot starts near the
  // top with just enough breathing room not to feel cramped.
  const slotTop = TOP;
  const slotBottom = footerTop - 20;
  const slotH = slotBottom - slotTop;
  const slotW = SIZE - HPAD * 2;

  // Fit chart inside slot preserving aspect ratio.
  const chartAspect = chart.width / chart.height;
  const slotAspect = slotW / slotH;
  let drawW: number;
  let drawH: number;
  if (chartAspect > slotAspect) {
    drawW = slotW;
    drawH = slotW / chartAspect;
  } else {
    drawH = slotH;
    drawW = slotH * chartAspect;
  }
  const drawX = HPAD + (slotW - drawW) / 2;
  const drawY = slotTop + (slotH - drawH) / 2;
  ctx.drawImage(chart, drawX, drawY, drawW, drawH);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png'
    );
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give Safari a tick to pick up the click before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
