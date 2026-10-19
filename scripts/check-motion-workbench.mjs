import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const origin = process.env.ATTUNE_URL ?? 'http://localhost:5188';
const url = process.env.ATTUNE_MOTION_URL ?? `${origin}/motion.html`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pause = (ms = 650) => new Promise(resolve => setTimeout(resolve, ms));
const click = async label => { await page.click(`[aria-label="${label}"]`); await pause(); };
const bounds = () => page.$eval('.at-mw-shell', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const counts = () => page.$$eval('[data-count]', els => Object.fromEntries(els.map(el => [el.dataset.count, Number(el.textContent.match(/\d+/)[0])])));
const snapshot = () => page.$eval('.ml-config', el => JSON.parse(el.textContent));
const dragTo = async (x, y) => {
  const grip = await page.$('.at-mw-grip'); const b = await grip.boundingBox(); const shell = await bounds();
  await page.mouse.move(b.x + 12, b.y + 14); await page.mouse.down();
  await page.mouse.move(b.x + 12 + x - shell.x, b.y + 14 + y - shell.y, { steps: 12 }); await page.mouse.up(); await pause();
};
const fits = async () => {
  const b = await bounds(); const v = page.viewport();
  assert(b.x >= -1 && b.y >= -1 && b.x + b.w <= v.width + 1 && b.y + b.h <= v.height + 1, `Panel outside viewport: ${JSON.stringify(b)}`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
};
await mkdir('.backup/motion-review', { recursive: true });
try {
  await browser.defaultBrowserContext().overridePermissions(new URL(url).origin, ['clipboard-read', 'clipboard-sanitized-write']);
  await page.setViewport({ width: 1440, height: 960 });
  await page.goto(url, { waitUntil: 'networkidle0' }); await pause();
  assert.equal(await page.$eval('.at-mw-shell', el => el.dataset.mode), 'minimized');
  const initial = await bounds(); assert(Math.abs(initial.x - (1440 - initial.w) / 2) < 1); assert(initial.w < 160, `Toolbar hugs its content: ${initial.w}`); assert.equal(initial.y, 960 - 52 - 12);
  const bodyStyle = await page.evaluate(() => ({ font: getComputedStyle(document.body).fontSize, color: getComputedStyle(document.body).color }));
  await page.screenshot({ path: '.backup/motion-review/01-toolbar.png' });

  // Six actual pointer drags and independent default expansion placement.
  for (const [anchor, x, y] of [['top-left', 12, 12], ['top-center', 598, 12], ['top-right', 1184, 12], ['bottom-left', 12, 896], ['bottom-center', 598, 896], ['bottom-right', 1184, 896]]) {
    await dragTo(x, y);
    assert.equal(await page.$eval('.at-mw-shell', el => el.dataset.anchor), anchor);
    await click('展开调参面板');
    const p = await bounds(); assert(Math.abs(p.x - 1064) < 1 && Math.abs(p.y - 16) < 1, `Default right expansion from ${anchor}`);
    await click('收起调参面板');
  }
  await page.focus('.at-mw-grip'); await page.keyboard.press('ArrowLeft'); await pause();
  assert.equal(await page.$eval('.at-mw-shell', el => el.dataset.anchor), 'bottom-center');
  await click('展开调参面板');
  assert.equal(await page.$$eval('.at-mw-scroll > .at-scroll-content > .at-group', els => els.length), 3);
  assert.match(await page.$eval('.at-mw-shell', el => getComputedStyle(el).backdropFilter), /blur/);
  await page.screenshot({ path: '.backup/motion-review/02-floating.png' });

  // Change a real native slider and verify actual host WAAPI timing and isolation.
  const before = await counts();
  await page.focus('.at-mw-scroll [role="slider"][aria-label="渐入时长"]'); await page.keyboard.press('ArrowRight'); await pause();
  assert.equal((await snapshot()).animations.entrance.duration, 650);
  const changed = await counts(); assert.equal(changed.entrance, before.entrance + 1); assert.equal(changed.hover, before.hover); assert.equal(changed.notice, before.notice);
  assert.equal(await page.$eval('[data-animation="entrance"]', el => el.getAnimations()[0].effect.getTiming().duration), 650);
  // Numeric editing must hit the same state as the slider.
  const input = '.at-mw-scroll .at-group:first-child input[aria-label="渐入时长"]';
  await page.click('.at-mw-scroll > .at-scroll-content > .at-group:first-child [role="spinbutton"][aria-label="渐入时长"]');
  await page.waitForSelector(input); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.type('920'); await page.keyboard.press('Enter'); await pause();
  assert.equal((await snapshot()).animations.entrance.duration, 920);
  await page.focus('.at-mw-scroll .at-group:nth-child(2) [role="slider"][aria-label="单程时长"]'); await page.keyboard.press('ArrowRight'); await pause();
  assert.equal((await snapshot()).animations.hover.duration, 250);
  await click('复制完整 JSON');
  await page.waitForFunction(() => document.querySelector('[role="status"]').textContent === '完整 JSON 已复制');
  const exported = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(exported.schemaVersion, 1); assert.equal(Object.keys(exported.animations).length, 3);
  assert.equal(exported.animations.entrance.parameters.duration, 920); assert.equal(exported.animations.hover.parameters.duration, 250);
  assert.equal(exported.animations.notice.parameters.hold, 1000); assert.equal(exported.animations.entrance.units.duration, 'ms');

  await dragTo(480, 150); const remembered = await bounds();
  await click('收起调参面板'); await click('展开调参面板');
  const restored = await bounds(); assert(Math.abs(restored.x - remembered.x) < 1 && Math.abs(restored.y - remembered.y) < 1);
  // No sidebar / Push: the host page is never reflowed.
  assert.equal(await page.$('[aria-label="切换侧边栏"], [data-attune-host]'), null, 'Sidebar mode removed');
  assert.equal(await page.$eval('.ml-page', el => Math.round(el.getBoundingClientRect().width)), 1440);
  // Bottom-edge height resize: top edge stays, bounded by min height and the viewport, remembered.
  const resizeBy = async dy => { const h = await (await page.$('.at-mw-resize')).boundingBox(); await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down(); await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + dy, { steps: 10 }); await page.mouse.up(); await pause(); };
  const tall = await bounds(); await resizeBy(-200); const short = await bounds();
  assert(Math.abs(short.h - (tall.h - 200)) < 2 && Math.abs(short.y - tall.y) < 1, `Resize shorter keeps the top: ${JSON.stringify([tall, short])}`);
  await resizeBy(-2000); assert(Math.abs((await bounds()).h - 260) < 1, 'Minimum height');
  await resizeBy(2000); const maxed = await bounds(); assert(Math.abs(maxed.y + maxed.h - (960 - 12)) < 1.5, `Bounded by viewport: ${JSON.stringify(maxed)}`);
  await page.focus('.at-mw-resize'); await page.keyboard.press('ArrowUp'); await pause(); assert(Math.abs((await bounds()).h - (maxed.h - 20)) < 1, 'Keyboard resize');
  await resizeBy(-150); const resized = await bounds();
  await click('收起调参面板'); await click('展开调参面板'); assert(Math.abs((await bounds()).h - resized.h) < 1, 'Height remembered');
  await page.screenshot({ path: '.backup/motion-review/03-resized.png' });
  await click('收起调参面板');

  // Replay is scoped to registered adapters; menu hover, direct click and keyboard all work.
  const allBefore = await counts(); await click('重播全部动效'); const allAfter = await counts();
  for (const id of Object.keys(allBefore)) assert.equal(allAfter[id], allBefore[id] + 1);
  await page.mouse.move(10, 450); await page.hover('[aria-label="重播全部动效"]'); await pause(100);
  assert(await page.$('[role="menu"]'));
  const item = await page.$('[role="menuitem"]'); await item.hover(); await pause(250); assert(await page.$('[role="menu"]'));
  const oneBefore = await counts(); await item.click(); await pause(); const oneAfter = await counts();
  assert.equal(oneAfter.entrance, oneBefore.entrance + 1); assert.equal(oneAfter.hover, oneBefore.hover); assert.equal(oneAfter.notice, oneBefore.notice);
  assert.equal(await page.$('.at-mw-divider, [aria-label="选择单个动效"]'), null, 'Toolbar has no dividers or separate menu arrow');
  await page.mouse.move(10, 450); await pause(300);
  await page.focus('[aria-label="重播全部动效"]'); await page.keyboard.press('ArrowDown'); await pause(100); await page.keyboard.press('ArrowDown');
  const keyBefore = await counts(); await page.keyboard.press('Enter'); await pause(); const keyAfter = await counts(); assert.equal(keyAfter.hover, keyBefore.hover + 1);
  await page.keyboard.press('ArrowDown'); await pause(100); await page.keyboard.press('Escape'); assert.equal(await page.$('[role="menu"]'), null);

  // Real clipboard denial must offer data, without a false success.
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('denied'); } }));
  await click('复制完整 JSON');
  const fallback = await page.$eval('.at-mw-copy-fallback textarea', el => el.value); assert.deepEqual(JSON.parse(fallback), exported);
  assert.match(await page.$eval('[role="status"]', el => el.textContent), /剪贴板不可用/);
  await page.reload({ waitUntil: 'networkidle0' }); await click('展开调参面板');
  assert(Math.abs((await bounds()).x - remembered.x) < 1, 'Position persisted across reload');
  assert(Math.abs((await bounds()).h - resized.h) < 1, 'Height persisted across reload');

  // Collapse animates through intermediate sizes and can be reversed mid-way.
  await page.click('[aria-label="收起调参面板"]'); await pause(80);
  const during = await bounds(); assert(during.w > 146 && during.w < 360, `No intermediate collapse frame: ${during.w}`);
  await pause(); await click('展开调参面板');
  for (const width of [390, 320]) { await page.setViewport({ width, height: 844 }); await pause(); await fits(); }
  await page.screenshot({ path: '.backup/motion-review/04-mobile.png' });
  await click('收起调参面板'); await fits();
  await page.setViewport({ width: 1440, height: 960 }); await pause();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await pause();
  await click('展开调参面板'); assert.equal(await page.$eval('.at-mw-root', el => el.dataset.reducedMotion), 'true');
  await click('重播卡片入场'); assert.equal(await page.$eval('[data-animation="entrance"]', el => el.getAnimations()[0].effect.getTiming().duration), 0);
  const cdp = await page.createCDPSession(); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] }); await pause();
  assert.equal(await page.$eval('.at-mw-root', el => el.dataset.atMaterial), 'solid');
  assert.equal(await page.$eval('.at-mw-shell', el => getComputedStyle(el).backdropFilter), 'none');
  await page.$eval('.ml-bottom button', el => el.click()); await pause(); assert.equal(await page.$('.at-mw-root'), null);
  assert.deepEqual(await page.evaluate(() => ({ font: getComputedStyle(document.body).fontSize, color: getComputedStyle(document.body).color })), bodyStyle);
  assert.deepEqual(errors, []);
  console.log(`PASS: six anchors, position + height memory, bottom-edge resize (min/viewport/keyboard), no host reflow, collapse interruption, 3 live adapters, numeric/slider updates, replay isolation, real clipboard + denial, 320/390px, reduced preferences, unmount.\nTested ${url}`);
} finally { await browser.close(); }
