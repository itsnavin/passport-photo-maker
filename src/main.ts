import './style.css';
import { bounded, makeLayout, PAPERS, PHOTO_SIZES, type Layout, type Size } from './layout';
import { canvasBlob, cropRect, decodePhoto, effectiveDpi, exportDimensions, renderCrop } from './photo';
import { createSheetPdf } from './pdf';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><a class="brand" href="./" aria-label="Photo Sheet home"><span class="brand-icon" aria-hidden="true">▦</span> Photo Sheet<span class="tag">LOCAL STUDIO</span></a><span class="privacy-dot">Private by design · No uploads</span></header>
  <main>
    <section class="intro"><div class="eyebrow">SMALL PHOTOS. PERFECTLY PLACED.</div><h1>A photo. A whole sheet<br> of possibilities.</h1><p>Crop your photo, choose your paper, and download a true-size print sheet.<br class="desktop"> Everything happens here, in your browser.</p></section>
    <div class="workspace">
      <div class="controls">
        <section class="card"><h2><span class="step">01</span> Your photo <button id="clear" class="text-button" type="button">Clear all</button></h2>
          <label class="upload" for="upload"><span class="upload-icon" aria-hidden="true">↑</span><strong>Choose a photo</strong><span>JPEG, PNG or WebP · up to 25 MB</span><input id="upload" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <p id="source-info" class="small">Your photo never leaves this device. No camera access needed.</p>
          <button id="demo" class="text-button" type="button">Try a synthetic sample →</button>
          <p id="upload-status" role="status" class="small"></p>
        </section>
        <section class="card"><h2><span class="step">02</span> Crop & position</h2>
          <label>Photo dimensions<select id="photo-preset"><option value="35x45">35 × 45 mm</option><option value="2x2">2 × 2 inches (50.8 × 50.8 mm)</option><option value="30x40">30 × 40 mm</option><option value="custom">Custom dimensions</option></select></label>
          <div class="pair" id="photo-custom" hidden><label>Width (mm)<input id="photo-width" type="number" min="10" max="210" step="0.1" value="35"></label><label>Height (mm)<input id="photo-height" type="number" min="10" max="297" step="0.1" value="45"></label></div>
          <div class="crop-wrap"><canvas id="crop" width="350" height="450" tabindex="0" role="img" aria-label="Photo crop preview. Use arrow keys to reposition; plus and minus to zoom." aria-describedby="crop-help"></canvas><div id="crop-placeholder">Your photo goes here</div><div class="guides" aria-hidden="true"><div class="head-guide"></div><div class="eye-guide"></div><div class="shoulder-guide"></div></div></div>
          <p class="small" id="crop-help">Drag the photo to position. Arrow keys move it; + / − zoom. Guides are approximate composition aids, not biometric checks.</p>
          <label>Zoom <output id="zoom-value">1.00×</output><input id="zoom" aria-label="Zoom" type="range" min="1" max="4" step="0.01" value="1"></label>
          <div class="pair"><label>Horizontal position<input id="position-x" type="range" min="0" max="1" step="0.005" value="0.5"></label><label>Vertical position<input id="position-y" type="range" min="0" max="1" step="0.005" value="0.5"></label></div>
          <div class="crop-actions"><label class="check"><input type="checkbox" id="guides" checked> Positioning guides</label><button id="center" type="button" class="text-button">Center crop</button></div>
          <p id="quality" role="status" class="small">Any resolution within safety limits. Low-resolution images may look soft.</p>
          <p class="note">Dimensions are not country-specific approval presets. Check your authority's background, head size, clothing and lighting rules. No face detection, retouching or background removal.</p>
        </section>
        <section class="card"><h2><span class="step">03</span> Paper & layout</h2>
          <div class="pair"><label>Paper size<select id="paper"><option value="a4">A4 · 210 × 297 mm</option><option value="a5">A5 · 148 × 210 mm</option><option value="a6">A6 · 105 × 148 mm</option><option value="4x6">4 × 6 in · 101.6 × 152.4 mm</option><option value="10x15">10 × 15 cm · 100 × 150 mm</option><option value="custom">Custom (up to A4)</option></select></label><label>Orientation<select id="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>
          <div class="pair" id="paper-custom" hidden><label>Short edge (mm)<input id="paper-width" type="number" min="25" max="210" step="0.1" value="210"></label><label>Long edge (mm)<input id="paper-height" type="number" min="25" max="297" step="0.1" value="297"></label></div>
          <div class="pair"><label>Margins (mm)<input id="margin" type="number" min="0" max="50" step="0.5" value="8"></label><label>Gap (mm)<input id="gap" type="number" min="0" max="20" step="0.5" value="3"></label></div>
          <div class="pair"><label>Copies<select id="count-mode"><option value="max">Maximum that fit</option><option value="count">Choose count</option></select></label><label id="count-label" hidden>Number of copies<input id="count" type="number" min="1" max="500" step="1" value="6"></label></div>
          <p class="small">Copies are centered inside your margins. All copies rotate 90° only when that fits more; this is a uniform grid, not mixed-orientation packing.</p>
        </section>
      </div>
      <aside class="preview-column">
        <section class="preview-panel"><div class="preview-heading"><div><div class="eyebrow">YOUR PRINT SHEET</div><h2>Ready for the real world.</h2></div><span id="paper-badge" class="badge">A4</span></div>
          <div class="sheet-stage"><canvas id="sheet" width="630" height="891" role="img" aria-label="Print sheet layout preview"></canvas></div>
          <div id="layout-summary" class="layout-summary" role="status"></div>
          <p class="small">Preview is reduced to screen size. The PDF keeps exact physical dimensions. Dashed margin guides are preview-only.</p>
        </section>
        <section class="card export"><h2><span class="step">04</span> Make it print-ready</h2>
          <label>Export resolution<select id="dpi"><option value="300">300 DPI · recommended</option><option value="600">600 DPI · larger file</option><option value="150">150 DPI · draft</option><option value="custom">Custom DPI (72–600)</option></select></label>
          <label id="dpi-label" hidden>DPI<input id="custom-dpi" type="number" min="72" max="600" step="1" value="300"></label>
          <label class="check"><input id="marks" type="checkbox" checked> Cut marks outside photos (when gap & margins allow)</label>
          <label class="check"><input id="ruler" type="checkbox"> Add a 50 mm print-check ruler (needs 8 mm margin)</label>
          <p id="error" class="error" role="alert" hidden></p>
          <button id="pdf" class="primary" type="button" disabled>Download print sheet · PDF <span aria-hidden="true">↓</span></button>
          <button id="single" class="secondary" type="button" disabled>Download single photo · JPEG</button>
          <p id="export-status" role="status" class="small"></p>
          <details><summary>Get the print size right</summary><ol><li>Open the PDF and match the printer's paper size to this sheet.</li><li>Print at <strong>Actual size / 100%</strong>. Turn off Fit, Shrink, Scale to fit, and headers/footers. Prefer a PDF viewer over printing this web page.</li><li>Use margins your printer supports. Zero margins do not guarantee borderless printing. Print a plain-paper test and measure the 50 mm ruler.</li><li>Use glossy paper compatible with your printer. Select its actual media type and quality in the print dialog. Follow the paper/ink maker's drying and handling guidance.</li></ol></details>
          <p class="note">Glossy is a paper and printer setting, not a digital effect. Digital measurements cannot guarantee physical printer accuracy or official passport acceptance.</p>
        </section>
      </aside>
    </div>
    <footer><strong>Your photos stay yours.</strong> No account, analytics, photo storage or server processing. Clear all releases image state and download URLs best-effort; it cannot guarantee memory erasure. Files you download remain on your device.<br>Limits: 25 MB per file · 40 MP / 16,000 px source · 20 MP / 8,192 px export · current browsers with ImageBitmap support. <a href="./third-party-notices.txt">Third-party licenses</a></footer>
  </main>`;

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element: ${id}`);
  return element as T;
}
const input = (id: string) => el<HTMLInputElement>(id);
const value = (id: string) => (el<HTMLInputElement | HTMLSelectElement>(id)).value;
const number = (id: string) => value(id).trim() === '' ? NaN : Number(value(id));
const cropCanvas = el<HTMLCanvasElement>('crop');
const sheet = el<HTMLCanvasElement>('sheet');
let bitmap: ImageBitmap | null = null;
let generation = 0;
let exporting = false;
const urls = new Set<string>();
let currentLayout: Layout | null = null;
let currentPhoto: Size = PHOTO_SIZES['35x45'];
let currentDpi = 300;

function showError(message: string) {
  el('error').textContent = message;
  el('error').hidden = !message;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred. Please retry with a smaller image.';
}
function setButtons() {
  el<HTMLButtonElement>('pdf').disabled = !bitmap || !currentLayout || exporting;
  el<HTMLButtonElement>('single').disabled = !bitmap || !currentLayout || exporting;
}
function getCrop() {
  if (!bitmap) throw new Error('Choose a photo first.');
  return cropRect(bitmap, currentPhoto.width / currentPhoto.height, number('zoom'), number('position-x'), number('position-y'));
}
function drawSheet(preview: HTMLCanvasElement | null, layout: Layout) {
  const scale = 2.5;
  sheet.width = Math.round(layout.paper.width * scale);
  sheet.height = Math.round(layout.paper.height * scale);
  const ctx = sheet.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, layout.paper.width, layout.paper.height);
  ctx.lineWidth = 0.25;
  ctx.strokeStyle = '#d5ddd8';
  ctx.setLineDash([1.5, 1.5]);
  ctx.strokeRect(layout.margin, layout.margin, layout.paper.width - 2 * layout.margin, layout.paper.height - 2 * layout.margin);
  ctx.setLineDash([]);
  for (const p of layout.placements) {
    ctx.save();
    if (preview) {
      if (layout.rotated) {
        ctx.translate(p.x, p.y + p.height);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(preview, 0, 0, layout.photo.width, layout.photo.height);
      } else ctx.drawImage(preview, p.x, p.y, p.width, p.height);
    } else {
      ctx.fillStyle = '#eaf0ec';
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.strokeStyle = '#bdcdc2';
      ctx.strokeRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#648274';
      ctx.font = '3px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${layout.photo.width} × ${layout.photo.height}`, p.x + p.width / 2, p.y + p.height / 2);
    }
    ctx.restore();
    if (input('marks').checked && Math.min(layout.gap / 2, layout.margin) >= 1) {
      const length = Math.min(2, Math.min(layout.gap / 2, layout.margin) - 0.5);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 0.15;
      for (const dx of [0, p.width]) for (const dy of [0, p.height]) {
        const x = p.x + dx, y = p.y + dy, sx = dx === 0 ? -1 : 1, sy = dy === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(x + sx * 0.5, y); ctx.lineTo(x + sx * (0.5 + length), y);
        ctx.moveTo(x, y + sy * 0.5); ctx.lineTo(x, y + sy * (0.5 + length)); ctx.stroke();
      }
    }
  }
  if (input('ruler').checked && layout.margin >= 8 && layout.paper.width >= 70) {
    const x = (layout.paper.width - 50) / 2, y = layout.paper.height - 3;
    ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 50, y);
    for (let i = 0; i <= 5; i++) { ctx.moveTo(x + i * 10, y); ctx.lineTo(x + i * 10, y - 1.5); }
    ctx.stroke();
    ctx.font = '2.1px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#111';
    ctx.fillText('50 mm - check after printing', x, y - 2.2);
  }
}
function update() {
  el('photo-custom').hidden = value('photo-preset') !== 'custom';
  el('paper-custom').hidden = value('paper') !== 'custom';
  el('count-label').hidden = value('count-mode') !== 'count';
  el('dpi-label').hidden = value('dpi') !== 'custom';
  document.querySelector<HTMLElement>('.guides')!.hidden = !input('guides').checked || !bitmap;
  el('crop-placeholder').hidden = !!bitmap;
  el('zoom-value').textContent = `${number('zoom').toFixed(2)}×`;
  currentLayout = null;
  try {
    currentPhoto = value('photo-preset') === 'custom'
      ? { width: number('photo-width'), height: number('photo-height') } : PHOTO_SIZES[value('photo-preset')];
    let paper = value('paper') === 'custom'
      ? { width: number('paper-width'), height: number('paper-height') } : PAPERS[value('paper')];
    paper = { width: Math.min(paper.width, paper.height), height: Math.max(paper.width, paper.height) };
    if (value('orientation') === 'landscape') paper = { width: paper.height, height: paper.width };
    const layout = makeLayout(paper, currentPhoto, number('margin'), number('gap'), value('count-mode') === 'max' ? null : number('count'));
    currentDpi = bounded(value('dpi') === 'custom' ? number('custom-dpi') : number('dpi'), 72, 600, 'Export DPI');
    const output = exportDimensions(currentPhoto, currentDpi);
    if (input('ruler').checked && (layout.margin < 8 || layout.paper.width < 70)) {
      throw new Error('The test ruler needs at least an 8 mm margin and 70 mm paper width. Change margins or turn off the ruler.');
    }
    cropCanvas.width = Math.round(Math.min(350, 560 * currentPhoto.width / currentPhoto.height));
    cropCanvas.height = Math.round(cropCanvas.width * currentPhoto.height / currentPhoto.width);
    let preview: HTMLCanvasElement | null = null;
    if (bitmap) {
      const crop = getCrop();
      preview = renderCrop(bitmap, crop, { width: cropCanvas.width, height: cropCanvas.height });
      cropCanvas.getContext('2d')!.drawImage(preview, 0, 0);
      const quality = effectiveDpi(crop, currentPhoto);
      const low = quality < 300;
      const upscale = quality < currentDpi;
      el('quality').textContent = `${Math.floor(quality)} effective cropped DPI · ${output.width} × ${output.height} px export. ${low ? 'Low-resolution warning: below 300 DPI; fine detail may look soft. ' : ''}${upscale ? 'Export upscales pixels; it cannot recover missing detail.' : 'Enough source pixels for selected export DPI.'}`;
      el('quality').classList.toggle('warning', low || upscale);
    } else {
      el('quality').textContent = 'Choose a photo to see effective cropped DPI and quality guidance.';
      el('quality').classList.remove('warning');
    }
    drawSheet(preview, layout);
    el('paper-badge').textContent = `${paper.width} × ${paper.height} mm`;
    el('layout-summary').textContent = `${layout.placements.length} copies · ${layout.capacity} maximum · ${currentPhoto.width} × ${currentPhoto.height} mm each · ${layout.margin} mm margins · ${layout.gap} mm gap.${layout.rotated ? ' Copies rotated 90° to fit more.' : ''}${input('marks').checked && Math.min(layout.gap / 2, layout.margin) < 1 ? ' Cut marks omitted: need at least 2 mm gap and 1 mm margin.' : ''}`;
    sheet.setAttribute('aria-label', el('layout-summary').textContent!);
    currentLayout = layout;
    showError('');
  } catch (error) {
    showError(errorMessage(error));
    sheet.getContext('2d')!.clearRect(0, 0, sheet.width, sheet.height);
    el('layout-summary').textContent = 'Adjust the settings to create a valid print sheet.';
  }
  setButtons();
}

function releasePhoto() {
  generation++;
  bitmap?.close();
  bitmap = null;
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
  input('upload').value = '';
  el('source-info').textContent = 'Your photo never leaves this device. No camera access needed.';
  el('upload-status').textContent = '';
  el('export-status').textContent = '';
}
async function load(file: File) {
  releasePhoto();
  const token = generation;
  update();
  el('upload-status').textContent = 'Opening photo locally…';
  try {
    const decoded = await decodePhoto(file);
    if (token !== generation) { decoded.close(); return; }
    bitmap = decoded;
    input('zoom').value = '1';
    input('position-x').value = input('position-y').value = '0.5';
    el('source-info').textContent = `Original (orientation applied): ${bitmap.width} × ${bitmap.height} px · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    el('upload-status').textContent = 'Photo ready. Adjust the crop below.';
    update();
  } catch (error) {
    if (token === generation) {
      el('upload-status').textContent = errorMessage(error);
      showError(errorMessage(error));
    }
  }
}
input('upload').addEventListener('change', () => {
  const file = input('upload').files?.[0];
  if (file) void load(file);
});
el('clear').addEventListener('click', () => {
  releasePhoto();
  for (const control of document.querySelectorAll<HTMLInputElement>('input:not([type=file])')) {
    if (control.type === 'checkbox') control.checked = control.defaultChecked;
    else control.value = control.defaultValue;
  }
  for (const control of document.querySelectorAll<HTMLSelectElement>('select')) control.selectedIndex = 0;
  update();
  el('upload-status').textContent = 'Cleared. Image state and download URLs released best-effort.';
});
el('center').addEventListener('click', () => {
  input('zoom').value = '1'; input('position-x').value = input('position-y').value = '0.5'; update();
});
for (const control of document.querySelectorAll('select, input:not([type=file])')) control.addEventListener('input', update);

let dragging: { id: number; x: number; y: number; px: number; py: number } | null = null;
cropCanvas.addEventListener('pointerdown', event => {
  if (!bitmap || !currentLayout) return;
  cropCanvas.focus();
  cropCanvas.setPointerCapture(event.pointerId);
  dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, px: number('position-x'), py: number('position-y') };
});
cropCanvas.addEventListener('pointermove', event => {
  if (!dragging || !bitmap || event.pointerId !== dragging.id) return;
  const crop = getCrop(), rect = cropCanvas.getBoundingClientRect();
  const dx = (event.clientX - dragging.x) * crop.width / rect.width;
  const dy = (event.clientY - dragging.y) * crop.height / rect.height;
  input('position-x').value = String(Math.max(0, Math.min(1, dragging.px - dx / Math.max(1, bitmap.width - crop.width))));
  input('position-y').value = String(Math.max(0, Math.min(1, dragging.py - dy / Math.max(1, bitmap.height - crop.height))));
  update();
});
cropCanvas.addEventListener('lostpointercapture', () => { dragging = null; });
cropCanvas.addEventListener('pointerup', () => { dragging = null; });
cropCanvas.addEventListener('pointercancel', () => { dragging = null; });
cropCanvas.addEventListener('keydown', event => {
  const key = event.key;
  const delta = event.shiftKey ? 0.1 : 0.02;
  const control = key === '+' || key === '=' || key === '-' ? 'zoom'
    : key === 'ArrowLeft' || key === 'ArrowRight' ? 'position-x'
    : key === 'ArrowUp' || key === 'ArrowDown' ? 'position-y' : '';
  if (!control || !bitmap) return;
  event.preventDefault();
  const direction = ['ArrowLeft', 'ArrowUp', '-'].includes(key) ? -1 : 1;
  input(control).value = String(Math.max(control === 'zoom' ? 1 : 0, Math.min(control === 'zoom' ? 4 : 1, number(control) + direction * (control === 'zoom' ? 0.05 : delta))));
  update();
});
el('demo').addEventListener('click', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e3eee8'; ctx.fillRect(0, 0, 1000, 1200);
  ctx.fillStyle = '#407b6b'; ctx.beginPath(); ctx.ellipse(500, 1050, 340, 320, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9bc4af'; ctx.beginPath(); ctx.ellipse(500, 470, 210, 285, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#123b39'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SYNTHETIC SAMPLE', 500, 1130);
  const token = generation;
  try {
    const blob = await canvasBlob(canvas, 'image/png');
    if (token === generation) await load(new File([blob], 'synthetic-sample.png', { type: 'image/png' }));
  } catch (error) { showError(errorMessage(error)); }
});
async function download(kind: 'pdf' | 'single') {
  if (!bitmap || !currentLayout || exporting) return;
  const token = generation, layout = currentLayout, dpi = currentDpi;
  const marks = input('marks').checked, ruler = input('ruler').checked;
  exporting = true; setButtons(); showError('');
  el('export-status').textContent = 'Preparing download locally…';
  try {
    const canvas = renderCrop(bitmap, getCrop(), exportDimensions(layout.photo, dpi));
    const jpeg = await canvasBlob(canvas);
    canvas.width = canvas.height = 0;
    const blob = kind === 'pdf'
      ? new Blob([new Uint8Array(await createSheetPdf(new Uint8Array(await jpeg.arrayBuffer()), layout, marks, ruler))], { type: 'application/pdf' })
      : jpeg;
    if (token !== generation) return;
    const url = URL.createObjectURL(blob);
    urls.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = kind === 'pdf' ? `photo-sheet-${layout.paper.width}x${layout.paper.height}mm.pdf` : `photo-${layout.photo.width}x${layout.photo.height}mm-${dpi}dpi.jpg`;
    link.click();
    window.setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 60_000);
    el('export-status').textContent = kind === 'pdf' ? 'PDF ready. Print at Actual size / 100%, not Fit to page.' : 'JPEG ready. Pixel dimensions reflect selected DPI; JPEG physical-size metadata is not relied on. Use the PDF for true-size printing.';
  } catch (error) {
    if (token === generation) { showError(errorMessage(error)); el('export-status').textContent = 'Export failed; no download was created.'; }
  } finally { exporting = false; setButtons(); }
}
el('pdf').addEventListener('click', () => void download('pdf'));
el('single').addEventListener('click', () => void download('single'));
window.addEventListener('pagehide', () => { releasePhoto(); update(); });
update();
