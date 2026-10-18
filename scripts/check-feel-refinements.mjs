import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const pause = ms => new Promise(r => setTimeout(r, ms));
const out = '.backup/feel-refinements';
try {
  await mkdir(out, { recursive: true });
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(process.env.ATTUNE_URL ?? 'http://localhost:5188', { waitUntil: 'networkidle0' });
  assert.equal(await page.$$('.pg-card').then(els => els.length), 11);
  await page.screenshot({ path: `${out}/playground.png`, fullPage: true });
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource').map(e => e.name);
    const { default: React } = await import(resources.find(url => url.includes('/deps/react.js?')));
    const { default: ReactDOM } = await import(resources.find(url => url.includes('/deps/react-dom_client.js?')));
    // Vite also versions application modules after edits. Reuse those URLs so
    // the fixture's provider and the mounted components share one FeelContext.
    const loaded = path => import(resources.find(url => new URL(url).pathname === path) ?? path);
    const [{ NumberField }, { NumberInput }, { Timeline }, { Segmented }, { Tabs }, { AttuneProvider }] = await Promise.all([
      loaded('/src/components/Panel.tsx'), loaded('/src/components/Input.tsx'), loaded('/src/components/Timeline.tsx'),
      loaded('/src/components/Segmented.tsx'), loaded('/src/components/Tabs.tsx'), loaded('/src/core/feel.tsx'),
    ]);
    document.getElementById('root').style.display = 'none';
    const host = document.createElement('div'); host.id = 'feel-fixture'; host.className = 'at-root';
    Object.assign(host.style, { margin: '40px', padding: '32px', width: '700px', display: 'grid', gap: '36px', background: 'var(--at-color-surface-panel)' });
    document.body.append(host);
    const h = React.createElement;
    function Fixture() {
      const [number, setNumber] = React.useState(11), [decimal, setDecimal] = React.useState(1.21);
      const [tab, setTab] = React.useState('a'), [segment, setSegment] = React.useState('a');
      const [reduced, setReduced] = React.useState(false), [size, setSize] = React.useState('md');
      const [timelineItems, setTimelineItems] = React.useState(['标题', '卡片', '按钮'].map((label, i) => ({ id: String(i), label, delay: 0, duration: 600 })));
      const [timelineFeel, setTimelineFeel] = React.useState({ pluckAmp: 0 });
      window.fixture = { setNumber, setDecimal, setTab, setReduced, setSize, setTimelineItems, setTimelineFeel };
      return h(AttuneProvider, { value: { reduced } },
        h('div', { id: 'number' }, h(NumberField, { label: '数值', value: number, onChange: setNumber, step: 1, size })),
        h('div', { id: 'decimal' }, h(NumberInput, { value: decimal, onChange: setDecimal, step: 0.01, precision: 2, size })),
        h(Timeline, { items: timelineItems, range: 600, rowHeight: 26, feel: timelineFeel,
          onChange: (id, next) => setTimelineItems(items => items.map(item => item.id === id ? { ...item, ...next } : item)) }),
        h(Segmented, { options: ['a', 'b', 'c'].map((value, i) => ({ value, label: ['第一项', '中间项', '第三项'][i] })), value: segment, onChange: setSegment, size, fullWidth: true }),
        h(Tabs, { items: ['a', 'b', 'c'].map((value, i) => ({ value, label: ['概览', '设置', '详细内容'][i], content: value })), value: tab, onChange: setTab, 'aria-label': '动效检查', size }),
      );
    }
    ReactDOM.createRoot(host).render(h(Fixture));
    window.capture = (read, ms = 500) => new Promise(resolve => {
      const frames = [], start = performance.now();
      function tick() {
        frames.push({ time: performance.now() - start, ...read() });
        if (performance.now() - start < ms) requestAnimationFrame(tick); else resolve(frames);
      }
      requestAnimationFrame(tick);
    });
    window.readDigits = (id = 'number') => [...document.querySelectorAll(`#${id} .at-roll-digit`)].map(el => {
      const strip = el.querySelector('.at-roll-strip'), css = getComputedStyle(strip), r = el.getBoundingClientRect();
      return { target: +el.dataset.digit, y: new DOMMatrixReadOnly(css.transform).f, cell: strip.clientHeight, x: r.x };
    });
    window.edges = (path, x) => {
      const points = [...path.getAttribute('d').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => ({ x: +m[1], y: +m[2] }));
      const sample = ps => {
        const b = ps.findIndex(p => p.x >= x);
        if (b <= 0) return ps[0].y;
        const p = ps[b - 1], q = ps[b];
        return p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x);
      };
      return [sample(points.slice(0, points.length / 2)), sample(points.slice(points.length / 2).reverse())];
    };
    window.readTimeline = (fraction = 0.5) => {
      const track = document.querySelector('#feel-fixture .at-tl-track'), x = track.clientWidth * fraction;
      return { bars: [...track.querySelectorAll('.at-tl-bar')].map(p => window.edges(p, x)), frame: window.edges(track.querySelector('.at-tl-frame-line'), x) };
    };
    window.readLine = () => {
      const r = document.querySelector('#feel-fixture .at-tab-indicator').getBoundingClientRect();
      return { x: r.x, w: r.width, h: r.height };
    };
  });
  await page.waitForSelector('#feel-fixture .at-roll-digit'); await pause(300);
  const start = await page.evaluate(() => window.readDigits());
  const digits = await page.evaluate(async () => {
    window.fixture.setNumber(12);
    return window.capture(() => ({ digits: window.readDigits() }), 350);
  });
  assert(digits.every(f => f.digits[0].y === start[0].y && f.digits[0].x === start[0].x), '11→12: tens remain stationary');
  assert(digits.some(f => f.digits[1].y < start[1].y - 1), '11→12: units roll upward');
  assert.equal(digits.at(-1).digits[1].y, -12 * start[1].cell, 'Units settle on 2');
  const reverse = await page.evaluate(async () => {
    window.fixture.setNumber(11); return window.capture(() => ({ digits: window.readDigits() }), 350);
  });
  assert(reverse.some(f => f.digits[1].y > digits.at(-1).digits[1].y + 1), '12→11 rolls downward');

  await page.evaluate(() => window.fixture.setNumber(19)); await pause(300);
  const carry = await page.evaluate(async () => {
    window.fixture.setNumber(20); return window.capture(() => ({ digits: window.readDigits() }), 350);
  });
  assert(carry.some(f => f.digits[1].y < -19.1 * start[1].cell), '19→20: 9 continues upward toward 0');
  assert.equal(carry.at(-1).digits[1].target, 0);
  assert.equal(carry.at(-1).digits[0].target, 2);
  const decimal = await page.evaluate(async () => {
    window.fixture.setDecimal(1.22); return window.capture(() => ({ digits: window.readDigits('decimal') }), 350);
  });
  assert(decimal.every(f => f.digits[0].y === decimal[0].digits[0].y && f.digits[1].y === decimal[0].digits[1].y), 'Only hundredths move for 1.21→1.22');

  // Use the real label scrub handler, including rapid updates and reversal.
  const label = await page.$('#number [data-scrub]'), labelBox = await label.boundingBox();
  await page.mouse.move(labelBox.x + 12, labelBox.y + 8); await page.mouse.down();
  const scrub = [];
  for (const dx of [3, 4, 5, 6, 5, 4, 3]) {
    await page.mouse.move(labelBox.x + 12 + dx, labelBox.y + 8); await pause(24);
    scrub.push(await page.evaluate(() => window.readDigits()));
  }
  await page.mouse.up(); await pause(300);
  assert(scrub.some(ds => ds.some(d => Math.abs(d.y / d.cell - Math.round(d.y / d.cell)) > 0.01)), 'Rapid dragging still rolls individual wheels');
  const settled = await page.evaluate(() => window.readDigits());
  assert(settled.every(d => Math.abs(d.y / d.cell + 10 + d.target) < 0.001), 'Interrupted scrub settles on the latest value');

  await page.mouse.move(0, 0); await pause(600);
  const rest = await page.evaluate(() => window.readTimeline());
  const hoverRow = async i => {
    const rows = await page.$$('#feel-fixture .at-tl-hit'); const r = await rows[i].boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await pause(800);
    return page.evaluate(() => window.readTimeline());
  };
  const middle = await hoverRow(1);
  assert(middle.bars[0][1] < rest.bars[0][1] - 0.8 && Math.abs(middle.bars[0][0] - rest.bars[0][0]) < 0.05, 'Middle hover dents only the upper neighbour’s bottom edge');
  assert(middle.bars[2][0] > rest.bars[2][0] + 0.8 && Math.abs(middle.bars[2][1] - rest.bars[2][1]) < 0.05, 'Middle hover dents only the lower neighbour’s top edge');
  assert(middle.frame.every((v, i) => Math.abs(v - rest.frame[i]) < 0.05), 'Distant frame edges stay still');
  await page.screenshot({ path: `${out}/timeline-middle.png` });
  const bottom = await hoverRow(2);
  assert(bottom.bars[1][1] < rest.bars[1][1] - 0.8 && Math.abs(bottom.bars[1][0] - rest.bars[1][0]) < 0.05, 'Bottom hover leaves the neighbour’s far side unchanged');
  assert(bottom.frame[1] > rest.frame[1] + 1.5 && Math.abs(bottom.frame[0] - rest.frame[0]) < 0.05, 'Bottom frame yields outward at the same x');
  await page.screenshot({ path: `${out}/timeline-bottom.png` });
  await page.mouse.down();
  const activeFrames = await page.evaluate(() => window.capture(() => window.readTimeline(), 450));
  const active = activeFrames.at(-1);
  assert(active.bars[2][0] < bottom.bars[2][0] - 0.8, 'Press expands the active bar beyond its hover contour');
  assert(active.bars[1][1] < bottom.bars[1][1] - 0.8, 'Neighbour keeps yielding as the active bar expands');
  assert(active.frame[1] > bottom.frame[1] + 0.8, 'Panel edge keeps expanding with the active bar');
  assert(activeFrames.some(f => f.frame[1] > bottom.frame[1] + 0.1 && f.frame[1] < active.frame[1] - 0.1), 'Frame follows the intermediate press frames');
  const awayFromBulge = await page.evaluate(() => window.readTimeline(0.2));
  assert(awayFromBulge.frame[1] > rest.frame[1] + 0.8, 'Press spread influences the full bar, including far from the hover bump');
  await page.screenshot({ path: `${out}/timeline-active.png` });
  const trackRect = await (await page.$('#feel-fixture .at-tl-track')).boundingBox();
  await page.mouse.move(trackRect.x + trackRect.width / 2, trackRect.y + trackRect.height + 40); await pause(400);
  const captured = await page.evaluate(() => window.readTimeline());
  assert(Math.abs(captured.frame[1] - active.frame[1]) < 0.1, 'Pointer capture keeps the active contour influencing the frame outside the lane');
  await page.mouse.up(); await page.mouse.move(0, 0); await pause(600);
  assert.deepEqual(await page.evaluate(() => window.readTimeline()), rest, 'Release outside restores bar, neighbours and frame together');

  // Active pressure also works with the hover bump disabled. Compressing a bar
  // changes its thickness without pressSpread, so this catches resize-only gaps.
  await page.evaluate(() => {
    window.fixture.setTimelineFeel({ pluckAmp: 0, bulge: 0 });
    window.fixture.setTimelineItems(items => items.map(item => item.id === '2' ? { ...item, delay: 100, duration: 400 } : item));
  }); await pause(300);
  const resizeHandle = await page.$('#feel-fixture .at-tl-row[data-item="2"] .at-tl-hit-edge[data-side="right"]');
  const resizeBox = await resizeHandle.boundingBox(), resizeX = resizeBox.x + resizeBox.width / 2, resizeY = resizeBox.y + resizeBox.height / 2;
  await page.mouse.move(resizeX, resizeY); await page.mouse.down();
  await page.mouse.move(resizeX - 150, resizeY); await pause(300);
  const compressed = await page.evaluate(() => window.readTimeline(0.35));
  assert(compressed.bars[2][0] < rest.bars[2][0] - 0.5, 'Compression makes the active bar thicker');
  assert(compressed.bars[1][1] < rest.bars[1][1] - 0.5 && compressed.frame[1] > rest.frame[1] + 0.5, 'Resize thickness drives neighbours and frame even with zero hover bulge');
  await page.mouse.move(resizeX - 60, resizeY); await pause(300);
  const stretchedBack = await page.evaluate(() => window.readTimeline(0.35));
  assert(stretchedBack.frame[1] < compressed.frame[1] - 0.3, 'Avoidance continuously follows reverse resizing');
  await page.mouse.up(); await page.mouse.move(0, 0); await pause(600);
  assert.deepEqual(await page.evaluate(() => window.readTimeline(0.35)), rest, 'Resize recovery also releases neighbour pressure');
  await page.evaluate(() => {
    window.fixture.setTimelineFeel({ pluckAmp: 0 });
    window.fixture.setTimelineItems(items => items.map(item => ({ ...item, delay: 0, duration: 600 })));
  });
  // A partial-width active bar used to leave sharp horns at both of its old
  // endpoints. Full-width fixtures cannot catch that because spread is clamped.
  await page.evaluate(() => window.fixture.setTimelineItems(items => items.map(item => item.id === '2'
    ? { ...item, delay: 90, duration: 240 } : item)));
  await pause(300);
  await hoverRow(2); await page.mouse.down(); await pause(500);
  const partial = await page.$eval('#feel-fixture .at-tl-track', track => {
    const hit = track.querySelector('.at-tl-row[data-item="2"] .at-tl-hit');
    const bar = track.querySelector('.at-tl-row[data-item="2"] .at-tl-bar').getBBox();
    const path = track.querySelector('.at-tl-frame-line');
    const left = parseFloat(hit.style.left), right = left + parseFloat(hit.style.width);
    const positions = [left, left + 2, left + 4, left + 8, right, right - 2, right - 4, right - 8];
    return { capPush: positions.map(x => window.edges(path, x)[1] - (track.clientHeight - 0.5)),
      centerPush: window.edges(path, (left + right) / 2)[1] - (track.clientHeight - 0.5),
      top: bar.y, bottom: bar.y + bar.height };
  });
  await page.screenshot({ path: `${out}/timeline-partial-active.png` });
  assert(Math.max(...partial.capPush) < 1.2, 'Partial bar ends blend into the panel without pressure horns');
  assert(partial.centerPush > 3, 'Smoothing the caps preserves active pressure and hover lift in the body');
  await page.mouse.up(); await page.mouse.move(0, 0); await pause(600);

  // The ceiling constrains the composed SVG silhouette, including transient
  // spring overshoot, and the panel's amplified avoidance. A narrow bar also
  // tightens it further instead of growing a tall bump at either end.
  await page.evaluate(() => {
    window.readLift = () => {
      const track = document.querySelector('#feel-fixture .at-tl-track');
      const bar = track.querySelector('.at-tl-row[data-item="2"] .at-tl-bar').getBBox();
      const frame = track.querySelector('.at-tl-frame-line').getBBox();
      return { lift: Math.max(2.5 - bar.y, bar.y + bar.height - 23.5),
        frameLift: Math.max(0.5 - frame.y, frame.y + frame.height - 77.5) };
    };
    window.fixture.setTimelineFeel({ pluckAmp: 0, bulge: 6, pressSpread: 6, stretchThin: 1, avoidance: 1.5, maxLift: 2 });
  }); await pause(300);
  await hoverRow(2); await page.mouse.down();
  const limitedPress = await page.evaluate(() => window.capture(() => window.readLift(), 450));
  assert(limitedPress.every(f => f.lift <= 2.02 && f.frameLift <= 2.02), 'Strong press and frame avoidance never exceed the configured ceiling');
  assert(limitedPress.at(-1).lift > 1.5, 'The ceiling retains visible active lift');
  await page.mouse.up(); await page.mouse.move(0, 0); await pause(600);

  await page.evaluate(() => window.fixture.setTimelineItems(items => items.map(item => item.id === '2'
    ? { ...item, delay: 90, duration: 400 } : item)));
  await pause(300);
  const capHandle = await page.$('#feel-fixture .at-tl-row[data-item="2"] .at-tl-hit-edge[data-side="right"]');
  const capBox = await capHandle.boundingBox();
  await page.mouse.move(capBox.x + capBox.width / 2, capBox.y + capBox.height / 2); await page.mouse.down();
  await page.mouse.move(capBox.x - 600, capBox.y + capBox.height / 2);
  const limitedResize = await page.evaluate(() => window.capture(() => window.readLift(), 250));
  assert(limitedResize.every(f => f.lift <= 2.02 && f.frameLift <= 2.02), 'Compression to minimum duration cannot bypass the lift ceiling');
  assert(await page.$eval('#feel-fixture .at-tl-row[data-item="2"] .at-tl-hit', el => el.getAttribute('aria-label').includes('时长 20ms')),
    'The compression check reaches the real minimum duration');
  await page.mouse.up(); await page.mouse.move(0, 0); await pause(600);

  await page.evaluate(() => window.fixture.setTimelineItems(items => items.map(item => item.id === '2'
    ? { ...item, delay: 90, duration: 8, resizable: false } : item)));
  await pause(300); await hoverRow(2);
  const narrowHover = await page.evaluate(() => window.readLift());
  assert(narrowHover.lift > 0.1 && narrowHover.lift < 1, 'Sub-height-width hover remains subtle even at maximum bulge');
  await page.mouse.down();
  const narrowPress = await page.evaluate(() => window.capture(() => window.readLift(), 450));
  assert(narrowPress.every(f => f.lift <= 2.02 && f.frameLift <= 2.02), 'Extremely narrow active bars also stay bounded');
  await page.screenshot({ path: `${out}/timeline-narrow-limited.png` });
  await page.mouse.up(); await page.mouse.move(0, 0); await pause(600);

  await page.evaluate(() => {
    window.fixture.setTimelineFeel({ pluckAmp: 0, bulge: 6, pressSpread: 6, maxLift: 0 });
    window.fixture.setTimelineItems(items => items.map(item => ({ ...item, delay: 0, duration: 600, resizable: true })));
  }); await pause(300); await hoverRow(2); await page.mouse.down(); await pause(400);
  const zeroLift = await page.evaluate(() => window.readLift());
  assert(Math.abs(zeroLift.lift) < 0.02 && Math.abs(zeroLift.frameLift) < 0.02, 'A zero ceiling disables outward lift in both the bar and frame');
  await page.mouse.up(); await page.mouse.move(0, 0); await pause(600);
  await page.evaluate(() => window.fixture.setTimelineFeel({ pluckAmp: 0 }));
  await page.evaluate(() => window.fixture.setTimelineItems(items => items.map(item => ({ ...item, delay: 0, duration: 600 }))));
  await page.mouse.move(0, 0); await pause(600);
  const corner = await page.evaluate(() => {
    const track = document.querySelector('#feel-fixture .at-tl-track');
    const r = parseFloat(track.style.borderRadius), bar = track.querySelector('.at-tl-bar');
    const box = bar.getBBox();
    return { frame: r, inner: box.height / 2, gap: box.x, top: box.y };
  });
  assert(Math.abs(corner.frame - corner.inner - corner.gap) < 0.02 && corner.gap === corner.top, 'Frame and bar corners are concentric');

  const segment = '#feel-fixture .at-seg';
  const readSegment = () => page.$eval(segment, el => {
    const p = el.querySelector('.at-seg-track');
    return [0.2, 0.5, 0.8].map(x => window.edges(p, el.clientWidth * x));
  });
  const segRest = await readSegment();
  await (await page.$$(segment + ' .at-seg-option'))[1].hover(); await pause(1000);
  const segHover = await readSegment();
  assert(segHover[1][0] < segRest[1][0] - 2, 'Hovered centre bulges');
  assert([0, 2].every(i => segHover[i][0] > segRest[i][0] + 0.3 && segHover[i][1] < segRest[i][1] - 0.3), 'Both distant ends narrow gently');

  await page.mouse.move(0, 0); await pause(600);
  const beforeLine = await page.evaluate(() => window.readLine());
  const lineFrames = await page.evaluate(async () => {
    window.fixture.setTab('b'); return window.capture(window.readLine, 750);
  });
  assert(Math.max(...lineFrames.map(f => f.w)) > beforeLine.w * 1.15, 'Tab line stretches before catching up');
  assert(Math.min(...lineFrames.map(f => f.h)) < 2.8, 'Stretched line becomes thinner');
  assert(Math.abs(lineFrames.at(-1).h - 3) < 0.02 && Math.abs(lineFrames.at(-1).w - beforeLine.w) < 0.1, 'Line recovers width and thickness');
  const interrupted = await page.evaluate(async () => {
    window.fixture.setTab('c'); setTimeout(() => window.fixture.setTab('a'), 80);
    return window.capture(window.readLine, 1000);
  });
  assert(interrupted.every(f => f.w > 0 && f.h >= 1.49 && Number.isFinite(f.x)), 'Interrupted/reversed line remains finite');
  assert(Math.abs(interrupted.at(-1).x - beforeLine.x) < 0.1, 'Interrupted line reaches the final tab');

  await page.evaluate(() => window.fixture.setReduced(true)); await pause(100);
  const reduced = await page.evaluate(async () => {
    window.fixture.setNumber(42); window.fixture.setTab('c');
    return window.capture(() => ({ line: window.readLine(), digits: window.readDigits() }), 150);
  });
  assert(reduced.every(f => f.digits.every(d => Math.abs(d.y / d.cell + 10 + d.target) < 0.001)), 'Reduced motion snaps all digits');
  assert(reduced.every(f => f.line.h === 3), 'Reduced motion disables stretch/thinning');
  const reducedHover = await hoverRow(2);
  assert.deepEqual(reducedHover, rest, 'Reduced motion disables swell and neighbour/frame avoidance');
  await page.evaluate(() => window.fixture.setReduced(false));
  for (const size of ['sm', 'md', 'lg']) {
    await page.evaluate(size => window.fixture.setSize(size), size); await pause(300);
    const metrics = await page.$eval('#number .at-input', el => {
      const value = el.querySelector('.at-input-value').getBoundingClientRect(), roll = el.querySelector('.at-roll').getBoundingClientRect();
      return { height: el.getBoundingClientRect().height, cy: value.y + value.height / 2 - roll.y - roll.height / 2 };
    });
    assert.equal(metrics.height, { sm: 24, md: 28, lg: 32 }[size]); assert(Math.abs(metrics.cy) < 0.1);
  }
  await page.screenshot({ path: `${out}/rest.png` });
  await page.evaluate(() => { window.fixture.setNumber(11); window.fixture.setTab('a'); }); await pause(600);
  await page.evaluate(() => { window.fixture.setNumber(12); window.fixture.setTab('b'); }); await pause(70);
  await page.screenshot({ path: `${out}/digits-tabs-moving.png` });
  await (await page.$$(segment + ' .at-seg-option'))[1].hover(); await pause(800);
  await page.screenshot({ path: `${out}/segmented-hover.png` });
  await writeFile(`${out}/frames.json`, JSON.stringify({ digits, reverse, carry, decimal, scrub, rest, middle, bottom, activeFrames, captured, compressed, stretchedBack, partial, limitedPress, limitedResize, narrowHover, narrowPress, zeroLift, corner, segRest, segHover, lineFrames, interrupted, reduced }));
  assert.deepEqual(errors, []);
  console.log('PASS per-place rolls/carry/decimals/rapid reversal, Timeline corners/hover/active spread/resize/continuous frame pressure/lift ceilings/narrow bars/release, Segmented narrowing, Tabs stretch/thin/reversal, reduced motion, three sizes');
} finally { await browser.close(); }
