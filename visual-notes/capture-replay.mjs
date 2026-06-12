// Playwright capture harness for the CombatReplay renderer.
// Usage: node visual-notes/capture-replay.mjs [baseUrl]
// Captures the required evidence set into visual-notes/screenshots/ at
// 390x844 portrait, deviceScaleFactor 2 (Farcaster mini-app webview shape).
// playwright is resolved from an external install (not a repo dependency) —
// pass its location via PLAYWRIGHT_PKG or have it on the import path.
const pwPath = process.env.PLAYWRIGHT_PKG || "playwright";
const { chromium } = await import(pwPath);

const BASE = process.argv[2] || "http://localhost:3177";
const OUT = new URL("./screenshots/", import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:");

const waitBeat = (page, beat, timeout = 90000) =>
  page.waitForFunction(
    (b) => document.querySelector("canvas")?.dataset.beat === b,
    beat,
    { timeout, polling: "raf" }
  );

const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` });

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  // ── 1) crit fight: intro (red vs blue), crit flash, K.O., victory ──────────
  let page = await ctx.newPage();
  await page.goto(`${BASE}/visual-test?auto=crit`);
  await waitBeat(page, "intro");
  await page.waitForTimeout(500);
  await shot(page, "01-intro-approach-red-vs-blue");
  await waitBeat(page, "crit");
  await page.waitForTimeout(130); // ride out the hit-stop so the flash is near peak
  await shot(page, "02-crit-flash");
  await waitBeat(page, "ko");
  await page.waitForTimeout(300); // K.O. slam + kill-cam zoom settled
  await shot(page, "03-killcam-ko");
  await waitBeat(page, "victory");
  await page.waitForTimeout(350);
  await shot(page, "04-victory-pose");
  const fps1 = await page.evaluate(() => document.querySelector("canvas")?.dataset.fps);
  console.log("crit fight fps:", fps1);
  await page.close();

  // ── 2) combo fight: 4x burst with counter ──────────────────────────────────
  page = await ctx.newPage();
  await page.goto(`${BASE}/visual-test?auto=combo&p1=blue&p2=red`);
  await waitBeat(page, "combo4");
  await page.waitForTimeout(60);
  await shot(page, "05-combo-4x-counter");
  await page.close();

  // ── 3) draw beat (synthesized — real draws unreachable in simulateFight) ───
  page = await ctx.newPage();
  await page.goto(`${BASE}/visual-test?auto=draw&p1=gold&p2=blue`);
  await waitBeat(page, "double-ko");
  await page.waitForTimeout(250);
  await shot(page, "06-double-ko");
  await waitBeat(page, "draw-card");
  await page.waitForTimeout(450);
  await shot(page, "07-draw-card");
  await page.close();

  // ── 4) gold idle/approach (third character evidence) ───────────────────────
  page = await ctx.newPage();
  await page.goto(`${BASE}/visual-test?auto=crit&p1=gold&p2=red&p1name=luckmaxi&p2name=forgelord`);
  await waitBeat(page, "intro");
  await page.waitForTimeout(900);
  await shot(page, "08-intro-gold-vs-red");
  await page.close();

  // ── 5) full sprite-bank sheet ───────────────────────────────────────────────
  page = await ctx.newPage();
  await page.goto(`${BASE}/visual-test?auto=sheet`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}09-sprite-sheet.png`, fullPage: true });
  await page.close();

  await browser.close();
  console.log("done ->", OUT);
};

run().catch((e) => { console.error(e); process.exit(1); });
