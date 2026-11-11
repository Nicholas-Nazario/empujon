#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { createGame, names } from '../src/game.ts';
import { actingPlayer, applyAction, legalActions } from '../src/actions.ts';

const help = `Empujón — two players, one terminal

Usage: npm run cli -- [--mode classic|upgrade] [--json]
       node bin/empujon.mjs [--mode classic|upgrade] [--json]

Interactive commands:
  C3                  Place at C3 (upgraded preferred)
  place C3 upgraded   Place an upgraded piece (or use base)
  choose 0            Select an upgrade option (zero-based)
  legal               List legal actions
  board               Show the board
  undo                Undo the last action (placement or upgrade decision)
  new classic         Start a new Classic game (or: new upgrade)
  help                Show this help
  quit                Exit

JSON mode: one request per stdin line, one response per stdout line.
  {"type":"state"}
  {"type":"reset","mode":"upgrade"}
  {"type":"place","index":14,"upgraded":false}
  {"type":"choose","option":0}
  {"type":"legal"}
  {"type":"quit"}
Every response includes protocolVersion, state, actor, legalActions, and done.
Optional request id is echoed. No startup output in JSON mode.
`;
const args = process.argv.slice(2);
let mode = 'classic', json = false;
try {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') { console.log(help); process.exit(0); }
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--mode') {
      mode = args[++i];
      if (!['classic', 'upgrade'].includes(mode)) throw new Error('--mode must be classic or upgrade.');
    } else throw new Error(`Unknown argument: ${args[i]}`);
  }
} catch (error) { console.error(error.message); process.exit(1); }
let game = createGame(mode);
let history = [];
const coordinate = index => `${'ABCDEF'[index % 6]}${Math.floor(index / 6) + 1}`;
const view = () => ({ protocolVersion: 1, state: game, actor: actingPlayer(game), legalActions: legalActions(game), done: game.winner !== null });
function execute(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Expected a JSON object.');
  switch (request.type) {
    case 'state': case 'legal': return;
    case 'reset': {
      const nextMode = request.mode ?? game.mode;
      if (!['classic', 'upgrade'].includes(nextMode)) throw new Error('mode must be classic or upgrade.');
      game = createGame(nextMode); history = []; return;
    }
    case 'place': case 'choose': {
      const next = applyAction(game, request); history.push(game); game = next; return;
    }
    case 'undo':
      if (!history.length) throw new Error('Nothing to undo.');
      game = history.pop(); return;
    case 'quit': return;
    default: throw new Error('Unknown command. Use state, legal, reset, place, choose, undo, or quit.');
  }
}
function draw() {
  console.log(`\nEmpujón · ${game.mode === 'classic' ? 'Classic' : 'Upgrade'} · ${game.moves} moves\n`);
  console.log('    A B C D E F');
  for (let row=0; row<6; row++) {
    console.log(` ${row+1}  ${game.board.slice(row*6,row*6+6).map(p => !p ? '·' : p.owner === 0 ? (p.upgraded ? 'X' : 'x') : (p.upgraded ? 'O' : 'o')).join(' ')}`);
  }
  console.log('\nx / X = Terracotta · o / O = Adoquín · uppercase = upgraded');
  for (const p of [0,1]) {
    const supply = game.pools[p];
    console.log(`${names[p]} supply: ${supply.filter(x=>!x.upgraded).length} base, ${supply.filter(x=>x.upgraded).length} upgraded`);
  }
  console.log(`\n${game.message}`);
  if (game.choices.length) {
    console.log(`Decision belongs to ${names[actingPlayer(game)]}:`);
    game.choices[0].options.forEach((cells,i) => console.log(`  choose ${i}: ${cells.map(coordinate).join(', ')}`));
  }
}
function parseText(text) {
  const parts = text.trim().toLowerCase().split(/\s+/);
  if (/^[a-f][1-6]$/.test(parts[0])) parts.unshift('place');
  const [command, arg, piece] = parts;
  if (command === 'place') {
    if (parts.length > 3 || !/^[a-f][1-6]$/.test(arg ?? '') || (piece && !['base','upgraded'].includes(piece))) throw new Error('Use: place C3 [base|upgraded]');
    return {type:'place', index:(Number(arg[1])-1)*6 + arg.charCodeAt(0)-97, ...(piece ? {upgraded:piece === 'upgraded'} : {})};
  }
  if (command === 'choose') {
    if (parts.length !== 2 || !/^\d+$/.test(arg ?? '')) throw new Error('Use: choose 0');
    return {type:'choose',option:Number(arg)};
  }
  if (command === 'new') {
    if (parts.length > 2) throw new Error('Use: new classic or new upgrade');
    return {type:'reset',mode:arg ?? game.mode};
  }
  if (parts.length !== 1) throw new Error('Unexpected command arguments. Type help.');
  return {type:command === 'board' ? 'state' : command};
}
if (!json) { console.log('Type a square (C3) to play, or help for commands.'); draw(); }
const rl = createInterface({input:process.stdin, crlfDelay:Infinity});
const prompt = () => { if (!json && process.stdin.isTTY) process.stdout.write('\nempujón> '); };
prompt();
for await (const line of rl) {
  if (!line.trim() && !json) { prompt(); continue; }
  let request;
  try {
    request = json ? JSON.parse(line) : parseText(line);
    if (!json && request.type === 'help') console.log(help);
    else {
      execute(request);
      if (json) console.log(JSON.stringify({ok:true,...(Object.hasOwn(request,'id') ? {id:request.id} : {}),...view()}));
      else if (request.type === 'legal') console.log(legalActions(game).map(a => a.type === 'place' ? `${coordinate(a.index)}${a.upgraded ? ' upgraded' : ' base'}` : `choose ${a.option}`).join('\n') || 'Game over. No legal actions.');
      else if (request.type !== 'quit') draw();
    }
    if (request.type === 'quit') { rl.close(); break; }
  } catch (error) {
    if (json) console.log(JSON.stringify({ok:false,...(request && typeof request === 'object' && Object.hasOwn(request,'id') ? {id:request.id} : {}),error:error.message,...view()}));
    else console.log(`Error: ${error.message}`);
  }
  prompt();
}
