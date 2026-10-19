import { describe, expect, test } from 'vitest';
import { makeLayout, mmToPt, mmToPx, PAPERS, PHOTO_SIZES } from '../src/layout';
import { cropRect, effectiveDpi, exportDimensions, inspectImage } from '../src/photo';

describe('physical units and uniform layout invariants', () => {
  test('known conversions', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 12);
    expect(mmToPx(25.4, 300)).toBe(300);
    expect(exportDimensions({ width: 35, height: 45 }, 300)).toEqual({ width: 413, height: 531 });
  });
  for (const [paperName, original] of Object.entries(PAPERS)) {
    for (const landscape of [false, true]) for (const [photoName, photo] of Object.entries(PHOTO_SIZES)) {
      for (const margin of [0, 3, 8]) for (const gap of [0, 2, 5]) {
        test(`${paperName} ${landscape ? 'landscape' : 'portrait'} ${photoName} margin=${margin} gap=${gap}`, () => {
          const paper = landscape ? { width: original.height, height: original.width } : original;
          const layout = makeLayout(paper, photo, margin, gap, null);
          expect(layout.placements.length).toBe(layout.capacity);
          const capacity = (w: number, h: number) => Math.max(0, Math.floor((paper.width - 2 * margin + gap + 1e-9) / (w + gap))) * Math.max(0, Math.floor((paper.height - 2 * margin + gap + 1e-9) / (h + gap)));
          expect(layout.capacity).toBe(Math.max(capacity(photo.width, photo.height), capacity(photo.height, photo.width)));
          for (const [i, p] of layout.placements.entries()) {
            expect(p.x).toBeGreaterThanOrEqual(margin - 1e-8);
            expect(p.y).toBeGreaterThanOrEqual(margin - 1e-8);
            expect(p.x + p.width).toBeLessThanOrEqual(paper.width - margin + 1e-8);
            expect(p.y + p.height).toBeLessThanOrEqual(paper.height - margin + 1e-8);
            expect(p.width * p.height).toBeCloseTo(photo.width * photo.height, 8);
            for (const q of layout.placements.slice(i + 1)) {
              expect(p.x + p.width + gap <= q.x + 1e-8 || q.x + q.width + gap <= p.x + 1e-8 || p.y + p.height + gap <= q.y + 1e-8 || q.y + q.height + gap <= p.y + 1e-8).toBe(true);
            }
          }
        });
      }
    }
  }
  test('requested count centered, last partial row centered', () => {
    const layout = makeLayout(PAPERS.a4, PHOTO_SIZES['35x45'], 8, 3, 7);
    expect(layout.placements).toHaveLength(7);
    const last = layout.placements.filter(p => p.y === layout.placements.at(-1)!.y);
    expect(last[0].x).toBeCloseTo(210 - last.at(-1)!.x - last.at(-1)!.width);
  });
  test('rounding boundary and rotation', () => {
    expect(makeLayout({ width: 101.6, height: 152.4 }, PHOTO_SIZES['2x2'], 0, 0, null).capacity).toBe(6);
    const layout = makeLayout({ width: 100, height: 150 }, { width: 35, height: 45 }, 0, 0, null);
    expect(layout.capacity).toBe(8);
    expect(layout.rotated).toBe(true);
  });
  test('rejects overflow, no-fit, invalid and oversized settings', () => {
    for (const paper of [{ width: 215.9, height: 279.4 }, { width: 297, height: 211 }, { width: NaN, height: 297 }]) {
      expect(() => makeLayout(paper, PHOTO_SIZES['35x45'], 8, 3, null)).toThrow();
    }
    for (const count of [0, -1, NaN, Infinity, 1.5, 501, 499]) expect(() => makeLayout(PAPERS.a6, PHOTO_SIZES['35x45'], 8, 3, count)).toThrow();
    for (const margin of [-1, NaN, Infinity, 51, 50]) expect(() => makeLayout(PAPERS.a6, PHOTO_SIZES['35x45'], margin, 3, null)).toThrow();
    expect(() => makeLayout(PAPERS.a4, { width: 210, height: 297 }, 8, 3, null)).toThrow('No photo fits');
    expect(() => makeLayout(PAPERS.a4, PHOTO_SIZES['35x45'], 0, -1, null)).toThrow();
  });
});
test('crop preserves aspect and stays inside the source at every position/zoom', () => {
  for (const source of [{ width: 4000, height: 2000 }, { width: 20, height: 80 }]) {
    for (const zoom of [1, 2, 4]) for (const x of [0, 0.5, 1]) for (const y of [0, 0.5, 1]) {
      const crop = cropRect(source, 35 / 45, zoom, x, y);
      expect(crop.width / crop.height).toBeCloseTo(35 / 45, 12);
      expect(crop.x + crop.width).toBeLessThanOrEqual(source.width + 1e-8);
      expect(crop.y + crop.height).toBeLessThanOrEqual(source.height + 1e-8);
      expect(effectiveDpi(crop, { width: 35, height: 45 })).toBeCloseTo(crop.width * 25.4 / 35);
    }
  }
});
test('rejects unsafe exports and unrecognized image content', () => {
  for (const dpi of [NaN, Infinity, 0, 601]) expect(() => exportDimensions(PHOTO_SIZES['35x45'], dpi)).toThrow();
  expect(() => exportDimensions(PAPERS.a4, 600)).toThrow('Export exceeds');
  for (const text of ['<svg onload="alert(1)"></svg>', 'not an image', 'ftypheic', '']) expect(() => inspectImage(new TextEncoder().encode(text))).toThrow('supported JPEG');
});
