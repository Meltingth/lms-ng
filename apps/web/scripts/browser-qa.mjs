import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.join(repo, 'docs/frontend/evidence');
await mkdir(out, {recursive:true});
const executablePath = process.env.HUD_BROWSER_EXECUTABLE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
const context = await browser.newContext({viewport:{width:1440,height:1100}, deviceScaleFactor:1, locale:'th-TH', timezoneId:'Asia/Bangkok'});
const page = await context.newPage();
const errors=[]; const external=[];
page.on('pageerror', error=>errors.push(error.message));
page.on('request', request=>{ if(!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) external.push(request.url()); });
const checks=[];
const check=(name,details)=>checks.push({name,result:'PASS',details});
const shot=async name=>{await page.screenshot({path:path.join(out,name),fullPage:true});};
const base = process.env.HUD_PREVIEW_URL || 'http://127.0.0.1:5173/';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Browser QA only permits a local preview URL.');
try {
  await page.goto(base);
  await page.getByRole('button',{name:'เลือกลิฟต์ W-01'}).waitFor();
  await page.clock.setFixedTime(new Date('2026-09-14T03:00:00.000Z'));
  assert.equal(await page.getByRole('button',{name:/เลือกลิฟต์ W-/}).count(),5);
  assert.ok(await page.getByTestId('mode-indicator').isVisible());
  check('Five shafts and TEST/SIMULATED banner','1440x1100 Chrome; all five shafts visible');
  await shot('hud-desktop.png');

  const car=page.getByTestId('car-W-01');
  const yBefore=(await car.boundingBox()).y;
  await page.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}).click();
  assert.equal(await car.getAttribute('data-confirmed-anchor'),'0.475');
  assert.ok(await page.getByTestId('shaft-W-01').getByText('21',{exact:true}).isVisible());
  await page.waitForTimeout(300);
  const yMid=(await car.boundingBox()).y;
  await page.waitForTimeout(850);
  const yAfter=(await car.boundingBox()).y;
  assert.ok(yAfter<yMid && yMid<yBefore,JSON.stringify({yBefore,yMid,yAfter}));
  await page.waitForTimeout(400);
  assert.ok(Math.abs((await car.boundingBox()).y-yAfter)<0.5);
  check('Actual CSS interpolation','Confirmed floor changed immediately; intermediate rendered position measured; car stopped at its confirmed anchor');
  const track=page.getByTestId('shaft-W-01').locator('.shaft-track');
  const boundary=await track.boundingBox();
  // Geometry-only endpoint probe in isolated browser; it does not mutate telemetry or fixture data.
  await car.evaluate(node=>{node.classList.remove('interpolate');node.style.bottom='100%';});
  const top=await car.boundingBox();
  assert.ok(top.y>=boundary.y && top.y+top.height<=boundary.y+boundary.height);
  await car.evaluate(node=>{node.style.bottom='0%';});
  const bottom=await car.boundingBox();
  assert.ok(bottom.y>=boundary.y && bottom.y+bottom.height<=boundary.y+boundary.height);
  check('Car endpoint containment','Geometry-only CSS probe at normalized anchors 0 and 1; no telemetry modification');
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');

  await page.getByRole('button',{name:'เลือกลิฟต์ W-05'}).focus();
  await page.keyboard.press('Enter');
  const detail=page.getByRole('region',{name:'รายละเอียดลิฟต์ที่เลือก'});
  assert.ok(await detail.getByText('RAW CODE · FLOOR UNCONFIRMED').isVisible());
  assert.equal(await page.getByTestId('car-W-05').count(),0);
  check('Keyboard selection and uncalibrated detail','W-05 shows code 22 with no fabricated shaft position');
  await shot('hud-uncalibrated.png');

  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('alarm');
  assert.ok(await page.getByTestId('shaft-W-01').getByText('! 1 ALARM').isVisible());
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('reconnect');
  assert.equal(await car.getAttribute('data-animating'),'false');
  await page.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}).click();
  assert.equal(await car.getAttribute('data-animating'),'true');
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('delta-gap');
  assert.equal(await car.getAttribute('data-confirmed-anchor'),'0.45');
  assert.equal(await car.getAttribute('data-animating'),'false');
  await page.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}).click();
  assert.equal(await car.getAttribute('data-confirmed-anchor'),'0.475');
  check('Alarm, disconnect and gap recovery','Alarm rendered immediately; reconnect and gap require resnapshot');

  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('stale');
  assert.equal(await car.getAttribute('data-animating'),'false');
  assert.ok(await page.getByTestId('shaft-W-01').getByText(/STALE/).isVisible());
  assert.equal(await car.evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
  await shot('hud-stale.png');
  check('Stale telemetry cancels CSS transition','Transition duration 0s; retained confirmed position and visible age');

  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
  await page.getByRole('button',{name:'สาธิต',exact:true}).click();
  assert.ok(await page.getByTestId('mode-indicator').getByText('DEMO',{exact:true}).isVisible());
  await shot('hud-demo.png');
  await page.getByRole('button',{name:'ออกจาก DEMO'}).click();
  assert.ok(await page.getByText('TEST · SIMULATED').isVisible());
  check('DEMO boundary','DEMO banner present and isolated TEST state restored on exit');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}).click();
  assert.equal(await car.evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
  check('Reduced motion','Browser prefers-reduced-motion produces zero-duration movement');
  await page.emulateMedia({reducedMotion:'no-preference'});

  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
  await page.getByRole('button',{name:'เลือกลิฟต์ W-04'}).click();
  assert.ok(await detail.getByText('OUT_OF_SERVICE',{exact:true}).isVisible());
  assert.ok(await detail.getByText('COMMISSIONED',{exact:true}).isVisible());
  const mobile=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth,shaftScroll:document.querySelector('.shaft-grid').scrollWidth,shaftClient:document.querySelector('.shaft-grid').clientWidth}));
  assert.ok(mobile.body<=mobile.viewport,JSON.stringify(mobile));
  assert.ok(mobile.shaftScroll>mobile.shaftClient);
  await shot('hud-mobile.png');
  check('Responsive mobile and Lift 4','390x844; document has no horizontal overflow; shaft region scrolls; service and commissioning remain independent');
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  check('Browser runtime and network boundary','No page errors or external resource requests');
  await writeFile(path.join(out,'browser-qa.json'),JSON.stringify({status:'PASS',browser:browser.version(),url:base,checks,pageErrors:errors,externalRequests:external,screenshots:['hud-desktop.png','hud-uncalibrated.png','hud-stale.png','hud-demo.png','hud-mobile.png'],limits:['Local SIMULATED fixtures only','No real backend/WebSocket/auth/hardware validation','Visual snapshots are evidence, not an owner-approved regression baseline','FPS, field latency and long-duration memory performance NOT_RUN']},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',checks:checks.length,browser:browser.version(),evidence:out},null,2));
} catch(error) {
  await shot('hud-browser-failure.png').catch(()=>{});
  await writeFile(path.join(out,'browser-qa-failure.json'),JSON.stringify({status:'FAIL',error:String(error),checks,pageErrors:errors},null,2)+'\n');
  throw error;
} finally {await browser.close();}
