import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const origin = process.env.ATTUNE_URL ?? 'http://localhost:5188';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pause = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
const clickText = async (selector, text) => {
  for (const element of await page.$$(selector)) {
    if ((await element.evaluate(el => el.textContent)).trim() === text) { await element.click(); return; }
  }
  throw new Error(`Missing ${selector}: ${text}`);
};
const fits = async () => {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
  assert(await page.evaluate(() => {
    const stage = document.querySelector('.sc-stage').getBoundingClientRect();
    const footer = document.querySelector('.sc-demo-panel .at-panel-footer').getBoundingClientRect();
    return footer.bottom < stage.bottom - 32 && footer.right < stage.right && footer.left > stage.left;
  }), 'Studio controls must stay fully visible inside the stage');
  assert(await page.evaluate(() => {
    const button = document.querySelector('.sc-demo-panel .at-group-toggle');
    const box = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), 'Decorative canvas objects must not cover panel controls');
};
try {
  await mkdir('.backup/showcase-review', { recursive: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-color-scheme', value: 'light' }]);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(new URL('/showcase.html', origin).href, { waitUntil: 'networkidle0' });
  assert.equal(await page.$$('[data-demo]').then(cards => cards.length), 11);
  assert.deepEqual(await page.evaluate(() => ({ rootFont: getComputedStyle(document.documentElement).fontSize, tokens: getComputedStyle(document.documentElement).getPropertyValue('--at-color-slider-fill'), injected: !!document.querySelector('style[data-attune]'), storage: localStorage.length })), { rootFont: '16px', tokens: '', injected: false, storage: 0 });
  await fits();
  await page.screenshot({ path: '.backup/showcase-review/desktop.png', fullPage: true });
  await page.screenshot({ path: '.backup/showcase-review/hero.png' });

  // Values are real controlled components and the size switch keeps exact slots.
  const slider = '[data-demo="Slider"] [role="slider"]';
  await page.focus(slider); await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval(slider, el => el.getAttribute('aria-valuenow')), '65');
  for (const [label, height] of [['24', 24], ['28', 28], ['32', 32]]) {
    await clickText('[aria-label="组件尺寸"] button', label);
    assert.equal(await page.$eval('[data-demo="Button"] .at-btn', el => el.offsetHeight), height);
    assert.equal(await page.$eval('[data-demo="Button"] .at-btn', el => getComputedStyle(el).fontSize), '12px');
  }
  await clickText('[aria-label="组件尺寸"] button', '28');

  // Portal follows the local dark theme while the host root stays untouched.
  await page.click('[aria-label="切换深色"]');
  const select = '[data-demo="Select"] .at-select-trigger';
  await page.$eval(select, el => el.scrollIntoView({ block: 'center' })); await pause(150);
  await page.click(select); await pause();
  assert.equal(await page.$eval('.at-select-pop', el => getComputedStyle(el).getPropertyValue('--at-color-text-primary').trim()), '#E8EDF4');
  await page.focus(select); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await pause();
  assert.match(await page.$eval(select, el => el.textContent), /Ease in/);
  await clickText('[data-demo="Feedback"] button', 'Apply changes'); await pause();
  assert.equal(await page.$eval('.at-toast-viewport', el => getComputedStyle(el).getPropertyValue('--at-color-text-primary').trim()), '#E8EDF4');
  await page.click('.at-feedback-close'); await pause();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.backup/showcase-review/dark.png', fullPage: true });
  await page.click('[aria-label="切换浅色"]');

  // Material and custom radius affect real panels; nested solid resets frosted tokens.
  const surface = '.sc-material-panel';
  assert.match(await page.$eval(surface, el => getComputedStyle(el).backdropFilter), /blur\(18px\)/);
  await clickText('[aria-label="表面材质"] button', '实底');
  assert.equal(await page.$eval(surface, el => getComputedStyle(el).backdropFilter), 'none');
  await clickText('[aria-label="表面材质"] button', '毛玻璃');
  const radiusSlider = '#material [role="slider"][aria-label="面板圆角"]';
  await page.focus(radiusSlider); await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval(surface, el => getComputedStyle(el).borderTopLeftRadius), '17px');
  const blurSlider = '#material [role="slider"][aria-label="背景模糊"]';
  await page.focus(blurSlider); await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval(surface, el => getComputedStyle(el).backdropFilter), 'blur(19px)');
  await page.$eval('#material', el => el.scrollIntoView());
  await page.screenshot({ path: '.backup/showcase-review/material.png' });

  await page.evaluate(() => scrollTo(0, 0));
  await clickText('.sc-stage button', '挂到页面'); await pause();
  const panel = await page.$('.sc-floating-panel');
  const before = await panel.boundingBox();
  const head = await page.$('.sc-floating-panel .at-panel-head');
  const box = await head.boundingBox();
  await page.mouse.move(box.x + 80, box.y + 18); await page.mouse.down();
  await page.mouse.move(box.x - 30, box.y + 78, { steps: 8 }); await page.mouse.up();
  const after = await panel.boundingBox();
  assert(Math.abs(after.x - before.x + 110) < 2 && Math.abs(after.y - before.y - 60) < 2, 'Floating panel must move with header drag');
  await page.click('.sc-floating-panel [aria-label="收起面板"]'); await pause();
  assert((await panel.boundingBox()).height < 90);
  await page.click('.sc-floating-panel [aria-label="展开面板"]'); await pause();
  await page.click('.sc-floating-panel [aria-label="关闭"]');
  assert.equal(await page.$('.sc-floating-panel'), null);

  // Both downloads must be concrete resources, not SPA fallbacks.
  const resources = await page.evaluate(async () => {
    const registry = await fetch('./r/attune-ui.json').then(r => r.json());
    const docs = await fetch('./getting-started.md').then(r => r.text());
    return { files: registry.files.length, docs: docs.startsWith('# Attune UI') };
  });
  assert(resources.files >= 23 && resources.docs);
  await browser.defaultBrowserContext().overridePermissions(new URL(origin).origin, ['clipboard-read', 'clipboard-sanitized-write']);
  await page.bringToFront();
  await page.click('.sc-main-code .sc-copy');
  await page.waitForFunction(() => document.querySelector('.sc-main-code .sc-copy-status').textContent === '已复制');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /export function MotionTools/);

  for (const width of [768, 390, 320]) {
    await page.setViewport({ width, height: 900 }); await page.evaluate(() => scrollTo(0, 0)); await pause();
    await fits();
    if (width === 390) {
      await page.screenshot({ path: '.backup/showcase-review/mobile.png', fullPage: true });
      await page.screenshot({ path: '.backup/showcase-review/mobile-hero.png' });
    }
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await pause();
  assert.equal(await page.$eval('.sc-site', el => el.getAttribute('data-reduced-motion')), 'true');
  assert.equal(await page.$eval('.sc-studio-scope', el => el.getAttribute('data-reduced-motion')), 'true');
  // CDP exposes this newer media feature before Puppeteer's convenience API.
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await pause();
  assert.equal(await page.$eval(surface, el => getComputedStyle(el).backdropFilter), 'none');
  assert.equal(await page.$eval('.sc-studio-scope', el => el.getAttribute('data-at-material')), 'solid');
  assert.deepEqual(errors, []);
  console.log('PASS: 11 demos, scoped host styles/storage, keyboard values, 24/28/32 slots, dark portals, material/radius, draggable panel, downloads/copy, 1440/768/390/320 layouts, reduced motion/transparency.');
} finally { await browser.close(); }
