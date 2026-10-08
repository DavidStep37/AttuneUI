// Diagnose skipped animation separately from dropped frames in a real panel.
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
const results = [];
try {
  for (const settings of [
    { systemReduce: false, override: null, cpu: 1 },
    { systemReduce: false, override: null, cpu: 4 },
    { systemReduce: true, override: null, cpu: 1 },
    { systemReduce: true, override: false, cpu: 1 },
  ]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 1050 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: settings.systemReduce ? 'reduce' : 'no-preference' }]);
    await page.goto(`${process.env.ATTUNE_URL ?? 'http://localhost:5188'}/#sample`, { waitUntil: 'networkidle0' });
    if (settings.override !== null) await page.click('[aria-label="减弱动效"]');
    await pause(700);
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: settings.cpu });
    const slider = '.at-panel .at-slider';
    const input = '.at-panel .at-input-box';
    await page.$eval(slider, el => el.scrollIntoView({ block: 'center' }));
    await page.mouse.move(0, 0); await pause(500);
    await page.evaluate(({ slider, input }) => {
      const track = document.querySelector(`${slider} .at-slider-track`);
      const thumb = document.querySelector(`${slider} .at-slider-thumb`);
      const frame = document.querySelector(`${input} .at-input-frame`);
      const stats = window.motionProfile = { systemReduce: matchMedia('(prefers-reduced-motion: reduce)').matches, appReduce: document.documentElement.dataset.reducedMotion, sliderPaths: [], thumbWidths: [], draw: [], grow: [], frames: [], longTasks: [] };
      const observer = new PerformanceObserver(list => stats.longTasks.push(...list.getEntries().map(e => e.duration)));
      observer.observe({ type: 'longtask' });
      let previous;
      const tick = t => {
        if (window.stopMotionProfile) { observer.disconnect(); return; }
        if (previous !== undefined) stats.frames.push(t - previous);
        previous = t;
        stats.sliderPaths.push(track.getAttribute('d'));
        stats.thumbWidths.push(thumb.getBoundingClientRect().width);
        stats.draw.push(+getComputedStyle(frame).getPropertyValue('--at-input-draw'));
        stats.grow.push(+getComputedStyle(frame).getPropertyValue('--at-input-progress'));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { slider, input });
    await pause(100);
    await page.hover(`${slider} .at-slider-thumb`); await pause(700);
    await page.hover(input); await pause(1350);
    await page.click(input); await pause(700);
    const result = await page.evaluate(() => {
      window.stopMotionProfile = true;
      const s = window.motionProfile, frames = [...s.frames].sort((a, b) => a - b);
      return { systemReduce: s.systemReduce, appReduce: s.appReduce, frames: frames.length, medianMs: frames[Math.floor(frames.length * 0.5)], p95Ms: frames[Math.floor(frames.length * 0.95)], maxMs: frames.at(-1), longTasks: s.longTasks, svgShapes: new Set(s.sliderPaths).size, maxThumb: Math.max(...s.thumbWidths), drawIntermediateFrames: s.draw.filter(v => v > 0 && v < 1).length, growIntermediateFrames: s.grow.filter(v => v > 0 && v < 1).length };
    });
    results.push({ ...settings, ...result });
    console.log(results.at(-1));
    await context.close();
  }
  await mkdir('.backup/input-review', { recursive: true });
  await writeFile('.backup/input-review/motion-performance.json', JSON.stringify(results, null, 2));
} finally { await browser.close(); }
