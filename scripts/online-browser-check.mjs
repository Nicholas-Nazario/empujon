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
  async function tab(url) {
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const cmd = (method, params = {}) => send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await cmd('Page.navigate', { url });
    return { cmd, evaluate };
  }
  async function until(tab, expression) {
    for (let i = 0; i < 100; i++) {
      if (await tab.evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}`);
  }
  const host = await tab(baseUrl);
  await until(host, '!!document.querySelector("#host-online")');
  await host.evaluate('document.querySelector("[data-opponent=beginner]").click(); document.querySelectorAll("[data-cell]")[0].click()');
  await host.evaluate('document.querySelector("#host-online").click()');
  assert.equal(await host.evaluate('document.querySelector("#online-setup").open'), true);
  await host.evaluate('document.querySelector("#cancel-online").click()');
  assert.equal(await host.evaluate('document.querySelector("#online-setup").open'), false);
  assert.equal(await host.evaluate('location.search'), '');
  await host.evaluate('document.querySelector("#host-online").click(); document.querySelector("#online-mode").value="upgrade"; document.querySelector("#turn-limit").value="60"; document.querySelector("#start-online").click()');
  await until(host, 'document.querySelector("#online-invite").open && document.querySelector("#online-status").textContent.includes("Waiting for your opponent to join")');
  assert.equal(await host.evaluate('document.querySelector("#online-setup").open'), false);
  assert.equal(await host.evaluate('getComputedStyle(document.querySelector(".opponent-picker")).display'), 'none');
  assert.equal(await host.evaluate('document.querySelector("[data-opponent=beginner]").disabled'), true);
  assert.equal(await host.evaluate('document.querySelector("[data-opponent=beginner]").getAttribute("aria-pressed")'), 'false');
  assert.equal(await host.evaluate('document.querySelector("#online-rules").textContent'), 'Upgrade rules');
  assert.equal(await host.evaluate('document.querySelector("#online-settings").textContent'), '60 seconds per turn');
  await host.evaluate('Object.defineProperty(navigator, "clipboard", {value: {writeText: async text => { window.copiedInvite = text; }}, configurable: true}); document.querySelector("#copy-invite").click()');
  await until(host, '!document.querySelector("#online-invite").open');
  assert.equal(await host.evaluate('window.copiedInvite'), await host.evaluate('document.querySelector("#invite-url").value'));
  await host.evaluate('document.querySelector("#show-invite").click()');
  assert.equal(await host.evaluate('document.querySelector("#online-invite").open'), false);
  assert.equal(await host.evaluate('window.copiedInvite'), await host.evaluate('document.querySelector("#sidebar-invite-url").value'));
  assert.equal(await host.evaluate('document.querySelector("#show-invite span").textContent'), 'Copy invite link');
  assert.match(await host.evaluate('document.querySelector("#sidebar-copy-feedback").textContent'), /copied/);
  const invite = await host.evaluate('document.querySelector("#invite-url").value');
  assert.match(invite, /game=[A-Z0-9]{6}$/);
  assert.equal(await host.evaluate('document.querySelectorAll("[data-cell]:not(:disabled)").length'), 0);
  const friend = await tab(invite);
  await until(friend, '!!document.querySelector("#online-status")');
  await until(friend, 'document.querySelector("#online-seat").textContent.includes("You are") && !document.querySelector("#online-status").textContent.includes("Connecting")');
  await until(host, '!document.querySelector("#online-status").textContent.includes("Waiting for your opponent to join")');
  const hostColor = await host.evaluate('document.querySelector("#online-seat").textContent.split(" · ")[0]');
  const friendColor = await friend.evaluate('document.querySelector("#online-seat").textContent.split(" · ")[0]');
  assert.notEqual(hostColor, friendColor);
  const first = hostColor.includes('Terracotta') ? host : friend;
  const second = first === host ? friend : host;
  await until(first, 'document.title.includes("Your turn") && !document.querySelector(".is-moving")');
  await first.evaluate('document.querySelectorAll("[data-cell]")[0].click()');
  await until(second, 'document.querySelector("#move-count").textContent === "MOVE 02" && document.title.includes("Your turn") && !document.querySelector(".is-moving")');
  await until(first, 'document.querySelectorAll("[data-cell]:not(:disabled)").length === 0');
  assert.match(await first.evaluate('document.querySelector("#online-status").textContent'), /Waiting for your opponent’s move/);
  await second.evaluate('document.querySelectorAll("[data-cell]")[35].click()');
  await until(first, 'document.querySelector("#move-count").textContent === "MOVE 03" && document.title.includes("Your turn") && !document.querySelector(".is-moving")');
  await first.cmd('Page.reload');
  await until(first, 'document.querySelector("#move-count")?.textContent === "MOVE 03" && document.title.includes("Your turn") && !document.querySelector(".is-moving")');
  const third = await tab(invite);
  await until(third, 'document.querySelector("#online-status")?.textContent.includes("already taken")');
  assert.equal(await third.evaluate('document.querySelectorAll("[data-cell]:not(:disabled)").length'), 0);
  for (const width of [1440, 390, 320]) {
    await host.cmd('Emulation.setDeviceMetricsOverride', {width, height: 1000, deviceScaleFactor: 1, mobile: width < 700});
    assert.ok(await host.evaluate(`document.documentElement.scrollWidth <= ${width}`), `Online layout overflows at ${width}`);
    assert.ok(await host.evaluate(`document.querySelector("#sidebar-invite-url").getBoundingClientRect().right <= ${width}`));
    const shot = await host.cmd('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
    await writeFile(`${tmpdir()}/empujon-online-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  console.log('Online browser checks passed: host, independent friend, opposite colors, live moves, turn indication, reload, and full-game rejection.');
} finally { ws?.close(); chrome.kill(); }
