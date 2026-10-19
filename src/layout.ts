export type Size = { width: number; height: number };
export type Placement = { x: number; y: number; width: number; height: number };
export type Layout = {
  paper: Size; photo: Size; margin: number; gap: number; rotated: boolean;
  columns: number; rows: number; capacity: number; placements: Placement[];
};
export const PAPERS: Record<string, Size> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
  '4x6': { width: 101.6, height: 152.4 },
  '10x15': { width: 100, height: 150 },
};
export const PHOTO_SIZES: Record<string, Size> = {
  '35x45': { width: 35, height: 45 },
  '2x2': { width: 50.8, height: 50.8 },
  '30x40': { width: 30, height: 40 },
};
export const mmToPt = (mm: number) => mm * 72 / 25.4;
export const mmToPx = (mm: number, dpi: number) => Math.round(mm * dpi / 25.4);
export function bounded(value: number, min: number, max: number, name: string): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}
export function validatePaper(paper: Size): void {
  bounded(paper.width, 25, 297, 'Paper width (mm)');
  bounded(paper.height, 25, 297, 'Paper height (mm)');
  if (Math.min(paper.width, paper.height) > 210 || Math.max(paper.width, paper.height) > 297) {
    throw new Error('Paper must fit within A4 (210 × 297 mm), allowing rotation.');
  }
}
export function makeLayout(paper: Size, photo: Size, margin: number, gap: number, count: number | null): Layout {
  validatePaper(paper);
  bounded(photo.width, 10, 210, 'Photo width (mm)');
  bounded(photo.height, 10, 297, 'Photo height (mm)');
  bounded(margin, 0, 50, 'Margin (mm)');
  bounded(gap, 0, 20, 'Gap (mm)');
  if (count !== null && (!Number.isInteger(count) || count < 1 || count > 500)) {
    throw new Error('Copies must be a whole number between 1 and 500, or choose Maximum.');
  }
  const usableW = paper.width - 2 * margin;
  const usableH = paper.height - 2 * margin;
  const fit = (w: number, h: number) => {
    const columns = Math.max(0, Math.floor((usableW + gap + 1e-9) / (w + gap)));
    const rows = Math.max(0, Math.floor((usableH + gap + 1e-9) / (h + gap)));
    return { columns, rows, capacity: columns * rows, w, h };
  };
  const normal = fit(photo.width, photo.height);
  const turned = fit(photo.height, photo.width);
  const rotated = turned.capacity > normal.capacity;
  const best = rotated ? turned : normal;
  if (!best.capacity) throw new Error('No photo fits. Reduce margins or photo size, or select larger paper.');
  if (count !== null && count > best.capacity) {
    throw new Error(`Only ${best.capacity} copies fit. Reduce copies, margins or gap, or select larger paper.`);
  }
  const total = count ?? best.capacity;
  const columns = Math.min(total, best.columns);
  const rows = Math.ceil(total / columns);
  const gridH = rows * best.h + (rows - 1) * gap;
  const top = (paper.height - gridH) / 2;
  const placements: Placement[] = [];
  for (let row = 0; row < rows; row++) {
    const n = Math.min(columns, total - row * columns);
    const left = (paper.width - (n * best.w + (n - 1) * gap)) / 2;
    for (let col = 0; col < n; col++) {
      placements.push({ x: left + col * (best.w + gap), y: top + row * (best.h + gap), width: best.w, height: best.h });
    }
  }
  return { paper, photo, margin, gap, rotated, columns, rows, capacity: best.capacity, placements };
}
