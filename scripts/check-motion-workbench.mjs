import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Shipped inside the skill as verify-example.mjs: resolve puppeteer-core next to this file first,
// then from the project the command runs in (the skill folder itself has no node_modules).
const loadPuppeteer = async () => {
  try { return (await import('puppeteer-core')).default; } catch {
    try { return (await import(pathToFileURL(createRequire(path.join(process.cwd(), 'noop.js')).resolve('puppeteer-core')).href)).default; }
    catch { throw new Error('puppeteer-core not found. Run this from a project that has it installed (e.g. npm i -D puppeteer-core).'); }
  }
};
const puppeteer = await loadPuppeteer();

const origin = process.env.ATTUNE_URL ?? 'http://localhost:5188';
const url = process.env.ATTUNE_MOTION_URL ?? `${origin}/motion.html`;
// Portable: CHROME_PATH wins; otherwise try the usual Chrome/Chromium/Edge locations per OS.
const chromeCandidates = {
  win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
}[process.platform] ?? [];
const executablePath = process.env.CHROME_PATH ?? chromeCandidates.find(existsSync);
if (!executablePath) throw new Error('No Chrome/Chromium found. Set CHROME_PATH to a Chrome, Chromium or Edge executable.');
const shots = process.env.ATTUNE_SHOT_DIR ?? '.backup/motion-review';
const browser = await puppeteer.launch({ executablePath, headless: true });
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
const openAll = async () => {
  for (const toggle of await page.$$('.at-mw-scroll .at-group:not([data-open]) .at-group-toggle')) { await toggle.click(); await pause(450); }
  await pause();
};
const fits = async () => {
  const b = await bounds(); const v = page.viewport();
  assert(b.x >= -1 && b.y >= -1 && b.x + b.w <= v.width + 1 && b.y + b.h <= v.height + 1, `Panel outside viewport: ${JSON.stringify(b)}`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
};
await mkdir(shots, { recursive: true });
try {
  await browser.defaultBrowserContext().overridePermissions(new URL(url).origin, ['clipboard-read', 'clipboard-sanitized-write']);
  await page.setViewport({ width: 1440, height: 960 });
  // A stale v1 fixed height (once written by a stray click on the handle) must not block hugging.
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem(`attune-motion:placement:v1:${JSON.parse(document.querySelector('.ml-config')?.textContent ?? '{}').projectId}`, JSON.stringify({ anchor: 'bottom-center', panel: null, height: 266 })); });
  await page.reload({ waitUntil: 'networkidle0' }); await pause();
  assert.equal(await page.$eval('.at-mw-shell', el => el.dataset.mode), 'minimized');
  const initial = await bounds(); assert(Math.abs(initial.x - (1440 - initial.w) / 2) < 1); assert(initial.w < 160, `Toolbar hugs its content: ${initial.w}`); assert.equal(initial.y, 960 - 52 - 12);
  const bodyStyle = await page.evaluate(() => ({ font: getComputedStyle(document.body).fontSize, color: getComputedStyle(document.body).color }));
  await page.screenshot({ path: `${shots}/01-toolbar.png` });

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
  // Sections start collapsed and the panel hugs them; it grows as they open, up to viewport − 48, then the board
  // scrolls (no scrollbar, a bottom fade until the end). Open sections survive collapse/expand.
  assert.equal(await page.$$eval('.at-mw-scroll .at-group[data-open]', els => els.length), 0, 'Sections start collapsed');
  // Section play buttons sit before the title, in one column with the footer's “重播全部”; no number badges.
  const playColumn = await page.evaluate(() => [...document.querySelectorAll('.at-mw-scroll .at-group-leading button, .at-mw-footer [aria-label="重播全部"]')].map(b => { const r = b.getBoundingClientRect(); return [Math.round((r.left + r.width / 2) * 10) / 10, Math.round(r.width)]; }));
  assert(playColumn.length === 4 && playColumn.every(([x, w]) => x === playColumn[0][0] && w === playColumn[0][1]), `Play buttons aligned: ${JSON.stringify(playColumn)}`);
  assert.equal(await page.$('.at-mw-shell .at-group-badge'), null, 'No section numbers');
  const hugged = await bounds(); assert(hugged.h < 360, `Hugs collapsed sections: ${hugged.h}`);
  await openAll();
  assert.equal(Math.round((await bounds()).h), 960 - 48, 'Grows with open sections up to viewport − 48');
  assert.equal(await page.$('.at-mw-shell .at-scroll-bar'), null, 'No scrollbar on the board');
  assert.equal(await page.$eval('.at-mw-shell .at-scroll', el => el.dataset.fade), 'true', 'Bottom fade while more content below');
  await page.$eval('.at-mw-scroll', el => { el.scrollTop = el.scrollHeight; }); await pause(300);
  assert.equal(await page.$eval('.at-mw-shell .at-scroll', el => el.dataset.fade), undefined, 'No fade at the end');
  await page.$eval('.at-mw-scroll', el => { el.scrollTop = 0; }); await pause(200);
  await click('收起调参面板'); await click('展开调参面板');
  assert.equal(await page.$$eval('.at-mw-scroll .at-group[data-open]', els => els.length), 3, 'Open sections remembered');
  assert.match(await page.$eval('.at-mw-shell', el => getComputedStyle(el).backdropFilter), /blur/);
  await page.screenshot({ path: `${shots}/02-floating.png` });

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

  // The whole header (not just the grip) moves the expanded panel; its buttons still click.
  { const head = await (await page.$('.at-mw-heading')).boundingBox(); const p0 = await bounds();
    // Start on the empty part of the title block (it stretches up to the collapse button); move left only,
    // since a tall panel has no vertical room to move.
    await page.mouse.move(head.x + head.width - 12, head.y + 8); await page.mouse.down(); await page.mouse.move(head.x + head.width - 92, head.y + 8, { steps: 8 }); await page.mouse.up(); await pause();
    const p1 = await bounds(); assert(Math.abs(p1.x - (p0.x - 80)) < 1.5 && Math.abs(p1.y - p0.y) < 1.5, `Header drag moves the panel: ${JSON.stringify([p0, p1])}`); }
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
  // A plain click on the handle keeps the height; double-click returns to hugging, then restore the manual height.
  const handle = await (await page.$('.at-mw-resize')).boundingBox();
  await page.mouse.click(handle.x + handle.width / 2, handle.y + 5); await pause(); assert(Math.abs((await bounds()).h - resized.h) < 1, 'Click does not change height');
  await page.mouse.click(handle.x + handle.width / 2, handle.y + 5, { count: 2 }); await pause();
  assert.equal(Math.round((await bounds()).h), 960 - 48, 'Double-click returns to the default ceiling');
  await resizeBy(resized.h - (960 - 48)); assert(Math.abs((await bounds()).h - resized.h) < 2, 'Manual height again');
  // A dragged height is a ceiling, not a fixed size: collapsing sections still shrinks the panel.
  for (const t of await page.$$('.at-mw-scroll .at-group[data-open] .at-group-toggle')) { await t.click(); await pause(450); }
  await pause(); assert((await bounds()).h < 360, 'Ceiling never adds empty space');
  await openAll(); assert(Math.abs((await bounds()).h - resized.h) < 2, 'Reopened sections stop at the ceiling');
  await page.screenshot({ path: `${shots}/03-resized.png` });
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
  await page.reload({ waitUntil: 'networkidle0' }); await click('展开调参面板'); await openAll();
  assert(Math.abs((await bounds()).x - remembered.x) < 1, 'Position persisted across reload');
  assert(Math.abs((await bounds()).h - resized.h) < 1, 'Height persisted across reload');

  // Preset (design tokens) is a ToggleButton in the footer — no sheet. Off it is an icon button the
  // size of its neighbours; on it turns graphite and shows “启用预设 ×”. Token fields, snapping, curve
  // presets, export, persistence and turning it off are checked below.
  const toggle = '.at-mw-footer .at-toggle-btn';
  const offBox = await (await page.$(toggle)).boundingBox(); const copyBox = await (await page.$('[aria-label="复制完整 JSON"]')).boundingBox();
  assert(Math.abs(offBox.width - copyBox.width) < 0.5 && Math.abs(offBox.height - copyBox.height) < 0.5, 'Off toggle matches icon buttons');
  assert.equal(await page.$eval(toggle, el => el.getAttribute('aria-pressed')), 'false');
  assert.equal(await page.$('.at-mw-sheet, [role="dialog"]'), null, 'No preset sheet');
  await page.click(toggle); await pause();
  assert.equal(await page.$eval(toggle, el => el.getAttribute('aria-pressed')), 'true');
  assert.match(await page.$eval(toggle, el => el.textContent), /启用预设/);
  assert.equal(await page.$eval(toggle, el => el.dataset.pressed), 'true', 'On = selected state');
  assert.match(await page.$eval('[role="status"]', el => el.textContent), /个参数改为 token 选择/);
  // Token-mapped number fields become a token dropdown (no slider); px fields stay sliders.
  const tokenFields = await page.$$eval('.at-mw-scroll .at-token-field', els => els.length);
  assert(tokenFields >= 6, `ms fields use token dropdowns: ${tokenFields}`);
  assert.equal(await page.$$eval('.at-mw-scroll .at-token-field .at-slider', els => els.length), 0, 'No slider in token mode');
  const durations = [0, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 2000];
  const segValue = async () => (await snapshot()).animations.entrance.duration;
  assert(durations.includes(await segValue()), 'Value moved onto a token');
  assert.equal((await snapshot()).animations.entrance.delay, 0, '0 stays a valid choice');
  const tokenTrigger = '.at-mw-scroll .at-group:first-child .at-token-field .at-select-trigger';
  const pick = async text => {
    await page.$eval(tokenTrigger, el => el.scrollIntoView({ block: 'center' })); await pause(250); // scrolling the board closes an open select
    await page.click(tokenTrigger); await pause(450);
    assert(await page.$eval('.at-select-option[data-selected]', el => { const v = el.closest('.at-select-view').getBoundingClientRect(), r = el.getBoundingClientRect(); return r.top >= v.top - 1 && r.bottom <= v.bottom + 1; }), 'Selected option scrolled into view');
    await page.evaluate(t => [...document.querySelectorAll('.at-select-option')].find(o => o.querySelector('.at-token-option-name')?.textContent === t).click(), text); await pause();
  };
  await pick('medium-1'); assert.equal(await segValue(), 400, 'Picking a token sets its value');
  // Deselect: “自定义” reveals a free continuous slider; a token collapses it again.
  await pick('自定义');
  const free = '.at-mw-scroll .at-group:first-child .at-token-field [role="slider"]';
  assert(await page.$(free), 'Custom mode shows a slider');
  assert.equal(await page.$eval(free, el => el.closest('.at-slider').querySelectorAll('.at-slider-mark').length), 0, 'Free slider is continuous');
  await page.focus(free); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await pause();
  assert.equal(await segValue(), 420, 'Free tuning between tokens');
  assert.match(await page.$eval(tokenTrigger, el => el.textContent), /自定义\s*420/);
  await click('复制完整 JSON');
  const tokenExport = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(tokenExport.tokenSet, '设计组 Motion Token');
  assert.equal(tokenExport.animations.entrance.tokens?.duration, undefined, 'Custom value is not exported as a token');
  assert.match(tokenExport.animations.notice.tokens.duration, /^Duration\//);
  await pick('short-3'); assert.equal(await segValue(), 200);
  assert.equal(await page.$(free), null, 'Picking a token hides the free slider');
  await page.reload({ waitUntil: 'networkidle0' }); await click('展开调参面板'); await openAll();
  assert.equal(await page.$eval(toggle, el => el.getAttribute('aria-pressed')), 'true', 'Preset choice persisted');
  await page.click(toggle); await pause();
  assert.equal(await page.$eval(toggle, el => el.getAttribute('aria-pressed')), 'false');
  assert.match(await page.$eval('[role="status"]', el => el.textContent), /已关闭预设/);
  assert.equal(await page.$('.at-mw-scroll .at-token-field'), null, 'Removing tokens restores sliders');
  await click('重置全部参数');

  // Collapse animates through intermediate sizes and can be reversed mid-way.
  await page.click('[aria-label="收起调参面板"]'); await pause(80);
  const during = await bounds(); assert(during.w > 146 && during.w < 360, `No intermediate collapse frame: ${during.w}`);
  await pause(); await click('展开调参面板');
  for (const width of [390, 320]) { await page.setViewport({ width, height: 844 }); await pause(); await fits(); }
  await page.screenshot({ path: `${shots}/04-mobile.png` });
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
  console.log(`PASS: six anchors, position + height memory, play column alignment, header drag, hug height (collapsed sections, grow, cap = viewport − 48, fade, remembered sections, dblclick auto), preset toggle (size, on/off, token dropdowns, pick, deselect → free slider, export, persistence), bottom-edge resize (min/viewport/keyboard), no host reflow, collapse interruption, 3 live adapters, numeric/slider updates, replay isolation, real clipboard + denial, 320/390px, reduced preferences, unmount.\nTested ${url}`);
} finally { await browser.close(); }
