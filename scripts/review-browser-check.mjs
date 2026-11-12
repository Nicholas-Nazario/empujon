import { createGame } from '../src/game.ts';
import { beginnerAction } from '../src/ai.ts';
import { applyAction, legalActions, actingPlayer } from '../src/actions.ts';
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
    await cmd('Emulation.setEmulatedMedia', {features: [{name:'prefers-reduced-motion',value:'reduce'}]});
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
  function fixture(mode) {
    const random = Math.random;
    let seed = 1;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    let game = createGame(mode);
    const actions = [], frames = [game];
    try {
      while (game.winner === null && actions.length < 200) {
        const action = beginnerAction(game);
        actions.push(action);
        game = applyAction(game, action);
        frames.push(game);
      }
    } finally { Math.random = random; }
    assert.notEqual(game.winner, null);
    return { actions, frames };
  }
  const snapshot = page => page.evaluate(`({
    board: [...document.querySelectorAll('[data-cell]')].map(cell => {
      const piece = cell.querySelector(':scope > .piece');
      return piece ? {owner:piece.classList.contains('p0') ? 0 : 1, upgraded:piece.classList.contains('upgraded')} : null;
    }),
    pools: [...document.querySelectorAll('.player-card .supply')].map(supply => [...supply.querySelectorAll('.piece')].map(piece => ({owner:piece.classList.contains('p0') ? 0 : 1, upgraded:piece.classList.contains('upgraded')})))
  })`);
  async function assertPosition(page, game) {
    const actual = await snapshot(page);
    assert.deepEqual(actual.board, game.board);
    assert.deepEqual(actual.pools, game.pools);
    assert.equal(await page.evaluate('document.querySelectorAll("[data-cell]:not(:disabled), [data-piece]:not(:disabled), [data-choice]:not(:disabled)").length'), 0);
    assert.equal(await page.evaluate('document.querySelector("#movement-preview").hidden'), true);
    if (game.lastMovement) assert.match(await page.evaluate('document.querySelector("#movement-description").textContent'), /Last move:/);
  }
  async function reviewGame(page, frames) {
    await until(page, 'document.querySelector("#new-game").open');
    assert.equal(await page.evaluate('document.querySelector("#game-review").hidden'), true);
    assert.equal(await page.evaluate('document.querySelector("#cancel-new").textContent'), 'Review game');
    await page.evaluate('document.querySelector("#cancel-new").click()');
    assert.equal(await page.evaluate('document.querySelector("#game-review").hidden'), false);
    assert.ok(await page.evaluate('document.querySelector(".board-heading").contains(document.querySelector("#game-review"))'));
    assert.equal(await page.evaluate('document.querySelector("#move-count").hidden'), true);
    assert.equal(await page.evaluate('document.querySelector("[data-review=final]").disabled'), true);
    for (let i = frames.length - 1; i >= 0; i--) {
      await assertPosition(page, frames[i]);
      assert.match(await page.evaluate('document.querySelector("#review-position").textContent'), new RegExp(`${i + 1} / ${frames.length}$`));
      if (i) await page.evaluate('document.querySelector("[data-review=previous]").click()');
    }
    assert.equal(await page.evaluate('document.querySelector("[data-review=first]").disabled'), true);
    for (let i = 1; i < frames.length; i++) {
      await page.evaluate('document.querySelector("[data-review=next]").click()');
      await assertPosition(page, frames[i]);
    }
    await page.evaluate('document.querySelector("[data-review=first]").click(); document.querySelector("#movement-toggle").click()');
    await assertPosition(page, frames[0]);
    await page.evaluate('document.querySelector("[data-review=next]").click()');
    assert.ok(await page.evaluate('document.querySelector("#movement-overlay").innerHTML.length > 0'));
    await page.evaluate('document.querySelector("[data-review=final]").click()');
    await assertPosition(page, frames.at(-1));
    assert.equal(await page.evaluate('document.querySelector("#new-game").open'), false);
    assert.ok(await page.evaluate('[...document.querySelectorAll(".winning")].every(cell => getComputedStyle(cell).animationName === "none")'));
  }
  const upgrade = fixture('upgrade');
  assert.ok(upgrade.actions.some(action => action.type === 'choose'));
  const local = await tab(baseUrl);
  await until(local, '!!document.querySelector("#board .cell")');
  await local.evaluate('document.querySelectorAll("[data-cell]")[0].click(); document.querySelector("#undo").click(); document.querySelector("[data-mode=upgrade]").click()');
  for (const [actionIndex, action] of upgrade.actions.entries()) {
    await until(local, '!document.querySelector(".upgrading, .is-moving")');
    assert.deepEqual((await snapshot(local)).board, upgrade.frames[actionIndex].board, `Before action ${actionIndex}: ${JSON.stringify(action)}`);
    await local.evaluate(action.type === 'choose'
      ? `(() => {
          const cells = ${JSON.stringify(upgrade.frames[actionIndex].choices[0].options[action.option])};
          for (let attempt = 0; attempt < 20; attempt++) {
            document.querySelector('[data-cell="' + cells[0] + '"]').click();
            const selected = [...document.querySelectorAll('.choice-highlight')].map(cell => +cell.dataset.cell);
            if (selected.length === cells.length && cells.every(cell => selected.includes(cell))) break;
          }
          document.querySelector('[data-confirm-upgrade]').click();
        })()`
      : `document.querySelector('[data-piece="${action.upgraded ? 'upgraded' : 'base'}"]').click(); document.querySelector('[data-cell="${action.index}"]').click()`);
  }
  await reviewGame(local, upgrade.frames);
  for (const theme of ['light', 'dark']) {
    await local.evaluate(`if (document.documentElement.dataset.theme !== '${theme}') document.querySelector('#theme').click()`);
    for (const width of [1440, 768, 390, 320]) {
      await local.cmd('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:width < 700});
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.ok(await local.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      assert.ok(await local.evaluate('document.querySelector("#game-review").getBoundingClientRect().bottom <= document.querySelector(".board-frame").getBoundingClientRect().top'));
      const geometry = await local.evaluate('document.querySelector("#board").getBoundingClientRect().toJSON()');
      assert.ok(Math.abs(geometry.width - geometry.height) < 1);
      const shot = await local.cmd('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
      await writeFile(`${tmpdir()}/empujon-review-${theme}-${width}.png`, Buffer.from(shot.data,'base64'));
    }
  }
  await local.evaluate('document.querySelector("[data-review=first]").click(); document.querySelector("[data-mode].active").click(); document.querySelector("#cancel-new").click()');
  await assertPosition(local, upgrade.frames[0]);
  await local.evaluate('document.querySelector("[data-mode].active").click(); document.querySelector("#confirm-new").click()');
  assert.equal(await local.evaluate('document.querySelector("#game-review").hidden'), true);
  assert.equal(await local.evaluate('document.querySelectorAll("[data-cell]:not(:disabled)").length'), 36);
  console.log('Local review: every upgrade position, choice, supply, navigation boundary, annotations, reset, both themes and four widths.');

  const cpu = await tab(baseUrl);
  await until(cpu, '!!document.querySelector("#board .cell")');
  await cpu.evaluate('document.querySelector("[data-opponent=beginner]").click()');
  let cpuGame = createGame('classic');
  const cpuFrames = [cpuGame];
  for (let turn = 0; cpuGame.winner === null && turn < 100; turn++) {
    const action = beginnerAction(cpuGame);
    cpuGame = applyAction(cpuGame, action);
    cpuFrames.push(cpuGame);
    await cpu.evaluate(`document.querySelector('[data-cell="${action.index}"]').click()`);
    if (cpuGame.winner !== null) break;
    const nextMove = cpuGame.moves + 1;
    await until(cpu, `!document.querySelector('.is-moving') && Number(document.querySelector('#move-count').textContent.replace(/[^0-9]/g,'')) >= ${nextMove}`);
    // Wait for the actual worker's reply (the turn heading returns to Terracotta or a winner).
    await until(cpu, 'document.querySelector("#turn-title").textContent.includes("Terracotta") || document.querySelector("#turn-title").textContent.includes("wins")');
    const actual = await snapshot(cpu);
    const reply = legalActions(cpuGame).map(action => applyAction(cpuGame, action)).find(next => JSON.stringify(next.board) === JSON.stringify(actual.board));
    assert.ok(reply, 'Worker reply must match a legal transition');
    cpuGame = reply;
    cpuFrames.push(cpuGame);
  }
  assert.notEqual(cpuGame.winner, null);
  await reviewGame(cpu, cpuFrames);
  console.log('CPU review: all human moves and real worker replies retained.');

  async function request(path, body) {
    const response = await fetch(`${baseUrl}api/games${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result = await response.json();
    assert.equal(response.ok, true, JSON.stringify(result));
    return result;
  }
  const host = await request('', {mode:'upgrade',turnSeconds:0});
  const friend = await request(`/${host.code}/join`, {});
  const tokens = host.player === 0 ? [host.token, friend.token] : [friend.token, host.token];
  let online = friend;
  for (const action of upgrade.actions) online = await request(`/${host.code}/move`, {token:tokens[actingPlayer(online.game)],revision:online.revision,action});
  assert.deepEqual(online.history, upgrade.frames);
  const joined = await tab(baseUrl);
  await until(joined, '!!document.querySelector("#board .cell")');
  await joined.evaluate(`localStorage.setItem('empujon:${host.code}', ${JSON.stringify(JSON.stringify({token:host.token,player:host.player}))})`);
  await joined.cmd('Page.navigate', {url:`${baseUrl}?game=${host.code}`});
  await until(joined, 'document.querySelector("#online-status")?.textContent.includes("won")');
  await reviewGame(joined, upgrade.frames);
  await joined.cmd('Page.reload');
  await until(joined, 'document.querySelector("#online-status")?.textContent.includes("won")');
  await until(joined, 'document.querySelector("#new-game").open');
  await joined.evaluate('document.querySelector("#cancel-new").click(); document.querySelector("[data-review=first]").click()');
  await assertPosition(joined, upgrade.frames[0]);
  console.log('Online review: complete persisted timeline available on reconnect and reload.');
  // Normal movement finishes before the dialog; review stays hidden until explicitly chosen.
  const animated = await tab(baseUrl);
  await until(animated, '!!document.querySelector("#board .cell")');
  await animated.cmd('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const classic = fixture('classic');
  for (const action of classic.actions) {
    await animated.evaluate(`document.querySelector('[data-cell="${action.index}"]').click()`);
    await until(animated, '!document.querySelector(".is-moving")');
  }
  assert.equal(await animated.evaluate('document.querySelector("#game-review").hidden'), true);
  await until(animated, 'document.querySelector("#new-game").open');
  assert.equal(await animated.evaluate('document.querySelector("#game-review").hidden'), true);
  await animated.evaluate('document.querySelector("#cancel-new").click(); document.querySelector("[data-review=first]").click()');
  await assertPosition(animated, classic.frames[0]);
  assert.equal(await animated.evaluate('document.querySelector("#new-game").open'), false);
  await animated.cmd('Page.bringToFront');
  await animated.cmd('Emulation.setFocusEmulationEnabled', {enabled:true});
  await animated.evaluate('document.querySelector("[data-review=next]").focus()');
  await animated.cmd('Input.dispatchKeyEvent', {type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await animated.cmd('Input.dispatchKeyEvent', {type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await animated.evaluate('document.querySelector("#board").classList.contains("is-moving")'), true);
  await until(animated, '!document.querySelector(".is-moving")');
  await assertPosition(animated, classic.frames[1]);
  for (let i = 2; i < classic.frames.length; i++) {
    await animated.evaluate('document.querySelector("[data-review=next]").click()');
    assert.equal(await animated.evaluate('document.querySelector("#board").classList.contains("is-moving")'), true);
    await until(animated, '!document.querySelector(".is-moving")');
    await assertPosition(animated, classic.frames[i]);
  }
  for (let i = classic.frames.length - 2; i >= 0; i--) {
    await animated.evaluate('document.querySelector("[data-review=previous]").click()');
    assert.equal(await animated.evaluate('document.querySelector("#board").classList.contains("is-moving")'), true);
    await until(animated, '!document.querySelector(".is-moving")');
    await assertPosition(animated, classic.frames[i]);
  }
  await animated.evaluate('document.querySelector("[data-review=first]").click(); document.querySelector("[data-review=next]").click(); document.querySelector("[data-review=final]").click()');
  assert.equal(await animated.evaluate('document.querySelector("#board").classList.contains("is-moving")'), false);
  await assertPosition(animated, classic.frames.at(-1));
  await new Promise(resolve => setTimeout(resolve, 450));
  await assertPosition(animated, classic.frames.at(-1));
  assert.equal(await animated.evaluate('document.querySelector("#new-game").open'), false);
  // Exercise animated upgrade returns and decisions using the same recorded online game.
  await joined.cmd('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  for (let i = 1; i < upgrade.frames.length; i++) {
    await joined.evaluate('document.querySelector("[data-review=next]").click()');
    const placement = upgrade.actions[i - 1].type === 'place';
    assert.equal(await joined.evaluate('document.querySelector("#board").classList.contains("is-moving")'), placement);
    await until(joined, '!document.querySelector(".is-moving")');
    await assertPosition(joined, upgrade.frames[i]);
  }
  for (let i = upgrade.frames.length - 2; i >= 0; i--) {
    await joined.evaluate('document.querySelector("[data-review=previous]").click()');
    const placement = upgrade.actions[i].type === 'place';
    assert.equal(await joined.evaluate('document.querySelector("#board").classList.contains("is-moving")'), placement);
    await until(joined, '!document.querySelector(".is-moving")');
    await assertPosition(joined, upgrade.frames[i]);
  }
  // Changing direction or jumping during reverse motion must discard its pending completion.
  await animated.evaluate('document.querySelector("[data-review=previous]").click(); document.querySelector("[data-review=first]").click()');
  await new Promise(resolve => setTimeout(resolve, 500));
  await assertPosition(animated, classic.frames[0]);
  console.log('Replay motion: both directions, placements, pushes, exits and upgrades; instant jumps; interrupted animation; reduced motion; keyboard navigation.');

} finally { ws?.close(); chrome.kill(); }
