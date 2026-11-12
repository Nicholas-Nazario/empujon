import { spawn } from 'node:child_process';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const profile = await mkdtemp(`${tmpdir()}/empujon-qa-`);
const chromePath = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const chrome = spawn(chromePath,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws;
try {
  let port;
  for (let i=0;i<100;i++) { try { port = (await readFile(`${profile}/DevToolsActivePort`,'utf8')).split('\n')[0]; break; } catch { await new Promise(r=>setTimeout(r,100)); } }
  if (!port) throw new Error('Chrome failed to start');
  const meta = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  ws = new WebSocket(meta.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=> { ws.onopen = resolve; ws.onerror = reject; });
  let id=0; const pending = new Map();
  ws.onmessage = event => { const msg = JSON.parse(event.data); if(msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); if(msg.error) p.reject(msg.error); else p.resolve(msg.result); } };
  const send = (method,params={},sessionId) => new Promise((resolve,reject)=> { const next=++id; pending.set(next,{resolve,reject}); ws.send(JSON.stringify({id:next,method,params,sessionId})); });
  const {targetId} = await send('Target.createTarget',{url:'about:blank'});
  const {sessionId} = await send('Target.attachToTarget',{targetId,flatten:true});
  const cmd = (m,p={})=>send(m,p,sessionId);
  const evaluate = async expression => { const r = await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  await cmd('Page.enable');
  await cmd('Emulation.setEmulatedMedia', {features: [{name:'prefers-color-scheme', value:'light'}]});
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:baseUrl});
  for(let i=0;i<100;i++) { if(await evaluate('!!document.querySelector("[data-cell]")')) break; await new Promise(r=>setTimeout(r,100)); }
  for (const theme of ['light', 'dark']) {
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate(`if (document.documentElement.dataset.theme !== '${theme}') document.querySelector('#theme').click()`);
    await new Promise(r=>setTimeout(r,250));
    assert.equal(await evaluate('document.documentElement.dataset.theme'), theme);
    assert.equal(await evaluate('document.querySelector("#theme").getAttribute("aria-checked")'), String(theme === 'dark'));
    assert.equal(await evaluate(`document.querySelector('meta[name="theme-color"]').content`),
      await evaluate('getComputedStyle(document.documentElement).backgroundColor'));
    const contrast = await evaluate(`(() => {
      const luminance = color => {
        const values = color.match(/[\\d.]+/g).slice(0, 3).map(Number).map(v => {
          const channel = v / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
      };
      return [...document.querySelectorAll('.player-title h3, .mode-heading')].map(el => {
        const foreground = luminance(getComputedStyle(el).color);
        const background = luminance(getComputedStyle(el.closest('.player-card, .mode')).backgroundColor);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      });
    })()`);
    assert.ok(contrast.every(ratio => ratio >= 4.5), `${theme} title contrast: ${contrast}`);
    await evaluate('document.querySelectorAll("[data-cell]")[0].click(); document.querySelectorAll("[data-cell]")[7].click()');
    for (const width of [1440, 768, 390, 320]) {
      await cmd('Emulation.setDeviceMetricsOverride', {width, height:1000, deviceScaleFactor:1, mobile:width<700});
      await new Promise(r=>setTimeout(r,100));
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${theme} ${width} overflow`);
      const shot = await cmd('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
      await writeFile(`${tmpdir()}/empujon-${theme}-${width}.png`, Buffer.from(shot.data,'base64'));
    }
  }
  await cmd('Page.reload');
  for(let i=0;i<100;i++) { if(await evaluate('!!document.querySelector("#theme")')) break; await new Promise(r=>setTimeout(r,100)); }
  assert.equal(await evaluate('document.querySelector("#theme").getAttribute("aria-checked")'), 'true');
  await cmd('Emulation.setEmulatedMedia', {features: [{name:'prefers-color-scheme', value:'light'}]});
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await evaluate('document.querySelector("#theme").click()');
  assert.equal(await evaluate('localStorage.getItem("empujon:theme")'), 'light');
  await cmd('Emulation.setEmulatedMedia', {features: [{name:'prefers-color-scheme', value:'dark'}]});
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
  await evaluate('localStorage.removeItem("empujon:theme")');
  await cmd('Page.reload');
  for(let i=0;i<100;i++) { if(await evaluate('!!document.querySelector("#theme")')) break; await new Promise(r=>setTimeout(r,100)); }
  assert.equal(await evaluate('document.querySelector("#theme").getAttribute("aria-checked")'), 'true');
  for (const value of ['light', 'dark']) {
    await cmd('Emulation.setEmulatedMedia', {features: [{name:'prefers-color-scheme', value}]});
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate('document.querySelector("#theme").getAttribute("aria-checked")'), String(value === 'dark'));
    assert.equal(await evaluate('getComputedStyle(document.documentElement).backgroundColor'), value === 'dark' ? 'rgb(23, 43, 41)' : 'rgb(220, 235, 229)');
  }
  console.log('Theme checks passed: both palettes, responsive layouts, saved preference, system changes, browser chrome.');
} finally { ws?.close(); chrome.kill(); }
