import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

await mkdir('.backup/input-review', { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const pause = () => new Promise(resolve => setTimeout(resolve, 900));
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const metrics = selector => page.$eval(selector, el => {
  const root = el.closest('.at-input');
  const frame = root.querySelector('.at-input-frame').getBoundingClientRect();
  const box = root.querySelector('.at-input-box').getBoundingClientRect();
  const field = root.querySelector('input');
  const clipped = [];
  for (let parent = root.parentElement; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent), r = parent.getBoundingClientRect();
    if (css.overflowX !== 'visible' && (frame.left < r.left - 0.5 || frame.right > r.right + 0.5)) clipped.push({ class: parent.className, axis: 'x', style: parent.getAttribute('style'), frame: [frame.left, frame.right], clip: [r.left, r.right] });
    if (css.overflowY !== 'visible' && (frame.top < r.top - 0.5 || frame.bottom > r.bottom + 0.5)) clipped.push({ class: parent.className, axis: 'y', style: parent.getAttribute('style'), frame: [frame.top, frame.bottom], clip: [r.top, r.bottom] });
  }
  return { dx: frame.width - box.width, dy: frame.height - box.height, clipped, textClipped: field ? field.scrollWidth > field.clientWidth + 1 : false };
});
try {
  for (const width of [1440, 390]) {
    await page.goto('about:blank');
    await page.setViewport({ width, height: 1050, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: width === 1440 ? 'light' : 'dark' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(`${process.env.ATTUNE_URL ?? 'http://localhost:5188'}/#sample`, { waitUntil: 'networkidle0' });
    await page.$$eval('[aria-label="缓动类型"] [role="radio"]', els => els.find(el => el.textContent === '弹簧').click());
    await pause();
    const target = '[role="spinbutton"][aria-label="刚度"]';
    await page.$eval(target, el => el.scrollIntoView({ block: 'center' }));
    await page.mouse.move(0, 0); await pause();
    assert.equal((await metrics(target)).dx, 0);
    await page.hover(target); await pause();
    assert.equal((await metrics(target)).dx, 0, 'Hover draws the compact frame without expanding');
    const centres = await page.$$eval('.at-panel [role="spinbutton"]', els => els.map(el => {
      const box = el.getBoundingClientRect(), digits = el.querySelector('.at-roll').getBoundingClientRect();
      return { box: box.x + box.width / 2, digits: digits.x + digits.width / 2 };
    }));
    assert(centres.every(c => Math.abs(c.box - c.digits) < 0.5), 'Numbers are centred within their boxes');
    assert(centres.every(c => Math.abs(c.box - centres[0].box) < 0.5), 'Numbers align vertically regardless of units');
    await page.mouse.move(0, 0); await pause();
    assert.equal((await metrics(target)).dx, 0, 'Pointer leave restores an unfocused input');
    await page.focus(target); await new Promise(resolve => setTimeout(resolve, 1900));
    const focused = await metrics(target);
    // Each edge moves out by the default `input.expand` (3px), so both axes grow by ≥ 2 × 3px.
    assert(focused.dx > 5.8 && focused.dy > 5.8, 'Keyboard focus expands all four frame edges');
    assert.deepEqual(focused.clipped, [], 'Focused frame is inside every clipping ancestor');
    await page.keyboard.press('Enter'); await pause();
    const edited = await metrics(target);
    assert(edited.dx > 5.8 && edited.dy > 5.8);
    assert.deepEqual(edited.clipped, [], 'Right-aligned input frame remains visible while editing');
    assert(!edited.textClipped, 'All selected digits fit inside the input');
    assert.equal(await page.$eval('.at-input-field', el => getComputedStyle(el).textAlign), 'center');
    await page.screenshot({ path: `.backup/input-review/focused-${width}.png` });
    await page.keyboard.press('Escape');
    await page.click('.at-panel-title'); await pause();
    assert.equal((await metrics(target)).dx, 0, 'Blur restores the resting frame');
    // Nested SwitchField reveal must also allow its child's expanded frame.
    const scale = '[role="spinbutton"][aria-label="起始缩放"]';
    if (!await page.$(scale)) await page.$$eval('.at-switch-field', els => els.find(el => el.querySelector('label')?.textContent === '缩放').querySelector('[role="switch"]').click());
    await pause();
    await page.$eval(scale, el => el.scrollIntoView({ block: 'center' }));
    await page.click(scale); await new Promise(resolve => setTimeout(resolve, 1900));
    const nested = await metrics(scale);
    assert(nested.dx > 5.8);
    assert.deepEqual(nested.clipped, [], 'Nested switch reveal does not crop the expanded input');
    await page.keyboard.press('Escape');
    const group = await page.$$('.at-group-toggle');
    for (const button of group) if ((await button.evaluate(el => el.textContent)).includes('效果')) { await button.click(); break; }
    await pause();
    assert.equal(await page.$(scale), null, 'Collapsing still removes the nested fields');
    console.log(`PASS Input ${width}px: keyboard focus, editing, full frame/text visibility, blur, nested reveal and collapse`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
