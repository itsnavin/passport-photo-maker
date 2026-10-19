# Photo Sheet — Passport photo maker

A browser-local photo cropper and automatic print-sheet arranger. **Live app: https://itsnavin.github.io/passport-photo-maker/**

## Use

1. Open a JPEG, PNG or WebP (or try the non-personal synthetic sample).
2. Choose photo dimensions, then drag/zoom to position. Arrow keys and +/− work on the crop; labeled sliders provide keyboard and touch alternatives. The centered initial crop and head/eye guides are composition aids, **not face detection or biometric alignment**.
3. Select paper, orientation, margins, gap and copies. A centered uniform grid automatically uses a 90-degree rotation only if it fits more copies. A partial final row is centered. This does not claim optimal mixed packing.
4. Download the PDF or a single cropped JPEG. Default is 300 DPI. Upscaling cannot recover source detail; effective cropped DPI and quality warnings are shown.

Photo presets are dimensions, not country standards. Confirm exact requirements with the relevant issuing authority; background, head size, lighting and clothing remain your responsibility. No beauty filter, fabricated facial detail or background removal is applied. Official acceptance is not guaranteed.

### Print accurately

The PDF has the exact selected physical page size (MediaBox), with images drawn at the requested millimeter dimensions. It embeds one cropped JPEG at the selected resolution and reuses it for every copy. Pixel dimensions round to the nearest whole pixel; PDF physical dimensions do not. Optional cut marks are outside images, only where at least a 2 mm gap and 1 mm margin leave room. A 50 mm check ruler requires an 8 mm margin and paper at least 70 mm wide.

Open the PDF in a PDF viewer, match the printer paper size, and print at **Actual size / 100%**. Disable fit/shrink/scaling and browser headers/footers. Printing the application web page is intentionally disabled; use its PDF download instead. Test on plain paper and measure the ruler first. Printer hardware margins still apply; zero software margins do not guarantee borderless output.

Use printer-compatible glossy paper and choose its actual media type and quality in the printer settings. Follow the paper/ink manufacturer's drying and handling guidance. A browser cannot turn ordinary paper glossy. Digital tests do not validate physical printer dimensions or official acceptance.

## Supported sizes and limits

- Photos: 35 × 45 mm, 2 × 2 in (50.8 mm square), 30 × 40 mm, or custom 10–210 mm wide / 10–297 mm high.
- Paper: A4, A5, A6, **4 × 6 in (101.6 × 152.4 mm)** and **10 × 15 cm (100 × 150 mm)** as distinct sizes. Custom sheets must fit within 210 × 297 mm up to rotation. US Letter does not fit this limit.
- Margins: 0–50 mm per edge. Gaps: 0–20 mm. Requested copies: 1–500, or maximum that fit. All choices must physically fit; invalid values disable exports and show an error.
- Source: nonempty, at most 25 MiB, 40 megapixels and 16,000 pixels per edge. Header dimensions are checked before browser decoding and actual decoded dimensions checked again. JPEG/PNG/WebP signatures and successful decode are required. Unsupported HEIC/HEIF, SVG and damaged files produce actionable errors. Animated images use the browser-decoded first frame.
- Export: 72–600 DPI, at most 20 megapixels and 8,192 pixels per edge. Output is capped to avoid excessive canvas memory; devices with low available memory may still fail visibly. No tool can safely accept unlimited resolution.
- Modern Chromium, Firefox and Safari with `createImageBitmap` support. Browser decoding applies EXIF orientation once; there is no second manual EXIF transform. Desktop/mobile Chromium and desktop Firefox are automated; Safari and physical printers have not been validated.
- Single-photo JPEG dimensions correspond to the selected DPI, but its physical-size metadata is not relied on. **Use the PDF for reliable physical sizing.**

## Privacy

All photo decoding, cropping, previews and PDF generation run in the browser. No photo uploads, analytics, remote fonts, external runtime services, persistent image storage, camera access or account. App assets are served by GitHub Pages, whose normal hosting request logging is outside this application. Browser tests check for external runtime requests. Libraries are bundled locally.

Clear all closes the active ImageBitmap, clears crop/preview and UI state, cancels stale asynchronous results and revokes outstanding download URLs best-effort. URLs also expire after 60 seconds and are released on page exit. This is not guaranteed memory erasure. Downloaded files remain on the user's device.

## Development

Node.js 24 and npm:

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium firefox
npm run test:e2e
```

On Windows PowerShell with script restrictions, use the installed `npm.cmd` / `npx.cmd` launchers. Preview uses `/passport-photo-maker/`; Vite's base is configured for the repository Pages URL.

Unit tests cover mm/in/point/pixel transforms, paper/orientation/margin/gap combinations, uniform grid capacity, nonoverlap, bounding, count/no-fit/invalid inputs, crop aspect and DPI limits. Independent `pdfjs-dist` parsing verifies physical PDF page sizes, image count, placement transforms and rotation. Browser tests use only generated non-personal images: decode, EXIF orientation and pixel colors, invalid/oversized formats, crop keyboard/pointer controls, low-resolution warnings, stale decoding after clear, responsive overflow, external requests, actual downloaded PDF and JPEG dimensions. These checks are not physical print or passport certification.

If a local OS browser filter injects unrelated requests (for example AdGuard's `local.adguard.org`), `TEST_INJECTOR_HOST` can identify that exact hostname for test annotation instead of application traffic. This does not change the application or the filter. CI has no such exemption and must see zero external runtime requests.

## Publish

GitHub Actions runs build, unit tests and Chromium/mobile/Firefox browser tests for pull requests and main. Enable repository **Settings → Pages → Source: GitHub Actions**. Successful main builds deploy the static `dist` artifact using the official Pages actions. No backend or environment secrets are needed. To verify an existing deployment:

```sh
LIVE_URL=https://itsnavin.github.io/passport-photo-maker/ npm run test:e2e
```

On PowerShell set `$env:LIVE_URL` before `npm.cmd run test:e2e`. GitHub Pages/browser caches can take a few minutes to update after deployment.

## Dependencies and licenses

Runtime: `pdf-lib` (MIT), bundled by Vite with its transitive dependencies (`@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pako`, `tslib`). Full runtime license/copyright notices are generated from installed packages before every build into `public/third-party-notices.txt` and linked in the app footer. Dev-only tools include TypeScript, Vite, Vitest, Playwright, sharp and PDF.js; see their package licenses and the committed lockfile for exact versions. No third-party photos are included.
