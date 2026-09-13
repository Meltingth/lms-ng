import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../docs/frontend/evidence/display');
await mkdir(out,{recursive:true});
const executablePath=process.env.HUD_BROWSER_EXECUTABLE || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const results=[]; const errors=[];
try {
  for(const spec of [
    {name:'full-hd',width:1920,height:1080,dpr:1},
    {name:'4k',width:3840,height:2160,dpr:1},
    {name:'4k-dpi-200',width:1920,height:1080,dpr:2},
    {name:'full-hd-window',width:1920,height:940,dpr:1},
    {name:'full-hd-dpi-150',width:1280,height:720,dpr:1.5},
  ]) {
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:spec.dpr,locale:'th-TH'});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button',{name:'เลือกลิฟต์ W-01'}).waitFor();
    const measure=()=>page.evaluate(()=>{
      const dimensions=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight};};
      return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,panels:Object.fromEntries(['.app-header','.kpi-grid','.workspace-grid','.shaft-grid','.detail-panel','.simulation-controls','.lower-grid','.health-footer'].map(selector=>[selector,dimensions(document.querySelector(selector))])),shafts:[...document.querySelectorAll('.shaft-card')].map(dimensions),mode:getComputedStyle(document.querySelector('.mode-indicator')).display};
    });
    const normal=await measure();
    const spacing=await page.locator('.page-title h1').evaluate(node=>parseFloat(getComputedStyle(node).letterSpacing));
    const expectedUnit=Math.min(spec.width/1920,spec.height/1080);
    assert.ok(Math.abs(spacing-(-0.5*expectedUnit))<0.01,spec.name+' scaled typography invalid');
    console.log(spec.name + ': ' + normal.scrollWidth + 'x' + normal.scrollHeight);
    await page.screenshot({path:path.join(out,spec.name+'.jpg'),type:'jpeg',quality:85});
    assert.ok(normal.scrollWidth<=spec.width+1 && normal.scrollHeight<=spec.height+1,spec.name+' document overflow');
    for(const [name,rect] of Object.entries(normal.panels)) assert.ok(rect.x>=0 && rect.y>=0 && rect.right<=spec.width+1 && rect.bottom<=spec.height+1,spec.name+' '+name+' outside viewport');
    assert.ok(normal.panels['.kpi-grid'].scrollHeight<=normal.panels['.kpi-grid'].clientHeight+1,spec.name+' KPI content overflow');
    assert.equal(normal.shafts.length,5);
    assert.ok(normal.shafts.every(rect=>rect.right<=spec.width && rect.width>0 && rect.height>0));
    assert.ok(normal.panels['.detail-panel'].scrollHeight<=normal.panels['.detail-panel'].clientHeight+1,spec.name+' detail needs scrolling');
    assert.ok(await page.getByTestId('mode-indicator').isVisible());
    assert.ok(await page.getByRole('button',{name:'Full Screen',exact:true}).isVisible());
    await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('stale');
    const stale=await measure();
    assert.ok(stale.scrollHeight<=spec.height+1 && stale.scrollWidth<=spec.width+1,spec.name+' stale overflow');
    assert.ok(stale.panels['.detail-panel'].scrollHeight<=stale.panels['.detail-panel'].clientHeight+1,spec.name+' stale detail needs scrolling');
    await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('delta-gap');
    const gap=await measure();assert.ok(gap.scrollHeight<=spec.height+1,spec.name+' warning overflow');
    await page.getByLabel('เลือกสถานการณ์จำลอง').selectOption('normal');
    await page.getByRole('button',{name:'สาธิต',exact:true}).click();
    assert.ok(await page.getByTestId('mode-indicator').getByText('DEMO',{exact:true}).isVisible());
    const demo=await measure();assert.ok(demo.scrollHeight<=spec.height+1,spec.name+' demo overflow');
    results.push({name:spec.name,result:'PASS',viewport:spec,normal,stale,gap});
    if(spec.name==='full-hd') {
      await page.getByRole('button',{name:'Full Screen',exact:true}).click();
      await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
      assert.ok(await page.getByRole('button',{name:'Exit Full Screen',exact:true}).isVisible());
      await page.getByRole('button',{name:'Exit Full Screen',exact:true}).click();
      await page.waitForFunction(()=>document.fullscreenElement===null);
      results.push({name:'native-fullscreen-enter-exit',result:'PASS'});
    }
    await context.close();
  }
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto('http://127.0.0.1:5173/');
  await mobile.getByRole('button',{name:'Full Screen',exact:true}).waitFor();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.screenshot({path:path.join(out,'mobile.jpg'),type:'jpeg',quality:85,fullPage:true});
  results.push({name:'mobile-no-horizontal-overflow',result:'PASS'});
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'verification.json'),JSON.stringify({status:'PASS',browser:browser.version(),results,pageErrors:errors,scope:'Local SIMULATED UI. No Dell deployment or workstation startup installation was performed.'},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',checks:results.length,evidence:out}));
} finally {await browser.close();}
