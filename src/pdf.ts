import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { mmToPt, type Layout } from './layout';

export async function createSheetPdf(jpeg: Uint8Array, layout: Layout, cutMarks: boolean, ruler: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Photo Sheet - print at actual size');
  doc.setCreator('Photo Sheet (browser-local)');
  const page = doc.addPage([mmToPt(layout.paper.width), mmToPt(layout.paper.height)]);
  const image = await doc.embedJpg(jpeg);
  for (const p of layout.placements) {
    const x = mmToPt(p.x), y = mmToPt(layout.paper.height - p.y - p.height);
    if (layout.rotated) {
      page.drawImage(image, { x: x + mmToPt(p.width), y, width: mmToPt(layout.photo.width), height: mmToPt(layout.photo.height), rotate: degrees(90) });
    } else {
      page.drawImage(image, { x, y, width: mmToPt(p.width), height: mmToPt(p.height) });
    }
    if (cutMarks) {
      const available = Math.min(layout.gap / 2, layout.margin);
      if (available >= 1) {
        const length = Math.min(2, available - 0.5);
        for (const dx of [0, p.width]) for (const dy of [0, p.height]) {
          const cx = p.x + dx, cy = p.y + dy;
          const sx = dx === 0 ? -1 : 1, sy = dy === 0 ? -1 : 1;
          const line = (ax: number, ay: number, bx: number, by: number) => page.drawLine({
            start: { x: mmToPt(ax), y: mmToPt(layout.paper.height - ay) },
            end: { x: mmToPt(bx), y: mmToPt(layout.paper.height - by) },
            thickness: 0.3, color: rgb(0.35, 0.35, 0.35),
          });
          line(cx + sx * 0.5, cy, cx + sx * (0.5 + length), cy);
          line(cx, cy + sy * 0.5, cx, cy + sy * (0.5 + length));
        }
      }
    }
  }
  if (ruler) {
    if (layout.margin < 8 || layout.paper.width < 70) throw new Error('The 50 mm test ruler needs at least an 8 mm margin and 70 mm paper width.');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const x = mmToPt((layout.paper.width - 50) / 2), y = mmToPt(3);
    page.drawLine({ start: { x, y }, end: { x: x + mmToPt(50), y }, thickness: 0.6 });
    for (let i = 0; i <= 5; i++) {
      const xx = x + mmToPt(i * 10);
      page.drawLine({ start: { x: xx, y }, end: { x: xx, y: y + mmToPt(1.5) }, thickness: 0.6 });
    }
    page.drawText('50 mm - check after printing', { x, y: y + mmToPt(2.2), size: 6, font });
  }
  return doc.save();
}
