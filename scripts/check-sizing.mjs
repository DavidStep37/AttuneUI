import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
try {
  await mkdir('.backup/sizing-review', { recursive: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(process.env.ATTUNE_URL ?? 'http://localhost:5188', { waitUntil: 'networkidle0' });
  for (const [size, height] of [['sm', 24], ['md', 28], ['lg', 32]]) {
    const root = `.pg-size-example[data-density="${size}"]`;
    await page.$eval(root, e => e.scrollIntoView({ block: 'center' }));
    const metrics = await page.$$eval(root + ' [data-control-size]', els => els.map(el => {
      const r = el.getBoundingClientRect(), css = getComputedStyle(el);
      return { height: r.height, cy: r.top + r.height / 2, line: css.lineHeight };
    }));
    assert.equal(metrics.length, 7);
    assert(metrics.every(m => Math.abs(m.height - height) < 0.1 && m.line === '16px'), `${size}: uniform slots and line height`);
    assert(metrics.every(m => Math.abs(m.cy - metrics[0].cy) < 0.1), `${size}: common center line`);
    const bounds = () => page.$eval(root, el => {
      const input = el.querySelector('.at-input'), value = el.querySelector('.at-input-value'), peer = el.querySelector('.at-seg');
      const a = input.getBoundingClientRect(), b = value.getBoundingClientRect(), c = peer.getBoundingClientRect();
      return { input: [a.x, a.y, a.width, a.height], number: [b.x + b.width / 2, b.y + b.height / 2], peer: [c.x, c.y, c.width, c.height] };
    });
    const resting = await bounds();
    await page.hover(root + ' .at-input-box'); await pause(400);
    await page.click(root + ' .at-input-box'); await pause(600);
    assert.deepEqual(await bounds(), resting, `${size}: focus expansion cannot move the number or siblings`);
    const frameHeight = await page.$eval(root + ' .at-input-frame', e => e.getBoundingClientRect().height);
    assert(Math.abs(frameHeight - (height + 4)) < 0.2, `${size}: focus frame expands beyond the slot`);
    await page.keyboard.press('Tab'); await page.mouse.move(0, 0); await pause(500);
    await page.click(root + ' .at-select-trigger'); await pause(700);
    const optionHeights = await page.$$eval('.at-select-option', es => es.map(e => e.getBoundingClientRect().height));
    assert(optionHeights.every(h => Math.abs(h - height) < 0.1), `${size}: popup rows use the selected density`);
    await page.keyboard.press('Escape'); await pause(400);
  }
  await (await page.$('.pg-sizing')).screenshot({ path: '.backup/sizing-review/desktop-light.png' });
  const bezier = '[data-component="bezier"]';
  const hierarchy = await page.$eval(bezier, el => ({
    end: el.querySelector('.at-bezier-end').getAttribute('r'),
    handle: el.querySelector('.at-bezier-point').getAttribute('r'),
    endStroke: getComputedStyle(el.querySelector('.at-bezier-end')).stroke,
    handleFill: getComputedStyle(el.querySelector('.at-bezier-point')).fill,
    curve: el.querySelector('.at-bezier-curve').getAttribute('d'),
  }));
  assert.equal(hierarchy.end, '2'); assert.equal(hierarchy.handle, '5');
  assert.equal(hierarchy.endStroke, 'none'); assert.equal(hierarchy.handleFill, 'rgb(255, 255, 255)');
  await page.$eval(bezier + ' .at-bezier-hit', e => e.focus()); await page.keyboard.press('ArrowRight'); await pause(450);
  assert.notEqual(await page.$eval(bezier + ' .at-bezier-curve', e => e.getAttribute('d')), hierarchy.curve, 'Handle still edits the curve');
  await (await page.$(bezier)).screenshot({ path: '.backup/sizing-review/bezier-light.png' });
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme); await pause(300);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}/${theme}: no page overflow`);
      await (await page.$('.pg-sizing')).screenshot({ path: `.backup/sizing-review/${width}-${theme}.png` });
      await (await page.$(bezier)).screenshot({ path: `.backup/sizing-review/bezier-${width}-${theme}.png` });
    }
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS three densities: heights, line heights, horizontal alignment, stable input focus, select rows; Bezier hierarchy/keyboard; mobile and both themes');
} finally { await browser.close(); }
