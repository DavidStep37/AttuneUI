import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await mkdir('.backup/segmented-fit', { recursive: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(process.env.ATTUNE_URL ?? 'http://localhost:5188', { waitUntil: 'networkidle0' });
  // The second demo has three options, so both directions include a middle stop.
  const segments = await page.$$('[data-component="segmented"] .at-seg');
  const segmented = segments[1];
  assert(segmented, 'Segmented demo is mounted');
  await segmented.evaluate(el => {
    window.fitFrames = []; window.fitRunning = true;
    const points = path => [...path.getAttribute('d').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => ({ x: +m[1], y: +m[2] }));
    const at = (ps, x) => {
      const index = ps.findIndex(p => p.x >= x);
      if (index <= 0) return ps[0].y;
      const a = ps[index - 1], b = ps[index];
      return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    };
    function frame() {
      const outer = points(el.querySelector('.at-seg-track'));
      const inner = points(el.querySelector('.at-seg-indicator'));
      const top = outer.slice(0, outer.length / 2), fill = inner.slice(0, inner.length / 2);
      const l = fill[0].x, r = fill.at(-1).x, half = el.clientHeight / 2 - 2;
      const body = fill.filter(p => p.x >= l + half + 1 && p.x <= r - half - 1);
      window.fitFrames.push({ l, r, width: el.clientWidth,
        gaps: body.map(p => p.y - at(top, p.x)),
        minGap: Math.min(...fill.map(p => p.y - at(top, p.x))),
        crest: Math.min(...top.map(p => p.y)),
      });
      if (window.fitRunning) requestAnimationFrame(frame);
    }
    frame();
  });
  const options = await segmented.$$('.at-seg-option');
  for (const index of [2, 0, 1, 2, 0]) {
    await options[index].hover(); await pause(280);
    await options[index].click(); await pause(110);
  }
  await pause(650);
  await options[0].hover(); await page.mouse.move(0, 0); await options[0].hover(); await pause(450);
  await segmented.screenshot({ path: '.backup/segmented-fit/hover.png' });
  const frames = await page.evaluate(() => { window.fitRunning = false; return window.fitFrames; });
  assert(frames.length > 50, 'Capture intermediate animation frames');
  assert(frames.some(f => f.crest < -1), 'Capture a raised crest');
  assert(frames.every(f => f.l >= 1.99 && f.r <= f.width - 1.99), 'Spring travel stays within horizontal padding');
  assert(frames.every(f => f.minGap >= 1.4), 'Fill stays inside the track throughout travel');
  const gaps = frames.flatMap(f => f.gaps);
  assert(gaps.length > 500 && gaps.every(g => Math.abs(g - 1.5) < 0.06), 'Selected body follows the track with constant inset, without a neck');
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile('.backup/segmented-fit/frames.json', JSON.stringify(frames));
  console.log(`PASS ${frames.length} animation frames: shared crest, constant body inset, both directions, interrupted travel, no overflow`);
} finally { await browser.close(); }
