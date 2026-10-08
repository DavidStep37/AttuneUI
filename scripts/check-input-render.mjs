// Verify actual screenshot pixels, independently of SVG dash/progress values.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const out = '.backup/input-review';
const panel = process.env.ATTUNE_INPUT_CONTEXT === 'sample';
const prefix = panel ? 'panel-render' : 'render';
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(`${process.env.ATTUNE_URL ?? 'http://localhost:5188'}/${panel ? '#sample' : ''}`, { waitUntil: 'networkidle0' });
    // Screenshots take ~10–70ms each depending on the machine; the 200ms default stroke
    // would yield too few frames to sample. Slow the stroke (as check-input-motion does):
    // this test verifies real pixels draw progressively, not the default duration.
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('attune-playground-v1') ?? '{}');
      state.overrides = { ...state.overrides, input: { ...state.overrides?.input, drawDuration: 900 } };
      localStorage.setItem('attune-playground-v1', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle0' });
    const selector = panel ? '.at-panel .at-input-box' : '.pg-card-slot:nth-child(2) .at-input-box';
    await page.$eval(selector, el => el.scrollIntoView({ block: 'center' }));
    await page.mouse.move(0, 0); await pause(700);
    const rect = await page.$eval(selector, el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const clip = { x: rect.x - 10, y: rect.y - 10, width: rect.width + 40, height: rect.height + 20 };
    const shots = [];
    const capture = async elapsed => {
      const bytes = await page.screenshot({ clip });
      shots.push({ elapsed, data: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` });
    };
    await capture(0);
    await page.hover(selector);
    const start = performance.now();
    for (let i = 0; i < 16; i++) { await pause(10); await capture(Math.round(performance.now() - start)); }
    // Raster differences in the side and top bands, away from text and underline.
    const metrics = await page.evaluate(async ({ shots, width, height }) => {
      const pixels = [];
      for (const shot of shots) {
        const img = new Image(); img.src = shot.data; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
        pixels.push({ data: ctx.getImageData(0, 0, img.width, img.height).data, width: img.width });
      }
      return pixels.map((image, i) => {
        const changed = (x0, y0, x1, y1) => {
          let count = 0;
          for (let y = y0 * 2; y < y1 * 2; y++) for (let x = x0 * 2; x < x1 * 2; x++) {
            const n = (y * image.width + x) * 4;
            const diff = Math.abs(image.data[n] - pixels[0].data[n]) + Math.abs(image.data[n + 1] - pixels[0].data[n + 1]) + Math.abs(image.data[n + 2] - pixels[0].data[n + 2]);
            if (diff > 30) count++;
          }
          return count;
        };
        return { ms: shots[i].elapsed, sides: changed(9, 15, 12, 10 + height - 5) + changed(8 + width, 15, 11 + width, 10 + height - 5), top: changed(15, 9, 5 + width, 12) };
      });
    }, { shots, width: rect.width, height: rect.height });
    assert(metrics.some(m => m.sides > 5 && m.top === 0), 'Actual pixels show side strokes before the top border');
    assert(new Set(metrics.map(m => m.sides + m.top)).size >= 5, 'Rendered outline has multiple visible intermediate states');
    assert(metrics.at(-1).top > 10, 'The top border is eventually painted');
    await writeFile(`${out}/${prefix}-${theme}.json`, JSON.stringify(metrics, null, 2));
    await page.setViewport({ width: 1720, height: 120, deviceScaleFactor: 2 });
    await page.setContent(`<body style="margin:0;background:${theme === 'light' ? '#fff' : '#18181b'};color:${theme === 'light' ? '#333' : '#ddd'};font:12px sans-serif;display:flex">${shots.map(s => `<div style="width:100px;text-align:center;padding-top:10px"><img style="width:${clip.width}px;height:${clip.height}px" src="${s.data}"><div>${s.elapsed} ms</div></div>`).join('')}</body>`);
    await page.screenshot({ path: `${out}/${prefix}-${theme}-strip.png` });
    console.log(`PASS ${theme}: screenshot pixels show progressive sides→top drawing`, metrics);
    await page.close();
  }
} finally { await browser.close(); }
