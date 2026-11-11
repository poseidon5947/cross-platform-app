#!/usr/bin/env node
// Loads all three live apps in a real browser and fails on anything a person
// would see as broken: a script error, a request that 404s, a page that
// scrolls sideways on a phone.
//
// check-load.sh proves the database still answers. It cannot prove the page
// renders - the October outage was a 400 from one table, but a bundle that
// throws on boot, an asset that went missing in a deploy or a layout that
// overflows a 360px screen all leave the data checks perfectly green. This is
// the other half of that pair, and it is the half that sees what the crew see.
//
// Needs Chrome on the machine. Override with CHROME=/path/to/chrome.
//   node scripts/check-ui.mjs            # the three live workers
//   node scripts/check-ui.mjs http://localhost:5173   # anything else
//
// Login is not attempted, so this covers the sign-in screen and everything
// before it. Whatever sits behind the login still needs a person.

import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const CHROME = process.env.CHROME
  ?? ["/usr/bin/google-chrome", "/usr/bin/chromium", "/snap/bin/chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);

if (!CHROME) {
  console.error("No Chrome found. Install it, or set CHROME=/path/to/chrome.");
  process.exit(2);
}

const TARGETS = process.argv.length > 2 ? process.argv.slice(2) : [
  "https://warehouse-wizard-vanisle.poseidon5959.workers.dev",
  "https://crew-plus-vanisle.poseidon5959.workers.dev",
  "https://sop-plus-vanisle.poseidon5959.workers.dev",
];

// 360 is the narrowest phone in the crew; 390 is the common iPhone.
const WIDTHS = [360, 390];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

let failed = 0;

for (const url of TARGETS) {
  const name = new URL(url).hostname.split(".")[0];
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });

    const problems = [];
    page.on("pageerror", (e) => problems.push(`script error: ${e}`));
    page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
    page.on("response", (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    } catch (err) {
      console.log(`  FAIL  ${name} @${width}  did not load: ${err.message}`);
      failed++; await page.close(); continue;
    }
    await new Promise((r) => setTimeout(r, 2000));

    // An empty body is a 200 that serves nothing - curl cannot tell the
    // difference, a browser can.
    const text = await page.evaluate(() => (document.body.innerText || "").trim());
    if (text.length < 20) problems.push(`page rendered almost nothing (${text.length} chars)`);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) problems.push(`scrolls sideways by ${overflow}px`);

    if (problems.length) {
      failed++;
      console.log(`  FAIL  ${name} @${width}`);
      for (const p of [...new Set(problems)]) console.log(`          ${p}`);
    } else {
      console.log(`  ok    ${name} @${width}`);
    }
    await page.close();
  }
}

await browser.close();
console.log(failed ? `\n${failed} check(s) failed.` : "\nAll pages load clean.");
process.exit(failed ? 1 : 0);
