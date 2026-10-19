import { bounded, mmToPx, type Size } from './layout';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 40_000_000;
export const MAX_SOURCE_EDGE = 16000;
export const MAX_EXPORT_PIXELS = 20_000_000;
export type Crop = { x: number; y: number; width: number; height: number };

export function cropRect(source: Size, aspect: number, zoom: number, x: number, y: number): Crop {
  bounded(zoom, 1, 4, 'Zoom');
  bounded(x, 0, 1, 'Horizontal position');
  bounded(y, 0, 1, 'Vertical position');
  const width = Math.min(source.width, source.height * aspect) / zoom;
  const height = width / aspect;
  return { x: (source.width - width) * x, y: (source.height - height) * y, width, height };
}
export function effectiveDpi(crop: Crop, photo: Size): number {
  return Math.min(crop.width * 25.4 / photo.width, crop.height * 25.4 / photo.height);
}

// Read dimensions before decoding so a compressed oversized image cannot allocate a huge bitmap.
export function inspectImage(bytes: Uint8Array): { type: string; size: Size } {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length >= 33 && ascii(0, 8) === '\x89PNG\r\n\x1a\n' && ascii(12, 4) === 'IHDR') {
    return { type: 'image/png', size: { width: data.getUint32(16), height: data.getUint32(20) } };
  }
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8X') return { type: 'image/webp', size: {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    } };
    if (chunk === 'VP8 ' && bytes.length >= 30 && ascii(23, 3) === '\x9d\x01\x2a') {
      return { type: 'image/webp', size: { width: data.getUint16(26, true) & 0x3fff, height: data.getUint16(28, true) & 0x3fff } };
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const bits = data.getUint32(21, true);
      return { type: 'image/webp', size: { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 } };
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let p = 2;
    while (p + 4 <= bytes.length) {
      if (bytes[p++] !== 0xff) break;
      while (bytes[p] === 0xff) p++;
      const marker = bytes[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (p + 2 > bytes.length) break;
      const length = data.getUint16(p);
      if (length < 2 || p + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        return { type: 'image/jpeg', size: { width: data.getUint16(p + 5), height: data.getUint16(p + 3) } };
      }
      p += length;
    }
  }
  throw new Error('This file is not a supported JPEG, PNG or WebP image. Convert HEIC/HEIF or other formats to JPEG or PNG first.');
}
export async function decodePhoto(file: File): Promise<ImageBitmap> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Choose a nonempty image of 25 MB or less.');
  const info = inspectImage(new Uint8Array(await file.arrayBuffer()));
  const { width, height } = info.size;
  if (!width || !height || width * height > MAX_SOURCE_PIXELS || Math.max(width, height) > MAX_SOURCE_EDGE) {
    throw new Error('Image exceeds browser safety limits: 40 megapixels and 16,000 pixels per edge. Resize it before opening.');
  }
  let bitmap: ImageBitmap;
  try {
    // The browser decoder applies EXIF orientation once; no second manual transform.
    bitmap = await createImageBitmap(new Blob([file], { type: info.type }), { imageOrientation: 'from-image' });
  } catch {
    throw new Error('The browser could not decode this image. It may be damaged or unsupported. Re-save it as JPEG or PNG.');
  }
  if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS || Math.max(bitmap.width, bitmap.height) > MAX_SOURCE_EDGE) {
    bitmap.close();
    throw new Error('Decoded image exceeds browser safety limits. Resize it before opening.');
  }
  return bitmap;
}
export function exportDimensions(photo: Size, dpi: number): Size {
  bounded(dpi, 72, 600, 'Export DPI');
  const width = mmToPx(photo.width, dpi);
  const height = mmToPx(photo.height, dpi);
  if (width * height > MAX_EXPORT_PIXELS || Math.max(width, height) > 8192) {
    throw new Error('Export exceeds the 20 megapixel / 8,192 pixel canvas limit. Reduce photo size or DPI.');
  }
  return { width, height };
}
export function renderCrop(bitmap: ImageBitmap, crop: Crop, output: Size): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot create a drawing canvas.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
export async function canvasBlob(canvas: HTMLCanvasElement, type = 'image/jpeg'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Image export failed. Try reducing DPI.')), type, 0.95,
  ));
}
