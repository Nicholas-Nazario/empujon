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
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:baseUrl});
  for(let i=0;i<100;i++) { if(await evaluate('!!document.querySelector("[data-cell]")')) break; await new Promise(r=>setTimeout(r,100)); }
  assert.equal(await evaluate('document.querySelectorAll("[data-cell]").length'),36);
  await evaluate('document.querySelectorAll("[data-cell]")[14].click()');
  assert.match(await evaluate('document.querySelector("#turn-title").textContent'),/Adoquín/);
  assert.equal(await evaluate('document.querySelectorAll("#board .piece:not(.ghost .piece)").length'),1);
  await evaluate('document.querySelector("#undo").click()');
  assert.match(await evaluate('document.querySelector("#turn-title").textContent'),/Terracotta/);
  await evaluate('document.querySelector("[data-mode=upgrade]").click()');
  assert.equal(await evaluate('document.querySelector("#board-mode").textContent'),'UPGRADE');
  assert.ok(await evaluate('!!document.querySelector("[data-piece=base]")'));
  await evaluate('document.querySelector("#rules-open").click()');
  assert.ok(await evaluate('document.querySelector("#rules").open'));
  await evaluate('document.querySelector("#rules-close").click()');
  await evaluate('document.querySelectorAll("[data-cell]")[14].click(); document.querySelector("#restart").click()');
  assert.ok(await evaluate('document.querySelector("#new-game").open'));
  await evaluate('document.querySelector("#cancel-new").click()');
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'),'MOVE 02');
  await evaluate('document.querySelector("#restart").click(); document.querySelector("#confirm-new").click()');
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'),'MOVE 01');
  // Modal confirmation must preserve the selected target mode across cancel/retry.
  await evaluate('document.querySelectorAll("[data-cell]")[14].click(); document.querySelector("[data-mode=classic]").click()');
  assert.ok(await evaluate('document.querySelector("#new-game").open'));
  await evaluate('document.querySelector("#cancel-new").click()');
  assert.equal(await evaluate('document.querySelector("#board-mode").textContent'),'UPGRADE');
  await evaluate('document.querySelector("[data-mode=classic]").click(); document.querySelector("#confirm-new").click()');
  assert.equal(await evaluate('document.querySelector("#board-mode").textContent'),'CLASSIC');
  await evaluate('document.querySelector("#sound").click()');
  assert.equal(await evaluate('document.querySelector("#sound").getAttribute("aria-pressed")'),'true');
  await evaluate('document.querySelector("#sound").click()');
  assert.equal(await evaluate('document.querySelector("#sound").getAttribute("aria-pressed")'),'false');
  // Reach an earned-upgrade position through real gameplay, then check selection.
  // Fixed replay fixture uses only the game engine, independently of the CLI API.
  const path = [{"type": "place", "index": 0, "upgraded": false}, {"type": "place", "index": 35, "upgraded": false}, {"type": "place", "index": 31, "upgraded": false}, {"type": "place", "index": 9, "upgraded": false}, {"type": "place", "index": 22, "upgraded": false}, {"type": "place", "index": 30, "upgraded": false}, {"type": "place", "index": 3, "upgraded": false}, {"type": "place", "index": 5, "upgraded": false}, {"type": "place", "index": 20, "upgraded": false}, {"type": "place", "index": 34, "upgraded": false}, {"type": "place", "index": 14, "upgraded": false}, {"type": "place", "index": 18, "upgraded": false}, {"type": "place", "index": 7, "upgraded": false}, {"type": "place", "index": 9, "upgraded": false}, {"type": "place", "index": 35, "upgraded": false}, {"type": "place", "index": 6, "upgraded": false}, {"type": "place", "index": 23, "upgraded": false}, {"type": "place", "index": 28, "upgraded": false}];
  let trainingState = createGame('upgrade');
  for (const action of path) {
    trainingState = action.type === 'choose'
      ? chooseUpgrade(trainingState, action.option)
      : place(trainingState, action.index, action.upgraded);
  }
  assert.ok(trainingState.pools[trainingState.turn].some(p => p.upgraded));
  await evaluate('document.querySelector("[data-mode=upgrade]").click()');
  await evaluate(`(() => {
    for (const action of ${JSON.stringify(path)}) {
      if (action.type === 'choose') {
        document.querySelectorAll('[data-choice]')[action.option].click();
      } else {
        document.querySelector('[data-piece=' + (action.upgraded ? 'upgraded' : 'base') + ']').click();
        document.querySelectorAll('[data-cell]')[action.index].click();
      }
    }
  })()`);
  assert.equal(await evaluate('document.querySelector("[data-piece=upgraded]").classList.contains("chosen")'),true);
  await evaluate('document.querySelector("[data-piece=base]").click()');
  assert.equal(await evaluate('document.querySelector("[data-piece=base]").classList.contains("chosen")'),true);
  const firstEmpty = trainingState.board.findIndex(p => !p);
  await evaluate(`document.querySelectorAll('[data-cell]')[${firstEmpty}].click()`);
  assert.equal(await evaluate(`!!document.querySelectorAll('[data-cell]')[${firstEmpty}].querySelector('.piece:not(.upgraded)')`),true);
  await evaluate('document.querySelector("#undo").click()');
  assert.equal(await evaluate('document.querySelector("[data-piece=upgraded]").classList.contains("chosen")'),true);
  await evaluate(`document.querySelectorAll('[data-cell]')[${firstEmpty}].click()`);
  assert.equal(await evaluate(`!!document.querySelectorAll('[data-cell]')[${firstEmpty}].querySelector('.piece.upgraded')`),true);
  console.log('Upgrade selection: defaults to upgraded, honors base override, restores default after undo.');
  await evaluate('document.querySelector("[data-mode=classic]").click(); document.querySelector("#confirm-new").click()');
  // Classic Beginner: lock input, undo a whole turn, cancel pending replies,
  // confirm/cancel opponent changes, and preserve Beginner when changing rules.
  await evaluate('document.querySelector("[data-opponent=beginner]").click(); document.querySelector("#confirm-new").click()');
  assert.equal(await evaluate('document.querySelector("#board-mode").textContent'), 'CLASSIC');
  assert.match(await evaluate('document.querySelector("#players").textContent'), /BEGINNER AI/);
  await evaluate('document.querySelectorAll("[data-cell]")[14].click()');
  assert.equal(await evaluate('document.querySelectorAll("[data-cell]:not(:disabled)").length'), 0);
  await evaluate('document.querySelector("#undo").click()');
  await new Promise(r => setTimeout(r, 550));
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'), 'MOVE 01');
  await evaluate('document.querySelectorAll("[data-cell]")[14].click()');
  await new Promise(r => setTimeout(r, 550));
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'), 'MOVE 03');
  assert.match(await evaluate('document.querySelector("#turn-title").textContent'), /Terracotta/);
  await evaluate('document.querySelector("#undo").click()');
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'), 'MOVE 01');
  await evaluate('document.querySelectorAll("[data-cell]")[14].click(); document.querySelector("[data-opponent=local]").click(); document.querySelector("#cancel-new").click()');
  assert.equal(await evaluate('document.querySelector("[data-opponent=beginner]").getAttribute("aria-pressed")'), 'true');
  await evaluate('document.querySelector("[data-mode=upgrade]").click(); document.querySelector("#confirm-new").click()');
  await new Promise(r => setTimeout(r, 550));
  assert.equal(await evaluate('document.querySelector("#move-count").textContent'), 'MOVE 01');
  assert.equal(await evaluate('document.querySelector("[data-opponent=beginner]").getAttribute("aria-pressed")'), 'true');
  await evaluate('document.querySelector("[data-opponent=beginner]").click()');
  console.log('Beginner: automatic replies, input lock, full-turn undo, timer cancellation, opponent selection.');
  const upgradePlay = await evaluate(`(async () => {
    const { createGame } = await import('/src/game.ts');
    const { actingPlayer, applyAction } = await import('/src/actions.ts');
    const { beginnerAction } = await import('/src/ai.ts');
    const originalRandom = Math.random;
    const originalTimeout = window.setTimeout;
    let actualSeed = 37, expectedSeed = 37, humanSeed = 87;
    const nextRandom = seed => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    Math.random = () => ((actualSeed = nextRandom(actualSeed)) / 2 ** 32);
    const expectedRandom = () => ((expectedSeed = nextRandom(expectedSeed)) / 2 ** 32);
    const humanRandom = () => ((humanSeed = nextRandom(humanSeed)) / 2 ** 32);
    window.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 400 ? 0 : delay, ...args);
    const wait = () => new Promise(resolve => originalTimeout(resolve, 10));
    let humanChoices = 0, computerChoices = 0, crossTurnChoices = 0, upgradedPlacements = 0;
    try {
      for (let run = 0; run < 3; run++) {
        document.querySelector('#restart').click();
        if (document.querySelector('#new-game').open) document.querySelector('#confirm-new').click();
        let game = createGame('upgrade');
        for (let step = 0; step < 1000 && game.winner === null; step++) {
          const actor = actingPlayer(game);
          const action = beginnerAction(game, actor === 1 ? expectedRandom : humanRandom);
          if (action.type === 'choose') {
            if (actor === 1) computerChoices++; else humanChoices++;
            if (actor !== game.turn) crossTurnChoices++;
          } else if (action.upgraded) upgradedPlacements++;
          if (actor === 0) {
            if (action.type === 'choose') {
              const button = document.querySelector('[data-choice="' + action.option + '"]');
              if (!button || button.disabled) throw new Error('Human reward choice unavailable');
              button.click();
            } else {
              const picker = document.querySelector('[data-piece=' + (action.upgraded ? 'upgraded' : 'base') + ']');
              if (!picker || picker.disabled) throw new Error('Human piece picker unavailable');
              picker.click();
              document.querySelectorAll('[data-cell]')[action.index].click();
            }
          } else {
            if (document.querySelectorAll('[data-choice]:not(:disabled), [data-piece]').length) {
              throw new Error('Computer controls exposed to human');
            }
          }
          game = applyAction(game, action);
          // Wait until the board and decision state reflect the action. A computer
          // reward may schedule its next placement immediately afterward.
          if (actor === 1) await wait();
          // Let consecutive AI decisions settle before comparing the UI.
          while (actingPlayer(game) === 1) {
            const reply = beginnerAction(game, expectedRandom);
            if (reply.type === 'choose') {
              computerChoices++;
              if (game.turn !== 1) crossTurnChoices++;
            } else if (reply.upgraded) upgradedPlacements++;
            game = applyAction(game, reply);
          }
          if (actualSeed !== expectedSeed) {
            for (let retry = 0; retry < 100 && actualSeed !== expectedSeed; retry++) await wait();
          }
          if (actualSeed !== expectedSeed) throw new Error('Computer did not resolve pending actions');
          const cells = Array.from(document.querySelectorAll('[data-cell]')).map(cell => {
            const piece = cell.querySelector(':scope > .piece');
            return piece ? { owner: piece.classList.contains('p0') ? 0 : 1, upgraded: piece.classList.contains('upgraded') } : null;
          });
          if (JSON.stringify(cells) !== JSON.stringify(game.board)) throw new Error('UI differs from shared engine');
        }
        if (game.winner === null) throw new Error('Upgrade game did not finish');
      }
      return { humanChoices, computerChoices, crossTurnChoices, upgradedPlacements };
    } finally {
      Math.random = originalRandom;
      window.setTimeout = originalTimeout;
    }
  })()`);
  assert.ok(upgradePlay.humanChoices > 0, JSON.stringify(upgradePlay));
  assert.ok(upgradePlay.computerChoices > 0, JSON.stringify(upgradePlay));
  assert.ok(upgradePlay.crossTurnChoices > 0, JSON.stringify(upgradePlay));
  assert.ok(upgradePlay.upgradedPlacements > 0, JSON.stringify(upgradePlay));
  console.log('Upgrade Beginner: three complete games match engine, including human/computer rewards and cross-turn choices.', upgradePlay);

  for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,740],['tablet',768,1024]]) {
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
    await new Promise(r=>setTimeout(r,250));
    const layout = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,board:document.querySelector("#board").getBoundingClientRect().toJSON()})');
    assert.ok(layout.scroll<=width,`${label} overflows: ${JSON.stringify(layout)}`);
    assert.ok(Math.abs(layout.board.width-layout.board.height)<2);
    const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(`${tmpdir()}/empujon-${label}-verified.png`,Buffer.from(shot.data,'base64'));
    console.log(`${label}: no horizontal overflow, square board (${Math.round(layout.board.width)}px)`);
  }
  console.log('Browser checks passed: placement, turns, undo, mode selection, rules dialog, restart/cancel, responsive layouts.');
} finally { ws?.close(); chrome.kill(); }
