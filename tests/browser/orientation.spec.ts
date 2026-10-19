import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('all eight EXIF orientations, including mirrors, map pixels exactly once', async ({ page }) => {
  const colors = ['#f02020', '#20d020', '#2020f0', '#e0d020'];
  const tiles = await Promise.all(colors.map(background => sharp({ create: { width: 40, height: 20, channels: 3, background } }).png().toBuffer()));
  const base = sharp({ create: { width: 80, height: 40, channels: 3, background: '#ffffff' } }).composite(tiles.map((tile, i) => ({
    input: tile, left: i % 2 * 40, top: Math.floor(i / 2) * 20,
  })));
  const expected = [
    [0, 1, 2, 3], [1, 0, 3, 2], [3, 2, 1, 0], [2, 3, 0, 1],
    [0, 2, 1, 3], [2, 0, 3, 1], [3, 1, 2, 0], [1, 3, 0, 2],
  ];
  await page.goto('./');
  await page.locator('#photo-preset').selectOption('custom');
  for (let orientation = 1; orientation <= 8; orientation++) {
    const swapped = orientation >= 5;
    await page.locator('#photo-width').fill(swapped ? '20' : '40');
    await page.locator('#photo-height').fill(swapped ? '40' : '20');
    const jpeg = await base.clone().jpeg({ quality: 100 }).withMetadata({ orientation }).toBuffer();
    await page.locator('#upload').setInputFiles({ name: `orientation-${orientation}.jpg`, mimeType: 'image/jpeg', buffer: jpeg });
    await expect(page.locator('#source-info')).toContainText(swapped ? '40 × 80' : '80 × 40');
    const pixels = await page.locator('#crop').evaluate((element: HTMLCanvasElement) => {
      const ctx = element.getContext('2d')!, w = element.width, h = element.height;
      return [[5, 5], [w - 6, 5], [5, h - 6], [w - 6, h - 6]].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3));
    });
    const palette = [[240, 32, 32], [32, 208, 32], [32, 32, 240], [224, 208, 32]];
    const found = pixels.map(pixel => {
      const distances = palette.map(color => color.reduce((distance, channel, i) => distance + (channel - pixel[i]) ** 2, 0));
      return distances.indexOf(Math.min(...distances));
    });
    expect(found, `orientation ${orientation}`).toEqual(expected[orientation - 1]);
  }
});
