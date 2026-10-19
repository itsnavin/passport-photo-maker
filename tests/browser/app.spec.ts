import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function sample(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try a synthetic sample' }).click();
  await expect(page.locator('#upload-status')).toContainText('Photo ready');
}
test('local sample, keyboard crop, paper layout and actual downloaded files', async ({ page, baseURL }) => {
  const errors: string[] = [], external: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => {
    if (req.url().startsWith('data:') || req.url().startsWith('blob:')) return;
    const url = new URL(req.url());
    // An explicit local-only override identifies OS-injected traffic, never app dependencies.
    if (process.env.TEST_INJECTOR_HOST && url.hostname === process.env.TEST_INJECTOR_HOST) {
      test.info().annotations.push({ type: 'environment-injected-request', description: url.hostname });
    } else if (url.origin !== origin) external.push(req.url());
  });
  await sample(page);
  await expect(page.locator('#source-info')).toContainText('1000 × 1200');
  const canvas = page.locator('#crop');
  await canvas.focus();
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#zoom-value')).toHaveText('1.05×');
  await expect(page.locator('#position-x')).toHaveValue('0.52');
  await page.getByRole('button', { name: 'Center crop' }).click();
  await page.locator('#paper').selectOption('4x6');
  await expect(page.locator('#paper-badge')).toHaveText('101.6 × 152.4 mm');
  await page.locator('#orientation').selectOption('landscape');
  await expect(page.locator('#paper-badge')).toHaveText('152.4 × 101.6 mm');
  await page.locator('#ruler').check();
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download print sheet' }).click();
  const pdf = await pdfDownload;
  const pdfPath = await pdf.path();
  const task = getDocument({ data: new Uint8Array(await readFile(pdfPath!)), useSystemFonts: true });
  const doc = await task.promise;
  const pdfPage = await doc.getPage(1);
  expect(pdfPage.view[2]).toBeCloseTo(152.4 * 72 / 25.4, 7);
  expect(pdfPage.view[3]).toBeCloseTo(101.6 * 72 / 25.4, 7);
  const ops = await pdfPage.getOperatorList();
  const images = ops.fnArray.filter(op => op === OPS.paintImageXObject);
  expect(images.length).toBeGreaterThan(0);
  const summary = await page.locator('#layout-summary').innerText();
  expect(summary).toMatch(new RegExp(`^${images.length} copies`));
  await task.destroy();
  const singleDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download single photo' }).click();
  const jpg = await singleDownload;
  const metadata = await sharp(await readFile((await jpg.path())!)).metadata();
  expect(metadata.width).toBe(413); expect(metadata.height).toBe(531);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('#pdf')).toBeDisabled();
  await expect(page.locator('#upload-status')).toContainText('Cleared');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('invalid images, low resolution, overflow and input errors are explicit', async ({ page }) => {
  await page.goto('./');
  for (const [name, mimeType, buffer] of [
    ['fake.svg', 'image/svg+xml', Buffer.from('<svg onload="window.bad=true"></svg>')],
    ['photo.heic', 'image/heic', Buffer.from('ftypheic')],
    ['fake.png', 'image/png', Buffer.from('this is not a png')],
  ] as const) {
    await page.locator('#upload').setInputFiles({ name, mimeType, buffer });
    await expect(page.locator('#upload-status')).toContainText('not a supported');
    await expect(page.locator('#pdf')).toBeDisabled();
  }
  const png = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#abc123' } }).png().toBuffer();
  await page.locator('#upload').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#quality')).toContainText('Low-resolution warning');
  await page.locator('#count-mode').selectOption('count');
  await page.locator('#count').fill('500');
  await expect(page.locator('#error')).toContainText('Only');
  await expect(page.locator('#pdf')).toBeDisabled();
  await page.locator('#count-mode').selectOption('max');
  await page.locator('#paper').selectOption('custom');
  await page.locator('#paper-width').fill('215.9');
  await expect(page.locator('#error')).toContainText('A4');
  await page.locator('#paper-width').fill('');
  await expect(page.locator('#error')).toContainText('Paper width');
  await page.locator('#paper-width').fill('25');
  await page.locator('#paper-height').fill('25');
  await expect(page.locator('#error')).toContainText('No photo fits');
});
test('EXIF orientation is applied exactly once; safe dimensions before decode', async ({ page }) => {
  await page.goto('./');
  const source = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#e61919' } })
    .composite([{ input: await sharp({ create: { width: 40, height: 40, channels: 3, background: '#1826e6' } }).png().toBuffer(), left: 40, top: 0 }])
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
  await page.locator('#upload').setInputFiles({ name: 'rotated.jpg', mimeType: 'image/jpeg', buffer: source });
  await expect(page.locator('#source-info')).toContainText('40 × 80');
  const colors = await page.locator('#crop').evaluate((element: HTMLCanvasElement) => {
    const c = element.getContext('2d')!;
    return [Array.from(c.getImageData(element.width / 2, 5, 1, 1).data), Array.from(c.getImageData(element.width / 2, element.height - 5, 1, 1).data)];
  });
  expect(colors[0][0]).toBeGreaterThan(colors[0][2]);
  expect(colors[1][2]).toBeGreaterThan(colors[1][0]);
  const hugeHeader = Buffer.alloc(33);
  Buffer.from('\x89PNG\r\n\x1a\n', 'latin1').copy(hugeHeader);
  hugeHeader.write('IHDR', 12); hugeHeader.writeUInt32BE(20000, 16); hugeHeader.writeUInt32BE(20000, 20);
  await page.locator('#upload').setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: hugeHeader });
  await expect(page.locator('#upload-status')).toContainText('safety limits');
});
test('pointer crop and clear during decode do not restore stale state', async ({ page }) => {
  await sample(page);
  await page.locator('#zoom').fill('2');
  const box = await page.locator('#crop').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 30, box!.y + box!.height / 2 + 20);
  await page.mouse.up();
  expect(Number(await page.locator('#position-x').inputValue())).toBeLessThan(0.5);
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => new Promise<ImageBitmap>((resolve, reject) => {
      setTimeout(() => { Reflect.apply(original, window, args).then(resolve, reject); }, 250);
    })) as typeof createImageBitmap;
  });
  const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ededed' } }).png().toBuffer();
  await page.locator('#upload').setInputFiles({ name: 'slow.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('#pdf')).toBeDisabled();
  await expect(page.locator('#source-info')).not.toContainText('100 × 100');
});
test('WebP decode, touch crop, custom size and selected export DPI', async ({ page, isMobile }) => {
  await page.goto('./');
  const webp = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#248274' } }).webp().toBuffer();
  await page.locator('#upload').setInputFiles({ name: 'sample.webp', mimeType: 'image/webp', buffer: webp });
  await expect(page.locator('#source-info')).toContainText('900 × 1200');
  await page.locator('#zoom').fill('2');
  if (isMobile) {
    const crop = page.locator('#crop');
    await crop.scrollIntoViewIfNeeded();
    const box = await crop.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 25, y: start.y + 20 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.locator('#position-x').fill('0.4');
  }
  expect(Number(await page.locator('#position-x').inputValue())).toBeLessThan(0.5);
  await page.locator('#photo-preset').selectOption('custom');
  await page.locator('#photo-width').fill('40');
  await page.locator('#photo-height').fill('50');
  await page.locator('#dpi').selectOption('600');
  const event = page.waitForEvent('download');
  await page.locator('#single').click();
  const metadata = await sharp(await readFile((await (await event).path())!)).metadata();
  expect(metadata.width).toBe(945);
  expect(metadata.height).toBe(1181);
  await page.locator('#dpi').selectOption('custom');
  await page.locator('#custom-dpi').fill('601');
  await expect(page.locator('#error')).toContainText('Export DPI');
  await expect(page.locator('#pdf')).toBeDisabled();
});
