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
  await evaluate(`(async () => {
    const {createBoardInformation} = await import('/src/ui/components/board-information.ts');
    const {renderBoard} = await import('/src/ui/components/board.ts');
    const {renderPlayers} = await import('/src/ui/components/players.ts');
    const {createGame} = await import('/src/game.ts');
    const {applyAction} = await import('/src/actions.ts');
    const {beginnerAction} = await import('/src/ai.ts');
    const {previewMovement} = await import('/src/game.ts');
    const random = Math.random;
    let seed=1;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/2**32;};
    let game=createGame('upgrade');
    const frames=[game];
    try { while(game.winner===null && frames.length<200) { game=applyAction(game,beginnerAction(game)); frames.push(game); } }
    finally { Math.random=random; }
    const initial=createGame('classic');
    const pending=frames.find(frame=>frame.choices.length);
    const moved=frames.find(frame=>frame.lastMovement?.pushes.length>2) ?? frames[4];
    const base={game:initial,computer:null,review:null,upgrade:null,preview:null,touchPreview:false,online:null};
    window.informationCases=[
      ['opening',base],
      ['move',{...base,game:moved}],
      ['preview',{...base,preview:previewMovement(initial,14)}],
      ['touch',{...base,preview:previewMovement(initial,14),touchPreview:true}],
      ['upgrade',{...base,game:pending,upgrade:{selected:null}}],
      ['ready',{...base,game:pending,upgrade:{selected:0}}],
      ['thinking',{...base,game:frames[1],computer:'beginner'}],
      ['waiting',{...base,online:{title:'Waiting for opponent',status:'Waiting for your opponent to join…',yourTurn:false}}],
      ['sending',{...base,online:{title:'Your turn',status:'Sending your move…',yourTurn:true}}],
      ['disconnected',{...base,online:{title:'Opponent’s turn',status:'Connection interrupted. Reconnecting…',yourTurn:false}}],
      ['win',{...base,game}],
      ['review-start',{...base,review:{index:0,total:frames.length}}],
      ['review-choice',{...base,game:pending,review:{index:frames.indexOf(pending),total:frames.length}}],
      ['review-final',{...base,game,review:{index:frames.length-1,total:frames.length}}],
    ];
    const panel=createBoardInformation(document.querySelector('.board-heading'));
    window.showInformationCase=index=>{
      const [name,state]=window.informationCases[index];
      panel.render(state);
      document.querySelector('#board').innerHTML=renderBoard(state.game,false,true);
      document.querySelector('#players').innerHTML=renderPlayers(state.game,state.game.winner??state.game.turn,false,state.computer,!!state.review);
      return name;
    };
    await document.fonts.ready;
  })()`);
  for (const theme of ['light','dark']) {
    await evaluate(`if(document.documentElement.dataset.theme!=='${theme}') document.querySelector('#theme').click()`);
    for (const width of [1440,768,390,320]) {
      await cmd('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<700});
      await wait(100);
      let boardTop;
      const count=await evaluate('window.informationCases.length');
      for (let index=0;index<count;index++) {
        const name=await evaluate(`window.showInformationCase(${index})`);
        const bounds=await evaluate(`(() => {
          const panel=document.querySelector('.board-heading').getBoundingClientRect();
          const board=document.querySelector('#board').getBoundingClientRect();
          const buttons=[...document.querySelectorAll('.information-actions button')].map(button=>button.getBoundingClientRect()).filter(rect=>rect.width>0);
          return {top:board.top,height:panel.height,overflow:document.documentElement.scrollWidth>innerWidth,contained:buttons.every(rect=>rect.top>=panel.top && rect.bottom<=panel.bottom && rect.left>=panel.left && rect.right<=panel.right)};
        })()`);
        boardTop ??= bounds.top;
        assert.equal(bounds.top,boardTop,`${theme} ${width} ${name} shifts the board`);
        assert.equal(bounds.overflow,false,`${theme} ${width} ${name} overflow`);
        assert.equal(bounds.contained,true,`${theme} ${width} ${name} actions clip`);
        if (['opening','ready','review-final','touch'].includes(name)) {
          const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
          await writeFile(`${tmpdir()}/empujon-information-${name}-${theme}-${width}.png`,Buffer.from(shot.data,'base64'));
        }
      }
    }
  }
  console.log('Board information passed: 14 play/preview/upgrade/CPU/online/result/review states keep the board in place, with contained actions in both themes at 1440/768/390/320px.');
} finally { ws?.close(); chrome.kill(); }
