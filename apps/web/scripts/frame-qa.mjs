import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const out = process.env.HUD_QA_OUTPUT_DIR ? path.resolve(process.env.HUD_QA_OUTPUT_DIR) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/frontend/evidence/frame');
const executablePath = process.env.HUD_BROWSER_EXECUTABLE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const cases = [
  { name: 'full-hd', width: 1920, height: 1080, dpr: 1, frame: true },
  { name: '4k', width: 3840, height: 2160, dpr: 1, frame: true },
  { name: '4k-dpi-200', width: 1920, height: 1080, dpr: 2, frame: true },
  { name: 'full-hd-window', width: 1920, height: 940, dpr: 1, frame: true },
  { name: 'full-hd-dpi-125', width: 1536, height: 864, dpr: 1.25, frame: true },
  { name: 'full-hd-dpi-150', width: 1280, height: 720, dpr: 1.5, frame: true },
  { name: 'standard-desktop', width: 1366, height: 768, dpr: 1, frame: false },
  { name: 'mobile', width: 390, height: 844, dpr: 1, frame: false },
];
const results = [];
const pageErrors = [];
let failure;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

const measure = page => page.evaluate(() => {
  const dimensions = node => {
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      right: rect.right, bottom: rect.bottom,
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
      scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
    };
  };
  const frame = document.querySelector('.hud-window-frame');
  return {
    width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    frame: {
      ...dimensions(frame),
      display: getComputedStyle(frame).display,
      pointerEvents: getComputedStyle(frame).pointerEvents,
      ariaHidden: frame.getAttribute('aria-hidden'),
    },
    panels: Object.fromEntries([
      '.app-header', '.page-title', '.kpi-grid', '.workspace-grid', '.shaft-grid',
      '.detail-panel', '.simulation-controls', '.lower-grid', '.health-footer', '.version-footer',
    ].map(selector => [selector, dimensions(document.querySelector(selector))])),
    shafts: [...document.querySelectorAll('.shaft-card')].map(dimensions),
  };
});

function assertDesktopFits(spec, snapshot, state) {
  const prefix = `${spec.name} ${state}`;
  assert.ok(snapshot.scrollWidth <= spec.width + 1, `${prefix}: horizontal document overflow`);
  assert.ok(snapshot.scrollHeight <= spec.height + 1, `${prefix}: vertical document overflow`);
  for (const [name, rect] of Object.entries(snapshot.panels)) {
    assert.ok(rect.width > 0 && rect.height > 0, `${prefix}: ${name} has no area`);
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.right <= spec.width + 1 && rect.bottom <= spec.height + 1,
      `${prefix}: ${name} outside viewport`);
    if (spec.frame) {
      assert.ok(rect.x > snapshot.frame.x + 1 && rect.y > snapshot.frame.y + 1
        && rect.right < snapshot.frame.right - 1 && rect.bottom < snapshot.frame.bottom - 1,
      `${prefix}: ${name} intersects the outer frame bounds`);
    }
  }
  for (const selector of ['.kpi-grid', '.detail-panel']) {
    const rect = snapshot.panels[selector];
    assert.ok(rect.scrollHeight <= rect.clientHeight + 1, `${prefix}: ${selector} content needs scrolling (${rect.scrollHeight}px content / ${rect.clientHeight}px available)`);
    assert.ok(rect.scrollWidth <= rect.clientWidth + 1, `${prefix}: ${selector} content overflows horizontally (${rect.scrollWidth}px content / ${rect.clientWidth}px available)`);
  }
  assert.equal(snapshot.shafts.length, 5, `${prefix}: all five lifts should be present`);
  const grid = snapshot.panels['.shaft-grid'];
  for (const rect of snapshot.shafts) {
    assert.ok(rect.width > 0 && rect.height > 0 && rect.x >= grid.x - 1 && rect.y >= grid.y - 1
      && rect.right <= grid.right + 1 && rect.bottom <= grid.bottom + 1,
    `${prefix}: lift card outside its overview grid`);
  }
}

try {
  for (const spec of cases) {
    const context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: spec.dpr,
      locale: 'th-TH',
    });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => pageErrors.push({ case: spec.name, message: error.message }));
      await page.goto('http://127.0.0.1:5173/');
      await page.getByRole('button', { name: 'เลือกลิฟต์ W-01', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const frame = page.locator('.hud-window-frame');
      assert.equal(await frame.count(), 1, `${spec.name}: expected one decorative frame`);
      assert.equal(await frame.isVisible(), spec.frame, `${spec.name}: unexpected frame visibility`);
      const normal = await measure(page);
      const states = { normal };
      assert.equal(normal.frame.ariaHidden, 'true', `${spec.name}: decorative frame enters the accessibility tree`);
      assert.equal(normal.frame.pointerEvents, 'none', `${spec.name}: decorative frame may intercept input`);
      await page.screenshot({ path: path.join(out, `${spec.name}.jpg`), type: 'jpeg', quality: 85 });
      assert.ok(normal.scrollWidth <= spec.width + 1, `${spec.name}: horizontal document overflow`);
      if (spec.name !== 'mobile') assertDesktopFits(spec, normal, 'normal');
      assert.ok(await page.getByTestId('mode-indicator').isVisible(), `${spec.name}: source mode remains visible`);
      assert.ok(await page.getByRole('button', { name: 'Full Screen', exact: true }).isVisible(), `${spec.name}: fullscreen control hidden`);

      if (spec.frame) {
        // Real pointer clicks prove the overlay does not block any of the five lift cards.
        for (let index = 1; index <= 5; index += 1) {
          const code = `W-0${index}`;
          const lift = page.getByRole('button', { name: `เลือกลิฟต์ ${code}`, exact: true });
          await lift.click();
          assert.equal(await lift.getAttribute('aria-pressed'), 'true', `${spec.name}: ${code} selection blocked`);
          assert.equal(await page.locator('.detail-identity h3').textContent(), code,
            `${spec.name}: ${code} did not populate the selected lift panel`);
          assertDesktopFits(spec, await measure(page), code);
        }
        await page.getByRole('button', { name: 'เลือกลิฟต์ W-01', exact: true }).click();
        await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('stale');
        states.stale = await measure(page);
        assertDesktopFits(spec, states.stale, 'stale');
        await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('delta-gap');
        states.warning = await measure(page);
        assertDesktopFits(spec, states.warning, 'stream-warning');
        if (spec.name === 'full-hd-dpi-125' || spec.name === 'full-hd-dpi-150') {
          await page.screenshot({ path: path.join(out, `${spec.name}-warning.jpg`), type: 'jpeg', quality: 85 });
        }
        await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
      }

      if (spec.name === 'full-hd') {
        await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
        await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
        assertDesktopFits(spec, await measure(page), 'fullscreen');
        await page.getByRole('button', { name: 'Exit Full Screen', exact: true }).click();
        await page.waitForFunction(() => document.fullscreenElement === null);
        assert.equal(await frame.isVisible(), true, 'frame disappears after leaving fullscreen');
        results.push({ name: 'native-fullscreen-enter-exit', result: 'PASS' });
      }
      results.push({ name: spec.name, result: 'PASS', viewport: spec, ...states });
      console.log(`${spec.name}: PASS (frame ${spec.frame ? 'visible' : 'hidden'})`);
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(pageErrors, [], 'browser runtime errors');
} catch (error) {
  failure = error;
} finally {
  await writeFile(path.join(out, 'verification.json'), JSON.stringify({
    status: failure ? 'FAIL' : 'PASS', browser: browser.version(), results, pageErrors,
    ...(failure ? { failure: failure.stack ?? String(failure) } : {}),
    scope: 'Local SIMULATED UI only. Responsive frame visibility uses viewport and device pixel ratio; no physical monitor identity is inferred. No live elevator or deployment was accessed.',
  }, null, 2) + '\n');
  await browser.close();
}
if (failure) throw failure;
console.log(JSON.stringify({ status: 'PASS', checks: results.length, evidence: out }));
