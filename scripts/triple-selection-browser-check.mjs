import { createGame, place, chooseUpgrade } from '../src/game.ts';
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
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await cmd('Page.navigate',{url:baseUrl});
  for(let i=0;i<100;i++) { if(await evaluate('!!document.querySelector("[data-cell]")')) break; await wait(100); }
  const replay = await evaluate(`(async () => {
    const {createGame,place,chooseUpgrade} = await import('/src/game.ts');
    let seed=25;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
    for(let attempt=0;attempt<200;attempt++) {
      let game=createGame('upgrade'); const path=[];
      for(let step=0;step<150 && game.winner===null;step++) {
        const choice=game.choices[0];
        if(choice?.kind==='line' && choice.options.length>1) {
          const unique=choice.options.flatMap((cells,option)=>cells.filter(i=>choice.options.filter(o=>o.includes(i)).length===1).map(i=>({i,option})));
          const shared=choice.options.flat().find(i=>choice.options.filter(o=>o.includes(i)).length>1);
          if(unique.length && shared!==undefined) return {path,choice,unique,shared};
        }
        if(choice) {path.push({type:'choose',option:0,cell:choice.options[0][0]});game=chooseUpgrade(game,0);}
        else {
          const empty=game.board.flatMap((p,i)=>p?[]:[i]);
          const index=empty[Math.floor(random()*empty.length)];
          const upgraded=game.pools[game.turn].some(p=>p.upgraded);
          path.push({type:'place',index,upgraded});game=place(game,index,upgraded);
        }
      }
    }
    throw new Error('Could not find overlapping triples');
  })()`);
  await evaluate("document.querySelector('[data-mode=upgrade]').click()");
  let beforeChoiceTop;
  for(const action of replay.path) {
    beforeChoiceTop = await evaluate('document.querySelector("#board").getBoundingClientRect().top');
    await evaluate(`(() => {
      const a=${JSON.stringify(action)};
      if(a.type==='choose') {
        document.querySelector('[data-cell="'+a.cell+'"]').click();
        document.querySelector('[data-confirm-upgrade]')?.click();
      } else {
        document.querySelector('[data-piece="'+(a.upgraded?'upgraded':'base')+'"]').click();
        document.querySelector('[data-cell="'+a.index+'"]').click();
      }
    })()`);
    if(await evaluate("!!document.querySelector('.cell.upgrading')")) await wait(950);
  }
  assert.equal(await evaluate('document.querySelector("#board").getBoundingClientRect().top'),beforeChoiceTop);
  assert.equal(await evaluate('document.querySelector("#choices").children.length'),0);
  assert.ok(await evaluate("!document.querySelector('[data-confirm-upgrade]').hidden"));
  assert.ok(await evaluate("document.querySelector('[data-confirm-upgrade]').disabled"));
  const first=replay.unique[0];
  await evaluate(`document.querySelector('[data-cell="${first.i}"]').click()`);
  assert.equal(await evaluate("document.querySelectorAll('.choice-highlight').length"),3);
  assert.ok(await evaluate("!document.querySelector('[data-confirm-upgrade]').disabled"));
  await evaluate(`document.querySelector('[data-cell="${replay.shared}"]').click()`);
  const highlighted=await evaluate("[...document.querySelectorAll('.choice-highlight')].map(c=>+c.dataset.cell)");
  await evaluate(`document.querySelector('[data-cell="${replay.shared}"]').focus()`);
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.notDeepEqual(await evaluate("[...document.querySelectorAll('.choice-highlight')].map(c=>+c.dataset.cell)"),highlighted);
  assert.ok(await evaluate("document.activeElement.matches('[data-cell]')"));
  for(const theme of ['light','dark']) {
    await evaluate(`if(document.documentElement.dataset.theme!=='${theme}') document.querySelector('#theme').click()`);
    for(const width of [1440,768,390,320]) {
      await cmd('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<700});
      await evaluate(`document.querySelector('[data-cell="${first.i}"]').click()`);
      await wait(100);
      if(width===390) {
        await cmd('Emulation.setTouchEmulationEnabled',{enabled:true});
        const point=await evaluate(`(() => {
          const cell=document.querySelector('[data-cell="${first.i}"]'); cell.scrollIntoView({block:'center'});
          const r=cell.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
        })()`);
        await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await wait(80);
        assert.equal(await evaluate("document.querySelectorAll('.choice-highlight').length"),3);
        await cmd('Emulation.setTouchEmulationEnabled',{enabled:false});
      }
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),theme+' '+width+' overflow');
      const rect=await evaluate('document.querySelector("#board").getBoundingClientRect().toJSON()');
      assert.ok(Math.abs(rect.width-rect.height)<2);
      const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(`${tmpdir()}/empujon-triples-${theme}-${width}.png`,Buffer.from(shot.data,'base64'));
    }
  }
  await cmd('Emulation.setEmulatedMedia',{features:[]});
  await evaluate("document.querySelector('[data-confirm-upgrade]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.cell.upgrading').length"),3);
  await wait(1400);
  assert.ok(await evaluate("document.querySelector('[data-confirm-upgrade]').hidden"));
  console.log('Triple selection passed: real-game replay, board selection, shared-piece cycling, stable board position, no controls below, confirmation, focus, upgrade pulses, and both themes at desktop/tablet/390px/320px.');
} finally { ws?.close(); chrome.kill(); }
