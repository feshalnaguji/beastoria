/**
 * Postcard image compositing (G2 Task 5): the live Pixi frame (Renderer.snapshot())
 * framed onto a cream paper card with a caption and the share link — spec §2:
 * no names are ever drawn onto it, only the day count and the bare link.
 */
const WIDTH = 1200, BORDER = 24, CAPTION_H = 72;
const PAPER = '#f6f2e7', INK = '#3a4a33', INK_SOFT = '#6b7a5e';

export function buildPostcard(frame: HTMLCanvasElement, caption: string, linkText: string): HTMLCanvasElement {
  const innerW = WIDTH - BORDER * 2;
  const innerH = Math.round((frame.height / frame.width) * innerW);
  const out = document.createElement('canvas');
  out.width = WIDTH;
  out.height = innerH + BORDER * 2 + CAPTION_H;
  const g = out.getContext('2d')!;
  g.fillStyle = PAPER; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(frame, BORDER, BORDER, innerW, innerH);
  g.fillStyle = INK; g.font = '600 30px Georgia, serif'; g.textBaseline = 'middle';
  g.fillText(caption, BORDER, innerH + BORDER + CAPTION_H / 2);
  g.fillStyle = INK_SOFT; g.font = '22px Georgia, serif'; g.textAlign = 'right';
  g.fillText(linkText, WIDTH - BORDER, innerH + BORDER + CAPTION_H / 2);
  return out;
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
