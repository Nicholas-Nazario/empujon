# CLI and AI interface

The CLI imports `src/game.ts`, the same immutable TypeScript engine used by the website. `src/actions.ts` adds legal-action enumeration, acting-player lookup, and input validation. It contains no separate implementation of pushes, upgrades, or win rules. No new dependencies are required.

## Interactive play

```sh
npm run cli
npm run cli -- --mode upgrade
```

Enter coordinates such as `C3` (upgraded preferred when available), `place C3 base`, or `place C3 upgraded`. `choose 0` selects the first displayed upgrade option. `legal` lists available actions. `board`, `undo`, `new classic`, `new upgrade`, `help`, and `quit` are also available. CLI undo reverses one action, including an individual upgrade decision.

## Machine protocol (version 1)

Launch Node directly for clean stdout; `npm run` adds its own script banners.

```sh
node --experimental-strip-types bin/empujon.mjs --json --mode upgrade
```

Use a persistent child process with piped stdin and stdout. Send one JSON object followed by a newline, then read exactly one JSON line in reply. There is no startup response or prompt. Closing stdin exits; `quit` responds once then exits. Invalid requests return an error and leave the game unchanged; they do not terminate the process. Each process owns one game, so parallel workers can use independent processes.

### Requests

| Request | Behavior |
| --- | --- |
| `{"type":"state"}` | Inspect the current game. |
| `{"type":"legal"}` | Inspect the current game and legal actions. |
| `{"type":"reset","mode":"classic"}` | Start Classic; use `upgrade` for Upgrade. Omitted mode retains the current mode. |
| `{"type":"place","index":14,"upgraded":false}` | Place a base piece at C3. Omitted `upgraded` prefers an upgraded piece when available, otherwise a base piece. |
| `{"type":"choose","option":0}` | Resolve the first pending upgrade decision using its zero-based option index. |
| `{"type":"undo"}` | Reverse the most recent placement or upgrade decision. |
| `{"type":"quit"}` | Respond with the current state, then exit. |

An optional `id` is echoed in the response to associate requests and replies.

### Response fields

Every response, including errors, contains:

| Field | Meaning |
| --- | --- |
| `protocolVersion` | Currently `1`. |
| `ok` | Whether the request succeeded. |
| `error` | Human-readable explanation, present on failure. |
| `id` | Echoed when supplied. |
| `state` | Full shared-engine `Game` object. |
| `actor` | Player `0` or `1` who must act next; `null` after a win. |
| `legalActions` | Valid place or choose objects, ready to send as requests. Empty after a win. |
| `done` | Whether the game has a winner. |

Players are `0` (Terracotta) and `1` (Adoquín). `state.board` is a row-major array of 36 cells; each cell is `null` or `{"owner":0,"upgraded":false}`. A1 is index 0, F1 is 5, A6 is 30, and F6 is 35. `state.pools` contains each player's off-board pieces. `state.winner` is `null`, `0`, or `1`; `state.reason` explains the win.

**Use `actor` to select the agent**, rather than alternating players yourself or assuming `state.turn` always owns the next decision. An upgrade choice can belong to the other player. `state.choices[0].options` lists the board-cell indices for each available choice. Automatically resolved upgrades are already reflected in the returned state.

There is no imposed draw or move limit. Training runners should impose their own episode limit. There is no training reward scheme in the CLI; compute rewards from the winner and your chosen training objective.

### Minimal Python self-play example

Run from the project root. This exercises the protocol with random legal actions, without any training dependencies.

```python
import json
import random
import subprocess

with subprocess.Popen(
    ["node", "--experimental-strip-types", "bin/empujon.mjs", "--json"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1,
) as game:
    def send(command):
        game.stdin.write(json.dumps(command) + "\n")
        game.stdin.flush()
        response = json.loads(game.stdout.readline())
        if not response["ok"]:
            raise RuntimeError(response["error"])
        return response

    result = send({"type": "reset", "mode": "upgrade"})
    for _ in range(1000):
        if result["done"]:
            break
        # Replace this selection with the policy for result["actor"].
        result = send(random.choice(result["legalActions"]))
    print("Winner:", result["state"]["winner"], "Done:", result["done"])
    send({"type": "quit"})
```

## Direct TypeScript usage

For search algorithms or large-scale TypeScript self-play, avoid subprocess and JSON overhead by importing the same API directly:

```ts
import { createGame } from './src/game.ts';
import { actingPlayer, legalActions, applyAction } from './src/actions.ts';

const state = createGame('upgrade');
const player = actingPlayer(state);
const actions = legalActions(state);
const next = applyAction(state, actions[0]);
// state is unchanged; next is an independent resulting state.
```

The engine has no random state; a starting state and action sequence produce deterministic results. Legal actions include both base and upgraded placements where both types are available. `applyAction` rejects illegal input with an exception. Policy design, rewards, replay storage, and model training belong to the separate AI workstream.

In Upgrade mode, base pieces cannot push upgraded pieces, including off the board. Upgraded pieces can push either type. This strength rule applies to both owners and all eight directions. Explicit `upgraded: false` still selects a base piece, even when upgraded pieces are available.
