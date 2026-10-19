import { expect, test } from 'vitest';
import sharp from 'sharp';
import { getDocument, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createSheetPdf } from '../src/pdf';
import { makeLayout, mmToPt, PAPERS, PHOTO_SIZES } from '../src/layout';
import { inspectImage } from '../src/photo';

test('independent PDF parser confirms exact MediaBox and every image transform', async () => {
  const jpeg = await sharp({ create: { width: 413, height: 531, channels: 3, background: '#528578' } }).jpeg().toBuffer();
  for (const paper of [...Object.values(PAPERS), { width: 297, height: 210 }, { width: 83, height: 120 }]) {
    for (const photo of [PHOTO_SIZES['35x45'], { width: 45, height: 35 }]) {
      const layout = makeLayout(paper, photo, 8, 3, null);
      const bytes = await createSheetPdf(jpeg, layout, true, true);
      const task = getDocument({ data: bytes, useSystemFonts: true });
      const doc = await task.promise;
      expect(doc.numPages).toBe(1);
      const page = await doc.getPage(1);
      expect(page.view).toEqual([0, 0, mmToPt(paper.width), mmToPt(paper.height)]);
      const ops = await page.getOperatorList();
      const transforms: number[][] = [];
      let transform = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === OPS.save) stack.push([...transform]);
        if (ops.fnArray[i] === OPS.restore) transform = stack.pop()!;
        if (ops.fnArray[i] === OPS.transform) transform = Util.transform(transform, ops.argsArray[i]);
        if (ops.fnArray[i] === OPS.paintImageXObject) transforms.push([...transform]);
      }
      expect(transforms).toHaveLength(layout.placements.length);
      for (const [i, p] of layout.placements.entries()) {
        const t = transforms[i];
        expect(Math.hypot(t[0], t[1])).toBeCloseTo(mmToPt(photo.width), 7);
        expect(Math.hypot(t[2], t[3])).toBeCloseTo(mmToPt(photo.height), 7);
        expect(t[4]).toBeCloseTo(mmToPt(p.x + (layout.rotated ? p.width : 0)), 7);
        expect(t[5]).toBeCloseTo(mmToPt(paper.height - p.y - p.height), 7);
        expect(t[1]).toBeCloseTo(layout.rotated ? mmToPt(photo.width) : 0, 7);
      }
      await task.destroy();
    }
  }
});
test('sniffs all supported formats and enforces ruler space', async () => {
  const source = sharp({ create: { width: 31, height: 47, channels: 3, background: '#abcd12' } });
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const bytes = await source.clone().toFormat(format).toBuffer();
    expect(inspectImage(bytes).size).toEqual({ width: 31, height: 47 });
  }
  const jpeg = await source.jpeg().toBuffer();
  await expect(createSheetPdf(jpeg, makeLayout(PAPERS.a4, PHOTO_SIZES['35x45'], 0, 0, 1), false, true)).rejects.toThrow('ruler');
});
