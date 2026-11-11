import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, place, chooseUpgrade, defaultPieceUpgraded, lines, type Game, type Mode, type Piece, type Player } from '../src/game.ts';
function setup(mode: Mode, entries: [number,Player,boolean?][], turn: Player = 0): Game {
  const g = createGame(mode); g.turn = turn;
  for (const [i,owner,upgraded = false] of entries) { g.board[i] = {owner,upgraded}; g.pools[owner].pop(); }
  return g;
}
function conserved(g: Game) {
  for (const p of [0,1]) assert.equal(g.board.filter(x=>x?.owner === p).length+g.pools[p].length,8);
}
test('starts with an empty board and eight pieces per player',()=> {
  const g = createGame('classic'); assert.equal(g.board.filter(Boolean).length,0); conserved(g);
  const next = place(g,14); assert.equal(next.board[14]?.owner,0); assert.equal(next.turn,1); assert.equal(g.board[14],null);
});
test('pushes both colors, including diagonal neighbors, one square',()=> {
  const g = setup('classic',[[8,1],[13,0],[21,1]]);
  const next = place(g,14); assert.equal(next.board[2]?.owner,1); assert.equal(next.board[12]?.owner,0); assert.equal(next.board[28]?.owner,1);
  for (const i of [8,13,21]) assert.equal(next.board[i],null); conserved(next);
});
test('a blocked piece stays put and never pushes a chain',()=> {
  const g = setup('classic',[[15,1],[16,0]]), next = place(g,14);
  assert.deepEqual(next.board[15],g.board[15]); assert.deepEqual(next.board[16],g.board[16]); assert.equal(next.board[17],null); conserved(next);
});
test('an edge push returns an upgraded piece intact to its owner',()=> {
  const g = setup('upgrade',[[0,1,true]]);
  g.pools[0][0].upgraded = true;
  const next = place(g,7,true);
  assert.equal(next.board[0],null); assert.ok(next.pools[1].some(x=>x.upgraded)); conserved(next);
});
test('rejects occupied squares, out of range moves and unavailable piece types',()=> {
  const g = setup('classic',[[14,0]]);
  for (const i of [14,-1,36,1.5]) assert.equal(place(g,i),g);
  assert.equal(place(g,10,true),g);
});
test('recognizes consecutive horizontal, vertical and diagonal lines without row wrap',()=> {
  for (const cells of [[0,1,2],[0,6,12],[0,7,14],[2,7,12]]) {
    const g = setup('classic',cells.map(i=>[i,0])); assert.equal(lines(g.board,0).length,1);
  }
  assert.equal(lines(setup('classic',[[4,0],[5,0],[6,0]]).board,0).length,0);
});
test('checks wins after pushing, not immediately after placement',()=> {
  const next = place(setup('classic',[[13,0],[15,0]]),14);
  assert.equal(next.winner,null); assert.equal(next.board[12]?.owner,0); assert.equal(next.board[16]?.owner,0);
});
test('a displaced piece can complete a winning line',()=> {
  const next = place(setup('classic',[[0,0],[1,0],[8,0]]),14);
  assert.equal(next.winner,0); assert.match(next.reason,/Three/);
});
test('the mover wins when both players form lines on one move',()=> {
  // The placement at C3 pushes C2 to C1 and E is untouched.
  const next = place(setup('classic',[[0,0],[1,0],[8,0],[24,1],[25,1],[26,1]]),14);
  assert.equal(lines(next.board,0).length,1); assert.equal(lines(next.board,1).length,1); assert.equal(next.winner,0);
});
test('the opponent can win through a push on the active player’s turn',()=> {
  const next = place(setup('classic',[[0,1],[1,1],[8,1]]),14); assert.equal(next.winner,1);
});
test('classic wins with all eight pieces remaining after pushes',()=> {
  const next = place(setup('classic',[[0,0],[2,0],[5,0],[12,0],[16,0],[25,0],[29,0]]),33);
  assert.equal(next.winner,0); assert.match(next.reason,/eight/); conserved(next);
});
test('base and mixed triples return to supply upgraded rather than winning',()=> {
  for (const upgraded of [false,true]) {
    const next = place(setup('upgrade',[[0,0,upgraded],[1,0],[8,0]]),14);
    assert.equal(next.winner,null); for (const i of [0,1,2]) assert.equal(next.board[i],null);
    assert.equal(next.pools[0].filter(x=>x.upgraded).length,3); assert.equal(next.turn,1); conserved(next);
  }
});
test('three upgraded pieces win before any exchange',()=> {
  const g = setup('upgrade',[[0,0,true],[1,0,true],[8,0,true]]);
  g.pools[0][0].upgraded = true;
  const next = place(g,14,true);
  assert.equal(next.winner,0); assert.equal(next.board[2]?.upgraded,true);
});
test('overlapping lines require choosing a triple; a move is blocked while choosing',()=> {
  const next = place(setup('upgrade',[[0,0],[1,0],[2,0],[3,0]]),35);
  assert.equal(next.choices.length,1); assert.equal(next.choices[0].options.length,2); assert.equal(place(next,30),next);
  const resolved = chooseUpgrade(next,0); assert.equal(resolved.choices.length,0); assert.equal(resolved.turn,1);
  assert.equal(resolved.board.filter(x=>x?.owner===0).length,2); assert.equal(resolved.pools[0].filter(x=>x.upgraded).length,3); conserved(resolved);
});
test('separate triples both return upgraded',()=> {
  const next = place(setup('upgrade',[[0,0],[1,0],[2,0],[24,0],[25,0],[26,0]]),35);
  assert.equal(next.pools[0].filter(x=>x.upgraded).length,6); assert.equal(next.choices.length,0); conserved(next);
});
test('eight mixed pieces prompt selection of a base piece only',()=> {
  const next = place(setup('upgrade',[[0,0,true],[2,0],[5,0],[12,0],[16,0],[25,0],[29,0]]),33);
  assert.equal(next.winner,null); assert.equal(next.choices[0].kind,'eight');
  assert.ok(!next.choices[0].options.some(x=>x.includes(0)));
  const resolved = chooseUpgrade(next,0); assert.equal(resolved.board.filter(Boolean).length,7); assert.equal(resolved.pools[0][0].upgraded,true); conserved(resolved);
});
test('eight upgraded pieces win',()=> {
  const g = setup('upgrade',[[0,0,true],[2,0,true],[5,0,true],[12,0,true],[16,0,true],[25,0,true],[29,0,true]]);
  g.pools[0][0].upgraded = true;
  const next = place(g,33,true); assert.equal(next.winner,0); assert.match(next.reason,/eight upgraded/);
});
test('random full games conserve supply and keep every move legal in both modes',()=> {
  let seed = 19;
  const rand = (max: number) => { seed = (seed*1664525+1013904223) >>> 0; return seed%max; };
  for (const mode of ['classic','upgrade'] as Mode[]) for (let trial=0;trial<20;trial++) {
    let g = createGame(mode);
    for (let move=0;move<300 && g.winner === null;move++) {
      if (g.choices.length) { g = chooseUpgrade(g,rand(g.choices[0].options.length)); }
      else { const empty = g.board.flatMap((p,i)=>p ? [] : [i]); const supply = g.pools[g.turn]; assert.ok(supply.length); g = place(g,empty[rand(empty.length)],supply[rand(supply.length)].upgraded); }
      conserved(g);
    }
  }
});

test('base pieces cannot push upgraded neighbors of either owner in any direction', () => {
  for (const owner of [0, 1] as const) {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const neighbor = (2+dr)*6+2+dc;
      const destination = (2+2*dr)*6+2+2*dc;
      const g = setup('upgrade', [[neighbor,owner,true]]);
      const next = place(g,14,false);
      assert.deepEqual(next.board[neighbor],g.board[neighbor]);
      assert.equal(next.board[destination],null);
      conserved(next);
    }
  }
});

test('strength prevents base pieces from pushing upgraded pieces off an edge', () => {
  for (const owner of [0, 1] as const) {
    const g = setup('upgrade', [[0,owner,true]]);
    const next = place(g,7,false);
    assert.deepEqual(next.board[0],g.board[0]);
    assert.equal(next.pools[owner].filter(p=>p.upgraded).length,0);
    conserved(next);
  }
});

test('upgraded pieces push either type and either owner, but occupied destinations still block', () => {
  for (const owner of [0, 1] as const) for (const upgraded of [false,true]) {
    const g = setup('upgrade', [[15,owner,upgraded]]);
    g.pools[0][0].upgraded = true;
    const next = place(g,14,true);
    assert.equal(next.board[15],null);
    assert.deepEqual(next.board[16],g.board[15]);
    conserved(next);
    const blocked = setup('upgrade', [[15,owner,upgraded],[16,(1-owner) as Player,false]]);
    blocked.pools[0][0].upgraded = true;
    assert.deepEqual(place(blocked,14,true).board[15],blocked.board[15]);
  }
});

test('upgraded is the default when available, with an explicit base override', () => {
  const g = setup('upgrade', [[15,1,true]]);
  assert.equal(defaultPieceUpgraded(g),false);
  g.pools[0][0].upgraded = true;
  assert.equal(defaultPieceUpgraded(g),true);
  const preferred = place(g,14);
  assert.equal(preferred.board[14]?.upgraded,true);
  assert.equal(preferred.board[16]?.upgraded,true);
  const overridden = place(g,14,false);
  assert.equal(overridden.board[14]?.upgraded,false);
  assert.equal(overridden.board[15]?.upgraded,true);
  assert.equal(g.board[14],null);
  assert.equal(defaultPieceUpgraded(createGame('classic')),false);
});
