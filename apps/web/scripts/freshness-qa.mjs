import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Independent review evidence: every screenshot is captured from this local UI run.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = process.env.HUD_QA_OUTPUT_DIR ? path.resolve(process.env.HUD_QA_OUTPUT_DIR) : path.join(repo, 'docs/frontend/evidence/freshness-correction');
const base = process.env.HUD_PREVIEW_URL || 'http://127.0.0.1:5173/';
const target = new URL(base);
assert.ok(['http:', 'https:'].includes(target.protocol) && ['127.0.0.1', 'localhost'].includes(target.hostname), 'Only a loopback preview URL is permitted.');
await mkdir(out, { recursive: true });
const executablePath = process.env.HUD_BROWSER_EXECUTABLE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const checks = []; const pageErrors = []; const externalRequests = []; const screenshots = [];
const pass = (name, details) => checks.push({ name, result: 'PASS', details });
const localUrl = url => ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
async function createPage(viewport = { width: 1920, height: 1080 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    if (localUrl(route.request().url())) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await context.routeWebSocket('**/*', socket => {
    if (localUrl(socket.url())) return socket.connectToServer();
    externalRequests.push(socket.url());
    return socket.close();
  });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  return { context, page };
}
async function ready(page) {
  await page.goto(base);
  await page.getByRole('button', { name: 'เลือกลิฟต์ W-01' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(page, name) {
  const absolute = path.join(out, name);
  await page.screenshot({ path: absolute, fullPage: true });
  const bytes = await readFile(absolute);
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  screenshots.push({ file: path.relative(repo, absolute).split(path.sep).join('/'), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
async function freshness(page) {
  return page.getByTestId('shaft-W-01').evaluate(node => ({
    source: node.dataset.sourceFreshness,
    transport: node.dataset.transportFreshness,
    server: node.dataset.serverConnection,
    heartbeat: document.querySelector('.gateway-health').dataset.heartbeatStatus,
    ageText: node.querySelector('.shaft-bottom').textContent,
    animating: node.querySelector('[data-animating]')?.dataset.animating,
  }));
}
async function fit(page) {
  const geometry = await page.evaluate(() => {
    const bounds = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }; };
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, panels: Object.fromEntries(['.app-header', '.kpi-grid', '.workspace-grid', '.detail-panel', '.simulation-controls', '.lower-grid', '.health-footer'].map(selector => [selector, bounds(document.querySelector(selector))])) };
  });
  assert.ok(geometry.scrollWidth <= geometry.width + 1 && geometry.scrollHeight <= geometry.height + 1, JSON.stringify(geometry));
  for (const [name, bounds] of Object.entries(geometry.panels)) {
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.right <= geometry.width + 1 && bounds.bottom <= geometry.height + 1, name + ' is outside viewport');
  }
  assert.ok(geometry.panels['.kpi-grid'].scrollHeight <= geometry.panels['.kpi-grid'].clientHeight + 1, 'KPI content overflow');
  assert.ok(geometry.panels['.detail-panel'].scrollHeight <= geometry.panels['.detail-panel'].clientHeight + 1, 'Detail content overflow: ' + JSON.stringify(geometry.panels['.detail-panel']));
  return geometry;
}
let reviewPage;
try {
  // Wall-clock and timers pause before mounting, so each boundary is relative to
  // the same initial observation. Exact millisecond classification is also unit tested.
  const timed = await createPage();
  await timed.page.clock.install({ time: new Date('2026-09-14T02:00:00.000Z') });
  await timed.page.clock.pauseAt(new Date('2026-09-14T03:00:00.000Z'));
  await ready(timed.page);
  const initial = await freshness(timed.page);
  assert.equal(initial.source, 'FRESH');
  assert.equal(initial.heartbeat, 'ONLINE');
  await timed.page.clock.runFor(15_000);
  const reconciled = await freshness(timed.page);
  assert.equal(reconciled.source, 'FRESH');
  assert.match(reconciled.ageText, /15\s*s/);
  pass('15-second reconciliation retains source age', { initial, at15s: reconciled });
  await timed.page.clock.runFor(14_999);
  const before = await freshness(timed.page);
  assert.equal(before.source, 'FRESH');
  assert.equal(before.heartbeat, 'ONLINE');
  await timed.page.clock.runFor(1);
  const at = await freshness(timed.page);
  assert.equal(at.source, 'STALE');
  assert.equal(at.heartbeat, 'OFFLINE');
  assert.equal(at.animating, 'false');
  assert.match(at.ageText, /30\s*s/);
  pass('SIM source boundary: 29.999 seconds fresh; 30 seconds stale', { before, at, browserTickMs: 1000, exactPredicateBoundaryCoveredByUnitTests: true });
  pass('Gateway heartbeat boundary: 29.999 seconds online; 30 seconds offline', { before: before.heartbeat, at: at.heartbeat });
  await timed.context.close();

  const review = await createPage(); reviewPage = review.page;
  const page = review.page;
  await ready(page);
  await page.clock.setFixedTime(new Date('2026-09-14T03:00:00.000Z'));
  await page.locator('.header-time').getByText('10:00:00', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /เลือกลิฟต์ W-/ }).count(), 5);
  assert.ok(await page.getByTestId('mode-indicator').getByText('TEST', { exact: true }).isVisible());
  const normalGeometry = await fit(page);
  await capture(page, 'hud-desktop.png');
  pass('Full HD five-shaft HUD and compact TEST provenance', normalGeometry);

  const car = page.getByTestId('car-W-01');
  const shaft = page.getByTestId('shaft-W-01');
  const initialY = (await car.boundingBox()).y;
  await page.getByRole('button', { name: /เดินข้อมูล 1 ขั้น/ }).click();
  assert.equal(await car.getAttribute('data-confirmed-anchor'), '0.475');
  assert.ok(await shaft.getByText('21', { exact: true }).isVisible());
  await page.waitForTimeout(150);
  const midY = (await car.boundingBox()).y;
  assert.ok(midY < initialY, JSON.stringify({ initialY, midY }));
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('reconnect');
  const disconnected = await freshness(page);
  assert.equal(disconnected.server, 'SERVER_DISCONNECTED');
  assert.equal(disconnected.source, 'FRESH');
  assert.equal(await car.getAttribute('data-confirmed-anchor'), '0.475');
  assert.equal(await car.getAttribute('data-animating'), 'false');
  assert.equal(await car.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  assert.ok(await page.getByRole('alert').isVisible());
  assert.match(await page.getByRole('alert').textContent(), /SERVER_DISCONNECTED/);
  const stoppedY = (await car.boundingBox()).y;
  await page.waitForTimeout(300);
  const heldY = (await car.boundingBox()).y;
  assert.ok(Math.abs(heldY - stoppedY) < 0.5, JSON.stringify({ stoppedY, heldY }));
  const doorTransitions = await shaft.locator('.door-panel').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transitionDuration));
  assert.ok(doorTransitions.every(duration => duration === '0s'));
  pass('WS disconnect immediately cancels render motion while source remains fresh', { disconnected, initialY, midY, stoppedY, heldY, doorTransitions, retainedAnchor: '0.475' });
  await page.getByRole('button', { name: /เดินข้อมูล 1 ขั้น/ }).click();
  assert.notEqual((await freshness(page)).server, 'SERVER_DISCONNECTED');
  pass('Reconnect requires the existing resnapshot path', { anchor: await car.getAttribute('data-confirmed-anchor') });

  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
  await page.getByRole('button', { name: 'เลือกลิฟต์ W-05' }).focus();
  await page.keyboard.press('Enter');
  const detail = page.getByRole('region', { name: 'รายละเอียดลิฟต์ที่เลือก' });
  assert.ok(await detail.getByText('RAW CODE · FLOOR UNCONFIRMED').isVisible());
  assert.equal(await page.getByTestId('car-W-05').count(), 0);
  await capture(page, 'hud-uncalibrated.png');
  pass('Keyboard selection and uncalibrated W-05', 'Backend-provided raw code 22, no fabricated floor anchor');

  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('stale');
  await page.getByRole('button', { name: 'เลือกลิฟต์ W-01' }).click();
  assert.equal((await freshness(page)).source, 'STALE');
  assert.equal(await car.getAttribute('data-animating'), 'false');
  assert.equal(await car.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  await fit(page);
  await capture(page, 'hud-stale.png');
  pass('Visible stale source and held confirmed position', await freshness(page));

  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('alarm');
  assert.ok(await shaft.getByText('! 1 ALARM').isVisible());
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('delta-gap');
  assert.equal(await car.getAttribute('data-confirmed-anchor'), '0.45');
  assert.equal(await car.getAttribute('data-animating'), 'false');
  const gapGeometry = await fit(page);
  await page.getByRole('button', { name: /เดินข้อมูล 1 ขั้น/ }).click();
  assert.equal(await car.getAttribute('data-confirmed-anchor'), '0.475');
  pass('Alarm and delta-gap regression', { behavior: 'Alarm appears immediately; gap cancels motion pending resnapshot', gapGeometry });

  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
  await page.getByRole('button', { name: 'สาธิต', exact: true }).click();
  assert.ok(await page.getByTestId('mode-indicator').getByText('DEMO', { exact: true }).isVisible());
  await fit(page);
  await capture(page, 'hud-demo.png');
  await page.getByRole('button', { name: 'ออกจาก DEMO' }).click();
  assert.ok(await page.getByTestId('mode-indicator').getByText('TEST', { exact: true }).isVisible());
  pass('DEMO/TEST isolation', 'Distinct provenance remains visible before and after exiting DEMO');

  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
  await page.getByRole('button', { name: 'Exit Full Screen', exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement === null);
  pass('Native Full Screen toggle regression', 'Entered and exited browser Fullscreen API through button');

  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
  pass('4K viewport containment after freshness correction', await fit(page));
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('stale');
  pass('4K stale viewport containment', await fit(page));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
  await page.getByRole('button', { name: 'เลือกลิฟต์ W-04' }).click();
  assert.ok(await detail.getByText('OUT_OF_SERVICE', { exact: true }).isVisible());
  assert.ok(await detail.getByText('COMMISSIONED', { exact: true }).isVisible());
  const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, shaftWidth: document.querySelector('.shaft-grid').clientWidth, shaftScrollWidth: document.querySelector('.shaft-grid').scrollWidth }));
  assert.ok(mobile.scrollWidth <= mobile.width);
  assert.ok(mobile.shaftScrollWidth > mobile.shaftWidth);
  await capture(page, 'hud-mobile.png');
  pass('Mobile layout and independent service/commissioning states', mobile);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /เดินข้อมูล 1 ขั้น/ }).click();
  assert.equal(await car.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  pass('Reduced-motion regression', 'Zero-duration interpolation when prefers-reduced-motion is enabled');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  pass('Browser runtime and local-only network boundary', { pageErrors, externalRequests });
  assert.equal(screenshots.length, 5);
  const report = { status: 'PASS', browser: browser.version(), url: base, checks, screenshots, pageErrors, externalRequests, limits: ['Local SIMULATED fixtures only; no LIVE integration', 'REAL freshness thresholds are exercised by frontend unit tests, not REAL transport', 'Screenshots are review evidence; no G-U or pixel-fidelity approval', 'No backend, hardware, Capture, COM or Scheduled Task execution'], nextAllowedAction: 'WAIT_FOR_ARCHITECT' };
  await writeFile(path.join(out, 'browser-qa.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, browser: browser.version(), screenshots, evidence: out }, null, 2));
} catch (error) {
  if (reviewPage) await reviewPage.screenshot({ path: path.join(out, 'browser-failure.jpg'), type: 'jpeg', quality: 75, fullPage: true }).catch(() => {});
  await writeFile(path.join(out, 'browser-qa.json'), JSON.stringify({ status: 'FAIL', error: String(error), checks, screenshots, pageErrors, externalRequests }, null, 2) + '\n');
  throw error;
} finally {
  await browser.close();
}
