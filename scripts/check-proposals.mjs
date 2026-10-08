// Browser smoke checks. Uses the project's existing Puppeteer dependency.
// ATTUNE_URL, CHROME_PATH and ATTUNE_SHOTS can override local defaults.
import assert from "node:assert/strict";
import { mkdir, access, readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const url = process.env.ATTUNE_URL ?? "http://localhost:5188";
const out = path.resolve(process.env.ATTUNE_SHOTS ?? ".backup/proposal-review");
await mkdir(out, { recursive: true });
const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
let executablePath;
for (const candidate of candidates) { try { await access(candidate); executablePath = candidate; break; } catch {} }
assert(executablePath, "Set CHROME_PATH to an installed Chrome/Chromium executable");
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const pause = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));
const clickText = async (selector, text) => {
  const handles = await page.$$(selector);
  for (const handle of handles) {
    if ((await handle.evaluate((el) => el.textContent)).includes(text)) {
      await handle.click(); return;
    }
  }
  throw new Error(`Missing ${selector}: ${text}`);
};
const viewportFits = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal page overflow");
try {
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" });
  assert.equal(await page.$eval("h1", (el) => el.textContent), "首版组件");
  const original = await page.evaluate(() => ({ storage: localStorage.getItem("attune-playground-v1"), accent: getComputedStyle(document.documentElement).getPropertyValue("--at-color-accent-default").trim() }));
  await page.screenshot({ path: path.join(out, "original.png"), fullPage: true });
  await page.click('a[href="?proposal=glass"]');
  await page.waitForSelector(".study-lab");
  await pause();
  const ids = ["glass", "paper", "graphite", "gummy", "brutal"];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    await page.click(`.study-choice:nth-child(${i + 1})`);
    await pause();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.proposal), id);
    assert.equal(new URL(page.url()).searchParams.get("proposal"), id);
    assert.equal(await page.$$eval(".pg-card", (els) => els.length), 11);
    await viewportFits();
    const slider = '.study-inspector [role="slider"][aria-label="展开间距"]';
    await page.focus(slider);
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.$eval(slider, (el) => el.getAttribute("aria-valuenow")), "81");
    await page.keyboard.press("Home");
    assert.equal(await page.$eval(slider, (el) => el.getAttribute("aria-valuenow")), "24");
    await page.keyboard.press("End");
    assert.equal(await page.$eval(slider, (el) => el.getAttribute("aria-valuenow")), "90");
    await page.keyboard.press("ArrowLeft");
    // Pointer scrubbing must change the value, while leaving the card closed.
    const track = await page.$eval(".study-inspector .at-slider", (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.mouse.click(track.x + track.w * .45, track.y + track.h / 2);
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute("aria-valuenow") !== "89", {}, slider);
    assert.notEqual(await page.$eval(slider, (el) => el.getAttribute("aria-valuenow")), "89");
    // Restore the composition for visual comparison.
    await page.focus(slider); await page.keyboard.press("End");
    for (let j = 0; j < 10; j++) await page.keyboard.press("ArrowLeft");
    await page.mouse.move(0, 0); await pause();
    await page.screenshot({ path: path.join(out, `${id}.png`), fullPage: true });
    // Keyboard-opened component modal uses the active proposal's tokens.
    await page.focus(".pg-card"); await page.keyboard.press("Enter");
    await page.waitForSelector(".pg-modal"); await pause();
    assert.equal(await page.$$eval(".pg-modal", (els) => els.length), 1);
    const param = '.pg-modal-panel [role="slider"]';
    const previous = await page.$eval(param, (el) => el.getAttribute("aria-valuenow"));
    await page.focus(param); await page.keyboard.press("ArrowRight");
    assert.notEqual(await page.$eval(param, (el) => el.getAttribute("aria-valuenow")), previous);
    await page.keyboard.press("Escape"); await page.waitForSelector(".pg-modal", { hidden: true, timeout: 5000 });
    assert.equal(await page.$(".pg-modal"), null);
    // Select portal retains this proposal's style and supports keyboard selection.
    await page.focus(".pg-card .at-select-trigger"); await page.keyboard.press("Enter");
    await page.waitForSelector('[role="listbox"]');
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await page.waitForSelector('[role="listbox"]', { hidden: true, timeout: 5000 });
    assert.equal(await page.$('[role="listbox"]'), null);
    // Both color modes, including portals, must stay usable.
    const otherMode = id === "graphite" ? "浅色" : "深色";
    await clickText('.study-tools [role="radio"]', otherMode); await pause();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), id === "graphite" ? "light" : "dark");
    await page.screenshot({ path: path.join(out, `${id}-alternate.png`), fullPage: true });
    await clickText('.study-tools [role="radio"]', id === "graphite" ? "深色" : "浅色");
    // Reduced mode disables deformation across the shared provider.
    await page.click('[aria-label="减弱动效"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.reducedMotion), "true");
    await page.click('[aria-label="减弱动效"]');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await pause(); await viewportFits();
    await page.screenshot({ path: path.join(out, `${id}-mobile.png`), fullPage: true });
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    console.log(`PASS ${id}: controls, modal, select, two themes, reduced motion, mobile`);
  }
  // History navigation and reload restore the selected proposal.
  await page.goBack(); await pause();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.proposal), "gummy");
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.proposal), "gummy");
  await clickText('[aria-label="提案展示"] [role="radio"]', "动效样例");
  await page.waitForSelector(".pg-sample-panel"); await pause();
  assert.equal(await page.$$eval(".pg-mock", (els) => els.length), 6);
  assert(!["fixed", "absolute"].includes(await page.$eval(".pg-sample-panel", (el) => getComputedStyle(el).position)), "Sample panel stays in page flow");
  await pause(1300);
  await page.screenshot({ path: path.join(out, "sample.png"), fullPage: true });
  const beforeReset = await page.evaluate(() => localStorage.getItem("attune-proposal-glass-v1"));
  await clickText(".study-footer button", "重置本方案");
  await pause();
  assert.equal(await page.evaluate(() => localStorage.getItem("attune-proposal-glass-v1")), beforeReset, "Reset must not change another proposal");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("attune-proposal-gummy-v1")).overrides), {});
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
  await clickText(".study-footer button", "导出方案");
  let exported;
  for (let i = 0; i < 30; i++) {
    try { exported = JSON.parse(await readFile(path.join(out, "attune-gummy.json"), "utf8")); break; } catch { await pause(100); }
  }
  assert.equal(exported?.proposal, "gummy");
  assert.equal(exported?.feel.shared.deformScale, 1.25);
  await page.goto(url, { waitUntil: "networkidle0" });
  const restored = await page.evaluate(() => ({ storage: localStorage.getItem("attune-playground-v1"), accent: getComputedStyle(document.documentElement).getPropertyValue("--at-color-accent-default").trim() }));
  assert.deepEqual(restored, original, "Proposal changes must not overwrite original settings");
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-proposal")), false);
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(`PASS history, reload, six-card sample, original isolation. Screenshots: ${out}`);
} finally { await browser.close(); }
