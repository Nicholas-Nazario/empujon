import { renderMovement } from '../src/ui/components/movement.ts';

import { spawn } from 'node:child_process';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
  await cmd('Emulation.setDeviceMetricsOverride',{width:1200,height:630,deviceScaleFactor:2,mobile:false});
  const identity = await readFile('src/visual-identity.css','utf8');
  const styles = await readFile('src/style.css','utf8');
  let logo = (await readFile('src/ui/templates/layout.html','utf8')).match(/<a class="wordmark"[\s\S]*?<\/a>/)[0];
  const island = await readFile('node_modules/@phosphor-icons/core/assets/duotone/island-duotone.svg','utf8');
  const crown = await readFile('node_modules/@phosphor-icons/core/assets/fill/crown-simple-fill.svg','utf8');
  logo=logo.replace('<span data-icon="island"></span>',island.replace('<svg ','<svg class="ui-icon" '));
  const pieces=new Map([[7,[0,false]],[8,[1,false]],[10,[1,true]],[13,[1,false]],[15,[0,true]],[20,[0,false]],[22,[1,true]],[27,[0,true]]]);
  const cells=Array.from({length:36},(_,i)=>{const p=pieces.get(i);return `<div class="cell">${p?`<span class="piece p${p[0]}${p[1]?' upgraded':''}">${p[1]?crown.replace('<svg ','<svg class="ui-icon" '):''}</span>`:''}</div>`}).join('');
  // Terracotta at B2 pushes neighbors to the right and downward.
  const movement = renderMovement({ owner: 0, placement: 7, pushes: [{ owner: 1, from: 13, to: 19, dr: 1, dc: 0 }, { owner: 1, from: 8, to: 9, dr: 0, dc: 1 }] }, false).svg;
  const html=`<html><head><style>${identity}\n${styles}\nbody{width:1200px;height:630px;display:flex;align-items:center;justify-content:center}.social{width:1016px;height:534px;background:var(--osj-stucco-white);border-radius:28px;display:grid;grid-template-columns:1fr 454px;align-items:center;padding:40px;gap:24px}.wordmark{font-size:58px;justify-content:flex-start}.brand-island .ui-icon{width:46px;height:46px}.copy p{font-size:22px;line-height:1.5;margin:26px 0}.copy small{font-size:12px;letter-spacing:2px}.board-frame{padding:12px}.board{width:428px;gap:1px;position:relative}.cell{background:var(--board-cell)}.cell:nth-child(12n+2),.cell:nth-child(12n+4),.cell:nth-child(12n+6),.cell:nth-child(12n+7),.cell:nth-child(12n+9),.cell:nth-child(12n+11){background:var(--board-cell-alternate)}</style></head><body><div class="social"><div class="copy">${logo}<p>A little push changes everything.</p><small>A STRATEGY GAME FOR TWO</small></div><div class="board-frame"><div class="board">${cells}<div class="movement-overlay">${movement}</div></div></div></div></body></html>`;
  await cmd('Page.setDocumentContent',{frameId:(await cmd('Page.getFrameTree')).frameTree.frame.id,html});
  await evaluate("document.fonts.ready.then(()=>true)");
  await new Promise(r=>setTimeout(r,2500));
  const {data}=await cmd('Page.captureScreenshot',{format:'png'});
  await writeFile('public/empujon-social.png',Buffer.from(data,'base64'));
  await writeFile('public/empujon-social.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><image width="1200" height="630" href="data:image/png;base64,${data}"/></svg>`);
} finally { ws?.close(); chrome.kill(); }
