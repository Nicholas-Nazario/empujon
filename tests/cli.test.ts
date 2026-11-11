import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createGame, type Game } from '../src/game.ts';
import { actingPlayer, applyAction, legalActions } from '../src/actions.ts';

function run(input: string, args = ['--json']) {
  const result = spawnSync(process.execPath,['--experimental-strip-types','bin/empujon.mjs',...args],{input,encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(result.status,0,result.stderr);
  return result.stdout;
}
function json(requests: unknown[]) {
  return run(requests.map(x=>JSON.stringify(x)).join('\n')+'\n').trim().split('\n').map(x=>JSON.parse(x));
}
test('JSON CLI uses the engine, echoes ids, and keeps state after errors',()=> {
  const responses = json([{type:'state',id:1},{type:'place',index:14,id:'move'},{type:'place',index:14},{type:'place',index:2,upgraded:'yes'},{type:'state'},{type:'undo'},{type:'reset',mode:'upgrade'}]);
  assert.equal(responses.length,7);
  assert.equal(responses[0].protocolVersion,1);
  assert.equal(responses[0].id,1);
  assert.deepEqual(responses[0].state,createGame('classic'));
  assert.equal(responses[0].legalActions.length,36);
  assert.equal(responses[1].id,'move');
  const next = applyAction(createGame('classic'),{type:'place',index:14});
  assert.deepEqual(responses[1].state,next);
  assert.equal(responses[1].actor,1);
  for (const i of [2,3]) { assert.equal(responses[i].ok,false); assert.deepEqual(responses[i].state,next); }
  assert.deepEqual(responses[4].state,next);
  assert.deepEqual(responses[5].state,createGame('classic'));
  assert.deepEqual(responses[6].state,createGame('upgrade'));
});
test('malformed JSON and invalid commands return parseable errors without exiting',()=> {
  const responses = run('broken\nnull\n[]\n{"type":"reset","mode":"bad"}\n{"type":"what"}\n{"type":"state"}\n').trim().split('\n').map(x=>JSON.parse(x));
  assert.equal(responses.length,6);
  assert.ok(responses.slice(0,5).every(x=>x.ok === false));
  assert.equal(responses[5].ok,true);
  assert.deepEqual(responses[5].state,createGame('classic'));
});
test('interactive CLI accepts coordinates, upgraded piece syntax, undo and quit',()=> {
  const output = run('C3\nundo\nnew upgrade\nplace D4 upgraded\nchoose 0\nquit\n',['--mode','classic']);
  assert.match(output,/Indigo's turn/);
  assert.match(output,/Upgrade/);
  assert.match(output,/Illegal placement/);
  assert.match(output,/Illegal choice/);
  assert.match(output,/0 moves/);
});
test('pending decisions expose the actual decision owner and only choice actions',()=> {
  const g = createGame('upgrade');
  g.turn = 0;
  g.choices = [{owner:1,kind:'line',options:[[0,1,2],[1,2,3]]}];
  for (const i of [0,1,2,3]) { g.board[i] = {owner:1,upgraded:false}; g.pools[1].pop(); }
  assert.equal(actingPlayer(g),1);
  assert.deepEqual(legalActions(g),[{type:'choose',option:0},{type:'choose',option:1}]);
  for (const input of [{type:'choose',option:-1},{type:'choose',option:0.5},{type:'place',index:35}]) assert.throws(()=>applyAction(g,input));
  assert.equal(applyAction(g,{type:'choose',option:1}).choices.length,0);
});
test('legal actions include each available piece type and no actions after a win',()=> {
  const g = createGame('upgrade'); g.pools[0][0].upgraded = true;
  assert.equal(legalActions(g).length,72);
  g.board[0] = g.pools[0].pop()!;
  assert.equal(legalActions(g).length,70);
  g.winner = 0;
  assert.deepEqual(legalActions(g),[]); assert.equal(actingPlayer(g),null);
});
test('CLI and direct engine produce identical trajectories in both modes',()=> {
  const requests: unknown[] = [], states: Game[] = [];
  let seed = 13;
  for (const mode of ['classic','upgrade'] as const) {
    let g = createGame(mode);
    requests.push({type:'reset',mode}); states.push(g);
    for (let step=0;step<160 && g.winner === null;step++) {
      const actions = legalActions(g);
      seed = (seed*1664525+1013904223) >>> 0;
      const action = actions[seed%actions.length];
      g = applyAction(g,action);
      requests.push(action); states.push(g);
    }
  }
  const responses = json(requests);
  assert.equal(responses.length,states.length);
  responses.forEach((r,i)=> {
    assert.equal(r.ok,true); assert.deepEqual(r.state,states[i]);
    assert.equal(r.actor,actingPlayer(states[i]));
    assert.equal(r.done,states[i].winner !== null);
    assert.deepEqual(r.legalActions,legalActions(states[i]));
  });
});
test('help and argument errors are available without entering the input loop',()=> {
  assert.match(run('', ['--help']),/JSON mode/);
  const result = spawnSync(process.execPath,['bin/empujon.mjs','--mode','invalid'],{encoding:'utf8'});
  assert.equal(result.status,1); assert.match(result.stderr,/classic or upgrade/);
});


test('agent actions prefer upgraded pieces by default but allow explicit base placements', () => {
  const g = createGame('upgrade');
  g.pools[0][0].upgraded = true;
  g.board[15] = {owner:1,upgraded:true};
  g.pools[1].pop();
  const preferred = applyAction(g,{type:'place',index:14});
  assert.equal(preferred.board[14]?.upgraded,true);
  assert.equal(preferred.board[16]?.owner,1);
  const base = applyAction(g,{type:'place',index:14,upgraded:false});
  assert.equal(base.board[14]?.upgraded,false);
  assert.equal(base.board[15]?.owner,1);
});
