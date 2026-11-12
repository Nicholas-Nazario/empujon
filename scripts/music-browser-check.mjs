import { musicTracks } from '../src/music/tracks.ts';
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
  const evaluate = async expression => { const r = await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  await cmd('Page.enable');
  const wait = ms => new Promise(r=>setTimeout(r,ms));
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`const NativeAudio=window.Audio; window.Audio=class extends NativeAudio {constructor(...args){super(...args);window.__musicAudio=this;}};`});
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:baseUrl});
  for(let i=0;i<100;i++) {if(await evaluate('!!document.querySelector("#music-open")')) break; await wait(100);}
  assert.equal(await evaluate('window.__musicAudio.src'),'');
  assert.equal(await evaluate('document.querySelectorAll("[name=music-track]:checked").length'),5);
  assert.ok(await evaluate('document.querySelector("#music-open").nextElementSibling.id==="theme"'));
  await evaluate('document.querySelector("#music-open").click()');
  await wait(50);
  assert.equal(await evaluate('document.querySelector("#music-dialog").matches(":popover-open")'),true);
  assert.equal(await evaluate('document.querySelector("#music-open").getAttribute("aria-expanded")'),'true');
  await evaluate('document.querySelector("#music-play").click()');
  const playing = async title => {
    for(let i=0;i<100;i++) {if(await evaluate(`document.querySelector('#music-status').textContent===${JSON.stringify('Playing '+title)}`)) return;await wait(100);}
    throw new Error('Not playing '+title);
  };
  await playing('Airoso');
  assert.equal(await evaluate('document.querySelector("#music-announcement-title").textContent'),'Airoso');
  assert.equal(await evaluate('document.querySelector("#music-announcement-composer").textContent'),'WombatNoisesAudio');
  assert.ok(await evaluate('document.querySelector("#music-open .ui-icon").getAnimations().length > 0'));
  await evaluate('window.__originalMusicIcon=document.querySelector("#music-open .ui-icon"); document.querySelector("#music-volume").dispatchEvent(new Event("input"))');
  assert.ok(await evaluate('window.__originalMusicIcon===document.querySelector("#music-open .ui-icon")'));
  await wait(4400);
  assert.equal(await evaluate('document.querySelector("#music-announcement").matches(":popover-open")'),false);
  for(const track of musicTracks) {
    await evaluate(`document.querySelector('[data-play-track="${track.id}"]').click()`);
    await playing(track.title);
    if(track.id!=='airoso') assert.equal(await evaluate('document.querySelector("#music-announcement-title").textContent'),track.title);
    assert.ok((await evaluate('window.__musicAudio.src')).endsWith(track.src));
  }
  await evaluate('window.__musicAudio.dispatchEvent(new Event("ended"))');
  await playing('Airoso');
  await evaluate('document.querySelectorAll("[name=music-track]")[0].click()');
  await playing('Caribbean Night');
  assert.equal(await evaluate('document.querySelectorAll("[name=music-track]:checked").length'),4);
  await evaluate('document.querySelectorAll("[name=music-track]:checked").forEach(input=>input.click())');
  assert.ok(await evaluate('document.querySelector("#music-play").disabled && window.__musicAudio.paused'));
  await evaluate('document.querySelectorAll("[name=music-track]")[3].click(); document.querySelector("#music-play").click()');
  await playing('Salome');
  await evaluate('document.querySelector("#music-volume").value="42"; document.querySelector("#music-volume").dispatchEvent(new Event("input",{bubbles:true}))');
  await evaluate('document.querySelector("#music-close").click(); document.querySelector("#sound").click()');
  assert.equal(await evaluate('window.__musicAudio.paused'),false);
  for(const theme of ['light','dark']) {
    await evaluate(`if(document.documentElement.dataset.theme!=='${theme}')document.querySelector('#theme').click()`);
    for(const width of [1440,768,390,320]) {
      await cmd('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
      await evaluate('document.querySelector("#music-open").click()'); await wait(100);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),theme+' '+width+' page overflow');
      assert.ok(await evaluate('document.querySelector("#music-dialog").scrollWidth<=document.querySelector("#music-dialog").clientWidth'));
      await evaluate('document.querySelectorAll("[data-play-track]")[0].click()');
      await playing('Airoso');
      await evaluate('document.querySelectorAll("[data-play-track]")[3].click()');
      await playing('Salome');
      const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(`${tmpdir()}/empujon-music-${theme}-${width}.png`,Buffer.from(shot.data,'base64'));
      await evaluate('document.querySelector("#music-close").click()');
      const boardTop=await evaluate('document.querySelector("#board").getBoundingClientRect().top');
      const bounds=await evaluate('document.querySelector("#music-announcement").getBoundingClientRect().toJSON()');
      assert.ok(bounds.x>=0 && bounds.right<=width && bounds.y>=0);
      const preview=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(`${tmpdir()}/empujon-music-announcement-${theme}-${width}.png`,Buffer.from(preview.data,'base64'));
      assert.equal(await evaluate('document.querySelector("#board").getBoundingClientRect().top'),boardTop);
      await evaluate('document.querySelector("#music-open").click()');
      await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      assert.equal(await evaluate('document.querySelector("#music-dialog").matches(":popover-open")'),false);
    }
  }
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await wait(100);
  await evaluate('document.querySelector("#music-open").click(); document.querySelectorAll("[data-play-track]")[0].click()');
  await playing('Airoso');
  assert.equal(await evaluate('document.querySelector("#music-open .ui-icon").getAnimations().length'),0);
  assert.equal(await evaluate('document.querySelector("#music-announcement").getAnimations().length'),0);
  assert.ok(await evaluate('document.querySelector("#music-announcement").matches(":popover-open")'));
  await evaluate('document.querySelector("#music-play").click()');
  assert.equal(await evaluate('document.querySelector("#music-announcement").matches(":popover-open")'),false);
  assert.equal(await evaluate('document.querySelector("#music-open .ui-icon").getAnimations().length'),0);
  await cmd('Page.reload');await wait(500);
  for(let i=0;i<100;i++) {if(await evaluate('!!document.querySelector("#music-open")')) break;await wait(100);}
  assert.equal(await evaluate('window.__musicAudio.paused'),true);
  assert.equal(await evaluate('document.querySelectorAll("[name=music-track]:checked").length'),2);
  assert.equal(await evaluate('document.querySelector("[name=music-track]:checked").value'),'airoso');
  assert.equal(await evaluate('document.querySelector("#music-volume").value'),'42');
  console.log('Music checks passed: animated icon, timed title/composer announcements, reduced motion, header popover, all tracks included, real playback, playlist advance, exclusions, empty playlist, saved choices, Escape, and desktop/tablet/mobile themes.');
} finally {ws?.close();chrome.kill();}
