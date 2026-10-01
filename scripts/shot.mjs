// Dev helper: screenshots + console errors via system Chrome.
// usage: node scripts/shot.mjs <name> [hash] [actions-json]
import puppeteer from "puppeteer-core";

const [, , name = "shot", hash = "", actionsJson = "[]"] = process.argv;
const actions = JSON.parse(actionsJson);
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--window-size=1440,1300"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1300, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:5188/${hash}`, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
for (const a of actions) {
  if (a.theme) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: a.theme }]);
  if (a.reload) await page.reload({ waitUntil: "networkidle0" });
  if (a.click) await page.click(a.click);
  if (a.clickXY) await page.mouse.click(a.clickXY[0], a.clickXY[1]);
  if (a.move) await page.mouse.move(a.move[0], a.move[1], { steps: a.steps ?? 8 });
  if (a.moveTo) {
    const b = await page.$eval(a.moveTo, (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await page.mouse.move(b[0] + (a.dx ?? 0), b[1] + (a.dy ?? 0), { steps: a.steps ?? 8 });
  }
  if (a.clipOf) {
    const r = await page.$eval(a.clipOf, (e, pad) => { const b = e.getBoundingClientRect(); return { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 }; }, a.pad ?? 8);
    await page.screenshot({ path: `/tmp/attune-${a.name}.png`, clip: r });
  }
  if (a.down) await page.mouse.down();
  if (a.up) await page.mouse.up();
  if (a.hover) await page.hover(a.hover);
  if (a.key) await page.keyboard.press(a.key);
  if (a.type) await page.keyboard.type(a.type);
  if (a.eval) console.log("eval:", JSON.stringify(await page.evaluate(`(${a.eval})()`)));
  if (a.wait) await new Promise((r) => setTimeout(r, a.wait));
  if (a.shot) await page.screenshot({ path: `/tmp/attune-${a.shot}.png`, clip: a.clip, captureBeyondViewport: false });
}
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `/tmp/attune-${name}.png`, fullPage: true });
console.log(errors.length ? errors.join("\n") : "no console errors");
await browser.close();
