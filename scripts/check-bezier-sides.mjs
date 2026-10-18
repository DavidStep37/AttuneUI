import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { bezierSideEdges } from '../src/core/bezierSides.ts';

for (const size of [120, 200, 320]) {
  const edges = bezierSideEdges([0, 0, 1, 1], size);
  edges.upper.forEach((y, i) => {
    const line = size - i / (edges.upper.length - 1) * size;
    assert(Math.abs((line - y) / Math.SQRT2 - 3.5) < 0.01, 'Upper normal clearance is 2.5px from the 2px stroke');
    assert(Math.abs((edges.lower[i] - line) / Math.SQRT2 - 3.5) < 0.01, 'Lower normal clearance matches');
  });
  for (const curve of [[0, 1, 0, 1], [1, -1, 0, 2], [-0.06, 1.28, 1.06, -0.28]]) {
    const e = bezierSideEdges(curve, size);
    assert(e.upper.every((y, i) => Number.isFinite(y) && Number.isFinite(e.lower[i]) && y < e.lower[i]));
    const points = Array.from({ length: 4097 }, (_, i) => {
      const t = i / 4096, u = 1 - t;
      return [size * (3*u*u*t*curve[0]+3*u*t*t*curve[2]+t**3), size * (1-3*u*u*t*curve[1]-3*u*t*t*curve[3]-t**3)];
    });
    for (const edge of [e.upper, e.lower]) for (let k = 20; k < edge.length - 20; k += 16) {
      const x = k / (edge.length - 1) * size, y = edge[k];
      if (y < 10 || y > size - 10) continue;
      const distance = Math.min(...points.map(p => Math.hypot(x-p[0], y-p[1])));
      assert(Math.abs(distance - 3.5) < 0.06, `Curved normal clearance remains uniform: ${distance}`);
    }
  }
}
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const pause = ms => new Promise(r => setTimeout(r, ms));
try {
  await page.setViewport({ width: 900, height: 850, deviceScaleFactor: 2 });
  await page.goto(process.env.ATTUNE_URL ?? 'http://localhost:5188', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource').map(e => e.name);
    const load = path => import(resources.find(url => new URL(url).pathname === path) ?? path);
    const { default: React } = await import(resources.find(url => url.includes('/deps/react.js?')));
    const { default: ReactDOM } = await import(resources.find(url => url.includes('/deps/react-dom_client.js?')));
    const { BezierEditor } = await load('/src/components/BezierEditor.tsx');
    const { AttuneProvider } = await load('/src/core/feel.tsx');
    document.getElementById('root').style.display = 'none';
    document.documentElement.dataset.theme = 'light';
    const host = document.createElement('div'); host.id = 'fixture'; host.className = 'at-root';
    host.style.cssText = 'padding:40px;width:300px;background:white'; document.body.append(host);
    function Fixture() {
      const [value, setValue] = React.useState([.25,.25,.75,.75]);
      const [reduced, setReduced] = React.useState(false);
      window.fixture = { setValue, setReduced };
      return React.createElement(AttuneProvider, { value: { reduced } }, React.createElement(BezierEditor,
        { value, onChange: setValue, size: 240, showInputs: false, showPresets: false, showPreview: false }));
    }
    ReactDOM.createRoot(host).render(React.createElement(Fixture));
  });
  await page.waitForSelector('#fixture .at-bezier-side'); await pause(200);
  const paths = () => page.$$eval('#fixture .at-bezier-side', els => els.map(e => e.getAttribute('d')));
  const handle = async () => (await page.$('#fixture .at-bezier-hit')).boundingBox();
  const rest = await paths();
  let r = await handle();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down();
  await page.mouse.move(r.x+r.width/2-30,r.y+r.height/2-45); await pause(150);
  const pushed = await paths();
  assert.notEqual(pushed[0], rest[0]); assert.equal(pushed[1], rest[1], 'Unpushed lower surface stays exactly fixed');
  await mkdir('.backup/bezier-sides', { recursive: true });
  await (await page.$('#fixture')).screenshot({ path: '.backup/bezier-sides/drag.png' });
  await page.mouse.up(); await pause(80);
  const midway = await paths(); assert.notEqual(midway[1], pushed[1], 'Release starts closing the vacant side');
  await pause(1200); const settled = await paths(); assert.notEqual(settled[1], midway[1]);
  await (await page.$('#fixture')).screenshot({ path: '.backup/bezier-sides/settled.png' });
  await page.evaluate(() => window.fixture.setValue([.25,.25,.75,.75])); await pause(1300);
  const reset = await paths(); r = await handle();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down();
  await page.mouse.move(r.x+r.width/2+25,r.y+r.height/2+40); await pause(150);
  const down = await paths(); assert.equal(down[0], reset[0]); assert.notEqual(down[1], reset[1]);
  await page.mouse.up(); await pause(60);
  r = await handle(); const interrupted = await paths();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down(); await pause(100);
  const held = await paths(); await pause(100); assert.deepEqual(await paths(), held, 'Re-grabbing freezes the current contours');
  assert(interrupted.every(d => !/NaN|Infinity/.test(d)));
  await page.mouse.up(); await pause(1300);
  await page.evaluate(() => { window.fixture.setReduced(true); window.fixture.setValue([.25,.25,.75,.75]); }); await pause(100);
  r = await handle(); await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2-48); await pause(100);
  const reduced = await paths(); await page.mouse.up(); await pause(200);
  assert.deepEqual(await paths(), reduced, 'Reduced motion leaves no delayed side to settle');
  assert.deepEqual(errors, []);
  console.log('PASS Bezier normal clearance, endpoint triangles, overshoot, both drag directions, frozen far side, release, interruption, reduced motion');
} finally { await browser.close(); }
