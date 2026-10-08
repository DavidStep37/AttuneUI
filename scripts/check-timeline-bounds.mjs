import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const pause = (ms = 160) => new Promise(resolve => setTimeout(resolve, ms));
const url = process.env.ATTUNE_URL ?? 'http://localhost:5188';
const bounds = selector => page.$eval(selector, el => {
  const track = el.querySelector('.at-tl-track').getBoundingClientRect();
  const bars = [...el.querySelectorAll('.at-tl-bar')].map(bar => {
    const r = bar.getBoundingClientRect();
    return { left: r.left - track.left, right: r.right - track.right };
  });
  const readout = el.querySelector('.at-tl-readout');
  const r = readout?.getBoundingClientRect();
  return { bars, label: r && { left: r.left - track.left, right: r.right - track.right, clipped: readout.scrollWidth > readout.clientWidth }, ticks: [...el.querySelectorAll('.at-tl-tick')].map(e => +e.textContent) };
});
const contained = state => {
  assert(state.bars.every(r => r.left >= -0.1 && r.right <= 0.1), 'All linked bars stay inside the track');
  if (state.label) assert(state.label.left >= 0 && state.label.right <= 0 && !state.label.clipped, 'Readout fits without clipping its text');
};
const drag = async (root, row, part, distance) => {
  const target = await page.$(`${root} .at-tl-row:nth-of-type(${row}) ${part}`);
  await target.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const r = await target.boundingBox();
  const x = r.x + r.width / 2, y = r.y + r.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  for (const fraction of [0.2, 0.5, 1, 0.7]) {
    await page.mouse.move(x + distance * fraction, y); await pause();
    contained(await bounds(root));
  }
  const state = await bounds(root);
  await pause(200);
  assert.deepEqual(await bounds(root), state, 'Stationary pointer cannot repeatedly expand the range');
  await page.screenshot({ path: `.backup/timeline-bounds/${page.viewport().width}-${row}-${part.includes('edge') ? 'resize' : 'move'}.png` });
  await page.mouse.up(); await pause(); contained(await bounds(root));
};
try {
  await mkdir('.backup/timeline-bounds', { recursive: true });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.click('.pg-header [role=radio]:nth-child(3)');
    await page.waitForSelector('.pg-sample-tl');
    // The background grid is the first div; rows start at nth-of-type(2).
    await drag('.pg-sample-tl', 3, '.at-tl-hit-body', 500);
    await drag('.pg-sample-tl', 7, '.at-tl-hit-edge[data-side="right"]', 400);
    await drag('.pg-sample-tl', 2, '.at-tl-hit-body', -500);
    console.log(`PASS ${width}px: linked delays/durations, both boundaries, readout containment, stable range`);
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    // Reuse Vite's exact versioned URLs so the fixture shares React's hooks
    // dispatcher with the component instead of creating a second React copy.
    const resources = performance.getEntriesByType('resource').map(entry => entry.name);
    const { default: React } = await import(resources.find(url => url.includes('/deps/react.js?')));
    const { default: ReactDOM } = await import(resources.find(url => url.includes('/deps/react-dom_client.js?')));
    const { Timeline } = await import('/src/components/Timeline.tsx');
    const host = document.createElement('div'); host.id = 'fixed-timeline-test';
    Object.assign(host.style, { position: 'fixed', top: '150px', left: '100px', width: '260px', zIndex: '2000', background: 'white' });
    document.body.append(host);
    function Fixture() {
      const [items, setItems] = React.useState([{ id: 'test', label: 'Test', delay: 100, duration: 200 }]);
      return React.createElement(Timeline, { items, range: 1000, onChange: (_, next) => setItems([{ ...items[0], ...next }]) });
    }
    ReactDOM.createRoot(host).render(React.createElement(Fixture));
  });
  await page.waitForSelector('#fixed-timeline-test .at-tl-hit');
  await drag('#fixed-timeline-test', 2, '.at-tl-hit-body', 900);
  await drag('#fixed-timeline-test', 2, '.at-tl-hit-edge[data-side="right"]', 900);
  assert.equal(await page.$eval('#fixed-timeline-test .at-tl-hit', e => e.getAttribute('aria-valuenow')), '800');
  await page.focus('#fixed-timeline-test .at-tl-hit'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval('#fixed-timeline-test .at-tl-hit', e => e.getAttribute('aria-valuenow')), '800');
  console.log('PASS fixed range: drag/resize/keyboard stop at the maximum');
} finally { await browser.close(); }
