import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
const out = '.backup/input-review';
await mkdir(out, { recursive: true });
const failures = [];
try {
  for (const context of ['sample', 'modal']) for (const fast of [false, true]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(process.env.ATTUNE_URL ?? 'http://localhost:5188', { waitUntil: 'networkidle0' });
    if (fast) await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('attune-playground-v1'));
      state.springs.soft = { visualDuration: 0.02, bounce: 0 };
      state.overrides.input = { ...state.overrides.input, spring: { visualDuration: 0.02, bounce: 0 } };
      localStorage.setItem('attune-playground-v1', JSON.stringify(state));
    });
    await page.goto(`${process.env.ATTUNE_URL ?? 'http://localhost:5188'}/${context === 'sample' ? '#sample' : ''}`, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    if (context === 'modal') {
      await page.click('.pg-card-slot:nth-child(2) .pg-card-open');
      await page.waitForSelector('.pg-modal-panel');
    }
    const target = context === 'sample' ? '.at-panel .at-input-box' : '.pg-modal-panel .at-input-box';
    await pause(750);
    await page.$eval(target, el => el.scrollIntoView({ block: 'center' }));
    const checkLayout = async () => {
      const layout = await page.$eval(target, el => {
        const row = el.closest('.at-row-slider');
        const label = row.querySelector('.at-row-label').getBoundingClientRect();
        const input = el.closest('.at-input').getBoundingClientRect();
        const slider = row.querySelector('.at-slider').getBoundingClientRect();
        return { header: Math.abs(label.y + label.height / 2 - input.y - input.height / 2), left: Math.abs(label.left - slider.left), right: Math.abs(input.right - slider.right), gap: slider.top - input.bottom, inViewport: slider.left >= 0 && slider.right <= innerWidth + 1 };
      });
      assert(layout.header < 1 && layout.left < 1 && layout.right < 1 && layout.gap >= 7.5, 'Label/readout share a header and align with a full-width slider below');
      assert(layout.inViewport, 'The panel control fits within the viewport');
    };
    await checkLayout();
    await page.mouse.move(0, 0); await pause(600);
    const trace = async action => {
      await page.$eval(target, el => {
        window.panelInputTrace = [];
        const start = performance.now();
        const tick = () => {
          const frame = el.querySelector('.at-input-frame'), r = frame.getBoundingClientRect();
          window.panelInputTrace.push({ t: performance.now() - start, connected: el.isConnected, draw: +getComputedStyle(frame).getPropertyValue('--at-input-draw'), grow: +getComputedStyle(frame).getPropertyValue('--at-input-progress'), width: r.width, height: r.height });
          if (performance.now() - start < 1400) requestAnimationFrame(tick);
        };
        tick();
      });
      await action(); await pause(1500);
      return page.evaluate(() => window.panelInputTrace);
    };
    const hover = await trace(() => page.hover(target));
    const focus = await trace(() => page.click(target));
    const span = (frames, key) => { const moving = frames.filter(f => f[key] > 0 && f[key] < 1); return moving.length > 1 ? moving.at(-1).t - moving[0].t : 0; };
    const result = { context, fast, drawMs: Math.round(span(hover, 'draw')), growMs: Math.round(span(focus, 'grow')), remounted: [...hover, ...focus].some(f => !f.connected) };
    console.log(result);
    if (result.drawMs < 200 || result.growMs < 300 || result.remounted) failures.push(result);
    await page.screenshot({ path: `${out}/panel-${context}-${fast ? 'saved-fast' : 'default'}.png` });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await pause(500);
    await page.$eval(target, el => el.scrollIntoView({ block: 'center' }));
    await checkLayout();
    await page.screenshot({ path: `${out}/panel-${context}-${fast ? 'saved-fast' : 'default'}-mobile.png` });
    await page.close();
  }
  assert.deepEqual(failures, [], 'Panel Input must remain animated with short saved global/legacy spring settings');
} finally { await browser.close(); }
