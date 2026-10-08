import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const pause = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
const card = name => `[data-component="${name}"]`;
const clickText = async (selector, text) => {
  for (const el of await page.$$(selector)) if ((await el.evaluate(e => e.textContent)).trim() === text) { await el.click(); return; }
  throw new Error(`Missing ${text}`);
};
const trace = selector => page.evaluate(selector => {
  window.fx = []; window.tracing = true;
  const start = performance.now();
  function tick() {
    const el = document.querySelector(selector);
    if (el) {
      const css = getComputedStyle(el), m = new DOMMatrixReadOnly(css.transform);
      window.fx.push({ t: performance.now() - start, opacity: +css.opacity, scale: m.a, y: m.f, blur: css.filter });
    }
    if (window.tracing) requestAnimationFrame(tick);
  }
  tick();
}, selector);
const stopTrace = () => page.evaluate(() => { window.tracing = false; return window.fx; });

try {
  await mkdir('.backup/foundation-review', { recursive: true });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(process.env.ATTUNE_URL ?? 'http://localhost:5188', { waitUntil: 'networkidle0' });
  assert.equal(await page.$$('.pg-card').then(els => els.length), 11);
  const seg = `${card('segmented')} .at-seg`;
  const silhouette = () => page.$eval(seg + ' .at-seg-track', e => ({ path: e.getAttribute('d'), height: e.getBBox().height }));
  const rest = await silhouette();
  await page.hover(seg + ' .at-seg-option:nth-of-type(2)'); await pause();
  const hover = await silhouette();
  assert(hover.height > rest.height + 2, 'Hover bulges both edges');
  await page.screenshot({ path: '.backup/foundation-review/segmented-hover.png', fullPage: true });
  await page.click(seg + ' .at-seg-option:nth-of-type(2)');
  const lingering = await silhouette();
  assert(lingering.height > rest.height + 0.5, 'Click keeps a residual bump');
  await pause(650); assert(Math.abs((await silhouette()).height - rest.height) < 0.1, 'Residual settles even while hovered');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.$eval(seg + ' .at-seg-option', e => e.getAttribute('aria-checked')), 'true');
  await page.mouse.move(0, 0);

  await page.click(`${card('select')} .at-select-trigger`); await pause();
  const options = await page.$$('.at-select-option'); await options.at(-1).hover(); await pause();
  const spacing = await page.$eval('.at-select-pop', el => {
    const r = el.getBoundingClientRect(), hl = el.querySelector('.at-select-hl'), h = hl.getBoundingClientRect();
    return { l: h.left - r.left, r: r.right - h.right, b: r.bottom - h.bottom, outer: parseFloat(getComputedStyle(el).borderBottomLeftRadius), inner: parseFloat(getComputedStyle(hl).borderBottomLeftRadius) };
  });
  assert(Math.abs(spacing.l - 4) < 0.2 && Math.abs(spacing.r - 4) < 0.2 && Math.abs(spacing.b - 4) < 0.2);
  assert.equal(spacing.outer - spacing.inner, 4, 'Nested radii follow the 4px inset');
  await page.screenshot({ path: '.backup/foundation-review/select-spacing.png', fullPage: true });
  await page.keyboard.press('Escape'); await pause();
  const inset = await page.$eval(`${card('timeline')} .at-tl-track`, e => e.querySelector('.at-tl-bar').getBoundingClientRect().left - e.getBoundingClientRect().left);
  // timeline.edgePadding default (src/core/schema.ts) — aligned with the Slider's 2.5px shell gap.
  assert(Math.abs(inset - 2.5) < 0.1, 'Zero-time bar has a 2.5px safe area');

  const check = `${card('checkbox')} input`;
  assert(await page.$eval(check, e => e.indeterminate));
  await page.click(check); assert(await page.$$eval(check, es => es.every(e => e.checked && !e.indeterminate)));
  await page.focus(check); await page.keyboard.press('Space'); assert(await page.$$eval(check, es => es.every(e => !e.checked)));
  await page.click(`${card('checkbox')} .pg-checkbox-children input`); assert(await page.$eval(check, e => e.indeterminate));

  const tabs = `${card('tabs')} [role=tab]`;
  await page.focus(tabs); await page.keyboard.press('End'); await pause();
  assert.equal(await page.$eval(`${card('tabs')} [aria-selected=true]`, e => e.textContent), '细节');
  assert((await page.$eval(`${card('tabs')} [role=tabpanel]`, e => e.textContent)).includes('留一点呼吸空间'));
  await page.keyboard.press('Home'); await pause();
  assert.equal(await page.$$eval(`${card('tabs')} [role=tab]`, es => es.filter(e => e.tabIndex === 0).length), 1);

  const feedback = card('feedback');
  await trace('.at-feedback-message');
  await clickText(feedback + ' .at-btn', 'Message'); await pause(700);
  const enter = await stopTrace();
  assert(enter.some(f => f.y > 1 && f.opacity < 1) && enter.at(-1).opacity === 1, 'Message fades and springs upward');
  await trace('.at-feedback-message');
  await page.click('.at-feedback-message .at-feedback-close'); await pause(400);
  const manual = await stopTrace();
  assert(manual.some(f => f.scale > 1.01 && f.blur !== 'blur(0px)'), 'Manual dismissal expands and blurs');
  assert.equal(await page.$('.at-feedback-message'), null);

  await clickText(feedback + ' .at-btn', 'Message'); await pause(550);
  await page.focus('.at-feedback-message .at-feedback-close'); await page.mouse.move(0, 0); await pause(3400);
  assert(await page.$('.at-feedback-message'), 'Keyboard focus pauses automatic dismissal');
  await trace('.at-feedback-message');
  await page.evaluate(() => document.activeElement.blur()); await pause(3400);
  const auto = await stopTrace();
  assert(auto.some(f => f.opacity > 0 && f.opacity < 1 && f.blur !== 'blur(0px)'), 'Automatic dismissal blurs and fades');
  assert(auto.every(f => Math.abs(f.scale - 1) < 0.001), 'Automatic dismissal never expands');
  assert.equal(await page.$('.at-feedback-message'), null);
  await writeFile('.backup/foundation-review/feedback-traces.json', JSON.stringify({ enter, manual, auto }, null, 2));
  await clickText(feedback + ' .at-btn', 'Toast'); await pause();
  assert(await page.$eval('.at-toast-viewport', e => e.parentElement === document.body));
  await page.click('.at-feedback-toast .at-feedback-close'); await pause();
  assert.equal(await page.$('.at-feedback-toast'), null);

  await page.focus(feedback + ' .pg-card'); await page.keyboard.press('Enter'); await page.waitForSelector('.pg-modal'); await pause();
  assert(await page.$('.pg-modal-panel [aria-label="弹出位移"]'), 'Feedback motion parameters are exposed');
  await page.keyboard.press('Escape'); await pause();
  await page.click('[aria-label="减弱动效"]'); await pause();
  await page.hover(seg + ' .at-seg-option:nth-of-type(2)'); await pause();
  assert(Math.abs((await silhouette()).height - rest.height) < 0.1, 'Reduced motion disables the bulge');
  await clickText(feedback + ' .at-btn', 'Toast'); await pause(100);
  await page.click('.at-feedback-toast .at-feedback-close'); await pause(100);
  assert.equal(await page.$('.at-feedback-toast'), null);

  for (const theme of ['light', 'dark']) {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await page.setViewport({ width: 390, height: 844 }); await pause();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `.backup/foundation-review/mobile-${theme}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('PASS segmented bulge/residue, nested Select spacing, Timeline inset, Checkbox mixed/keyboard, Tabs navigation, feedback enter/manual/auto/pause/portal, parameters, reduced motion, mobile themes');
} finally { await browser.close(); }
