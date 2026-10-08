// Run with the local dev server: node scripts/check-interactions.mjs
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const out = path.resolve(".backup/interaction-review");
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const url = process.env.ATTUNE_URL ?? "http://localhost:5188";
const pause = (ms = 650) => new Promise((resolve) => setTimeout(resolve, ms));
const box = (selector) => page.$eval(selector, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const clickText = async (selector, text) => {
  const els = await page.$$(selector);
  for (const el of els) if ((await el.evaluate((e) => e.textContent)) === text) { await el.click(); return; }
  throw new Error(`Missing ${text}`);
};
const shape = (selector) => page.$eval(selector, (el) => ({ outer: el.querySelector(".at-slider-track").getAttribute("d"), inner: el.querySelector(".at-slider-fill").getAttribute("d"), value: Number(el.querySelector('[role="slider"]').getAttribute("aria-valuenow")), thumb: el.querySelector(".at-slider-thumb").getBoundingClientRect().width }));
// Read the actual SVG silhouette, away from the head and rounded cap.
const thickness = (selector, end = "left") => page.$eval(selector, (el, end) => {
  const path = el.querySelector(".at-slider-track");
  const x = end === "left" ? 22 : el.clientWidth - 22;
  let height = 0;
  for (let y = 0; y < 14; y += 0.02) if (path.isPointInFill(new DOMPoint(x, 14 - y))) height = y;
  return height;
}, end);
const clipShot = async (selector, name) => {
  const b = await box(selector);
  await page.screenshot({ path: path.join(out, `${name}.png`), clip: { x: b.x - 20, y: b.y - 20, width: b.w + 40, height: b.h + 40 } });
};
try {
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(url, { waitUntil: "networkidle0" });
  assert(await page.$(".lucide-play"), "Controls use Lucide");
  // A large stage makes both nested contours inspectable.
  await page.focus(".pg-card"); await page.keyboard.press("Enter"); await page.waitForSelector(".pg-modal"); await pause();
  const slider = ".pg-modal-demo .at-slider";
  const thumb = `${slider} [role="slider"]`;
  await page.focus('.pg-modal-demo [role="spinbutton"][aria-label="时长"]');
  await page.keyboard.press("Enter"); await page.keyboard.type("500"); await page.keyboard.press("Enter");
  await page.click(".pg-modal-title"); await page.mouse.move(0, 0); await pause();
  const rest = await shape(slider);
  const restRight = await thickness(slider, "right");
  assert.equal(rest.value, 500);
  assert.equal(rest.thumb, 4, "Resting dot is 4px");
  await clipShot(slider, "slider-light-default");
  const bounds = await box(slider);
  const restGrip = await box(thumb);
  const restColor = await page.$eval(`${slider} .at-slider-track`, el => getComputedStyle(el).fill);
  await page.mouse.move(bounds.x + bounds.w * 0.85, bounds.y + bounds.h / 2); await pause();
  const trackHover = await shape(slider);
  assert.equal(trackHover.outer, rest.outer, "Empty track hover cannot deform the rail");
  assert.equal(trackHover.inner, rest.inner, "Empty track hover cannot deform the fill");
  assert.equal(trackHover.thumb, 4);
  assert.notEqual(await page.$eval(`${slider} .at-slider-track`, el => getComputedStyle(el).fill), restColor, "Empty track hover changes only the rail color");
  await page.mouse.move(restGrip.x + restGrip.w / 2 + 10, restGrip.y + restGrip.h / 2); await pause();
  const hovered = await shape(slider);
  assert(Math.abs(hovered.thumb - 14.4) < 0.05, "Near-handle hover preserves the previous expanded size");
  assert(await thickness(slider, "right") < restRight - 1, "Right endpoint narrows on hover");
  const hoverThickness = await thickness(slider);
  assert.notEqual(hovered.outer, rest.outer);
  assert.notEqual(hovered.inner, rest.inner);
  assert(hovered.thumb > rest.thumb * 1.8, "White dot expands with the nested head");
  await clipShot(slider, "slider-light-hover");
  await page.mouse.move(bounds.x + bounds.w * 0.85, bounds.y + bounds.h / 2); await pause();
  assert.equal((await shape(slider)).outer, rest.outer, "Leaving the handle for empty track restores the original contour");
  await page.hover(thumb); await pause();
  const grip = await box(thumb);
  await page.mouse.move(grip.x + grip.w / 2, grip.y + grip.h / 2);
  await page.mouse.down();
  for (let n = 1; n <= 12; n++) { await page.mouse.move(grip.x + grip.w / 2 + n * 6, grip.y + grip.h / 2); await pause(16); }
  const draggedRight = await shape(slider);
  assert(draggedRight.value > 500);
  const movingThickness = await thickness(slider);
  await pause(850);
  const stoppedThickness = await thickness(slider);
  assert(Math.abs(stoppedThickness - hoverThickness) < 0.15, "Dragging right keeps the same endpoint thickness");
  assert(Math.abs(stoppedThickness - movingThickness) < 0.12, "Pause does not reset thickness");
  await page.mouse.up(); await pause(250);
  assert(Math.abs(await thickness(slider) - stoppedThickness) < 0.12, "Release while hovered retains thickness");
  await page.mouse.down(); await pause(250);
  assert(Math.abs(await thickness(slider) - stoppedThickness) < 0.12, "Re-grab keeps the fixed thickness");
  await clipShot(slider, "slider-pull-right");
  for (let n = 12; n >= 0; n--) { await page.mouse.move(grip.x + grip.w / 2 + n * 6, grip.y + grip.h / 2); await pause(16); }
  const draggedLeft = await shape(slider);
  assert(draggedLeft.value < draggedRight.value);
  await pause(650);
  assert(Math.abs(await thickness(slider) - stoppedThickness) < 0.15, "Reversing no longer thickens the body");
  assert(Math.abs(await thickness(slider) - hoverThickness) < 0.15, "Returning to the same length restores the same thickness");
  await clipShot(slider, "slider-pull-left");
  await page.mouse.move(bounds.x + bounds.w - 12, bounds.y + bounds.h / 2); await pause();
  const endpointThickness = await thickness(slider);
  await page.mouse.move(bounds.x + bounds.w + 70, bounds.y + bounds.h / 2); await pause(80);
  assert.equal((await shape(slider)).value, 1000, "Overshoot cannot change the logical maximum");
  assert(!/NaN|Infinity/.test((await shape(slider)).outer));
  const tautThickness = await thickness(slider);
  assert(tautThickness < endpointThickness * 0.92 && tautThickness > endpointThickness * 0.83, "Overscroll visibly thins the whole rail");
  const stretched = await box(thumb);
  assert(stretched.w > stretched.h * 1.2);
  assert(Math.abs(await page.$eval(thumb, el => parseFloat(getComputedStyle(el).borderTopLeftRadius)) - stretched.h / 2) < 0.1, "Thumb keeps its capsule corners and parallel edges");
  await clipShot(slider, "slider-overshoot");
  await page.mouse.up(); await pause();
  const relaxed = await box(thumb);
  assert(Math.abs(relaxed.w - relaxed.h) < 0.1, "Release restores the round thumb");
  await page.focus(thumb); await page.keyboard.press("Home"); await pause();
  assert.equal((await shape(slider)).value, 0);
  assert.notEqual((await shape(slider)).inner, "", "Minimum value keeps the dark cap around the white thumb");
  assert.equal(await page.$eval(`${slider} .at-slider-fill`, el => getComputedStyle(el).opacity), "1", "Minimum fill stays opaque");
  const leftGrip = await box(thumb);
  await page.mouse.move(leftGrip.x + leftGrip.w / 2, leftGrip.y + leftGrip.h / 2); await page.mouse.down(); await pause();
  const leftEndpointThickness = await thickness(slider, "right");
  await page.mouse.move(bounds.x - 70, bounds.y + bounds.h / 2); await pause(80);
  assert.equal((await shape(slider)).value, 0, "Left overscroll stays at the minimum");
  assert(await thickness(slider, "right") < leftEndpointThickness - 0.15, "Left overscroll also thins the whole rail");
  await clipShot(slider, "slider-overshoot-left");
  await page.mouse.up(); await pause();
  await page.focus(thumb);
  await page.keyboard.press("ArrowRight");
  assert.equal((await shape(slider)).value, 10);
  await page.keyboard.down("Shift"); await page.keyboard.press("ArrowRight"); await page.keyboard.up("Shift");
  assert.equal((await shape(slider)).value, 110);
  const groups = await page.$$(".pg-modal-panel .at-group-toggle");
  for (const group of groups) if ((await group.evaluate(el => el.textContent)).includes("共享参数")) await group.click();
  await pause();
  const descriptions = await page.$$eval(".at-param-description", els => els.map(el => el.textContent));
  assert.equal(descriptions.length, 11, "All shared values and springs have visible descriptions");
  assert(descriptions.some(text => text.includes("仅影响 Slider")));
  await page.$eval(".at-param-description", el => el.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: path.join(out, "shared-descriptions.png") });
  await page.keyboard.press("Escape"); await page.waitForSelector(".pg-modal", { hidden: true });

  const input = ".pg-card-slot:nth-child(2) .at-input";
  await page.mouse.move(0, 0); await pause(150);
  const restInput = await page.$eval(`${input} .at-input-surface`, el => getComputedStyle(el).opacity);
  assert.equal(restInput, "0", "Resting Input shows only an underline");
  await page.hover(`${input} .at-input-box`); await pause(1400);
  assert.equal(await page.$eval(`${input} .at-input-frame`, el => +getComputedStyle(el).getPropertyValue('--at-input-draw')), 1, "Hover completes the compact outline");
  assert.equal(await page.$eval(`${input} .at-input-frame`, el => +getComputedStyle(el).getPropertyValue('--at-input-progress')), 0, "Hover does not expand the frame");
  await page.click(`${input} .at-input-box`); await page.keyboard.type("420"); await page.keyboard.press("Enter");
  assert.equal(await page.$eval(`${input} [role="spinbutton"]`, (el) => el.getAttribute("aria-valuenow")), "420");

  const sw = '.pg-header [aria-label="减弱动效"]';
  await page.mouse.move(0, 0); await pause();
  const swRest = await page.$eval(`${sw} .at-switch-thumb`, (el) => parseFloat(el.getAttribute("width")));
  await page.hover(sw); await pause();
  const swHover = await page.$eval(`${sw} .at-switch-thumb`, (el) => parseFloat(el.getAttribute("width")));
  assert(swHover > swRest * 1.15);
  // Toggle a demo switch, not the global reduced-motion switch, to sample squash.
  const demoSwitch = '.pg-card-slot:nth-child(6) [role="switch"]';
  await page.hover(demoSwitch); await pause();
  const swBefore = await page.$eval(`${demoSwitch} .at-switch-thumb`, (el) => parseFloat(el.getAttribute("width")));
  await page.click(demoSwitch);
  let peak = 0;
  for (let n = 0; n < 12; n++) { peak = Math.max(peak, await page.$eval(`${demoSwitch} .at-switch-thumb`, (el) => parseFloat(el.getAttribute("width")))); await pause(20); }
  assert(peak > swBefore * 1.05, "Switch stretches during travel");
  await page.$eval(".at-tl-hit-body", (el) => el.scrollIntoView({ block: "center" }));
  const timeline = await box(".at-tl-hit-body");
  await page.mouse.move(timeline.x + timeline.w / 2, timeline.y + timeline.h / 2); await page.mouse.down();
  const label = await page.$eval(".at-tl-readout", (el) => el.textContent);
  assert(label.includes("–") && !label.includes("→"));
  await page.mouse.up();
  console.log("PASS nested hover, bidirectional drag, overshoot, keyboard, underline Input, stronger Switch, range dash, Lucide");

  for (const proposal of [null, "glass", "paper", "graphite", "gummy", "brutal"]) {
    await page.goto(`${url}/${proposal ? `?proposal=${proposal}` : ""}`, { waitUntil: "networkidle0" });
    const themeSelector = proposal ? '[aria-label="提案主题"] [role="radio"]' : '[aria-label="主题"] [role="radio"]';
    for (const theme of ["浅色", "深色"]) {
      await clickText(themeSelector, theme); await pause(200);
      const colors = await page.$eval(".pg-card .at-slider", (el) => ({ fill: getComputedStyle(el.querySelector(".at-slider-fill")).fill, track: getComputedStyle(el.querySelector(".at-slider-track")).fill, thumb: getComputedStyle(el.querySelector(".at-slider-thumb")).backgroundColor }));
      assert.notEqual(colors.fill, colors.track);
      assert.equal(colors.thumb, "rgb(255, 255, 255)");
    }
    await page.click('[aria-label="减弱动效"]'); await pause();
    const reducedRest = await shape(".pg-card .at-slider");
    await page.hover(".pg-card .at-slider"); await pause();
    const reducedHover = await shape(".pg-card .at-slider");
    assert.equal(reducedRest.outer, reducedHover.outer, "Reduced motion disables the bulge");
    assert.equal(reducedRest.thumb, reducedHover.thumb);
    console.log(`PASS ${proposal ?? "original"}: both palettes and reduced-motion geometry`);
  }
  assert.deepEqual(errors, [], "No runtime errors");
} finally { await browser.close(); }
