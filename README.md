# Empujón

A two-player abstract strategy game inspired by the mechanics of Scott Brady’s Gekitai and Gekitai 2, with original presentation.

Play together on one device, invite a friend online, or choose a **computer difficulty** to play the computer. Choose **Classic** or **Upgrade**, place pieces, and push neighboring pieces to change the board.

## License and branding

Noncommercial contributions, forks, and remixes are welcome. Original code uses
PolyForm Noncommercial 1.0.0; original artwork and written content use
CC BY-NC-SA 4.0. Commercial uses outside those licenses' express permissions
require separate permission. This is a source-available project.

Forks and adaptations must use distinct product branding; factual attribution
such as “Based on Empujón” is welcome. The name and any project logo are reserved
for the official project, subject to the permissions in the branding policy.

See [licensing and scope](LICENSE.md), the [full license texts](LICENSES/), and
the [branding policy](BRANDING.md).

## Development

Requires Node.js 24 (uses built-in SQLite and TypeScript support).

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The development server serves both the UI and multiplayer API.

```sh
npm test       # Rules engine tests, including randomized games
npm run build # Type checking and production build into dist/
npm start     # Serve the production build and multiplayer API on port 8080
```

Optional browser checks, with the dev server running:

```sh
node scripts/browser-check.mjs
node scripts/online-browser-check.mjs
```

The browser script uses installed Google Chrome on macOS or `google-chrome` on Linux. Override `CHROME_PATH` or `GAME_URL` if needed. It exercises gameplay controls and checks desktop, tablet, and 320px/390px mobile layouts. Screenshots are written to the system temporary directory.

## Deploy to Fly.io

The Dockerfile builds the website and serves it with the Node.js multiplayer server
on port 8080. SQLite stores sessions on a 1 GB Fly volume mounted at `/data`.
Use **one Machine in one region**: live connections and updates are coordinated
in that process. Do not scale to multiple Machines without adding shared event delivery.
The volume incurs Fly's storage charges; check your account's billing allowances.

Install the [Fly CLI](https://fly.io/docs/flyctl/install/), then:

1. Run `fly auth login`.
2. Choose a globally unique app name and set `app` in `fly.toml` to that name.
3. Run `fly apps create YOUR_APP_NAME` (use the same name).
4. Run `fly volumes create game_data --region ewr --size 1`.
5. Run `fly deploy --ha=false` to deploy a single Machine.
6. Run `fly open` to play.

For subsequent updates, run `fly deploy`. The configuration uses the Newark
region (`ewr`), enforces HTTPS, and lets the Machine stop when idle and start
when a request arrives. Change `primary_region` if you prefer another region.

To try the production container locally:

```sh
docker build -t empujon .
docker run --rm -p 8080:8080 -e DATABASE_PATH=/data/sessions.sqlite -v empujon-data:/data empujon
```

Open <http://localhost:8080>.

## Online play

Select **Play online with a friend**, choose Classic or Upgrade and a turn limit
in the setup dialog, then select **Start online game**. Your color is random.
The invite dialog shows your link; **Copy link & continue** copies it and closes
the dialog. Copy it again directly from the Invite a friend section, which shows a link preview. The first friend to
open the link gets the other color. A persistent online banner identifies your
seat and says when you are waiting for your opponent. The board heading,
highlight, and tab title also indicate your turn. Clicking a square submits the move immediately; upgrade decisions
are submitted separately. Live updates use server-sent events and reconnect automatically.

No accounts are required. Invite codes are six alphanumeric characters.
A browser stores its seat locally so reloading restores the same color.
Other browsers cannot claim occupied seats. Anyone with an unused invite can
join, so share it directly with your friend. Online undo and rule changes are disabled.

The turn clock starts when the friend joins. Running out of time forfeits the
game; reconnecting does not reset the clock. Each session expires two hours
from creation, including finished games. Expired records are deleted automatically.
SQLite preserves active games, seats, and deadlines across server restarts.
Set `DATABASE_PATH` to choose the database location (default: `sessions.sqlite`).

## Stack and structure

TypeScript, Vite, and responsive CSS, with no runtime framework or game library. Google Fonts provides optional typography; system fonts are the fallback.

- `src/game.ts`: immutable, DOM-independent rules engine. No transport or UI dependencies, so future networking can reuse it.
- `src/main.ts`: application entry point.
- `src/ui/app.ts`: local and online session state and game actions.
- `server/`: HTTP/SSE transport and SQLite-backed session lifecycle.
- `tests/online.test.ts`: seats, turn enforcement, clocks, expiry, and restart persistence.
- `src/ui/templates/`: readable HTML for the screen layout and dialogs.
- `src/ui/layout.ts`: mounts templates and resolves named, typed element references.
- `src/ui/view.ts` and `src/ui/components/`: presentation updates and focused board/player renderers.
- `src/ui/events.ts`: click and preview event bindings, installed once.
- `src/ui/modals.ts`: rules and new-game dialog behavior.
- `src/ui/sound.ts`: optional move audio.
- `src/style.css`: desktop, tablet, and mobile layouts, keyboard focus, and reduced-motion support.
- `tests/game.test.ts`: pushes, blocking, edge returns, win precedence, upgrade rewards, and piece conservation.

## Rules decisions

Every move resolves all adjacent pushes before checking wins. The moving player has priority if both players win. A pushed piece never causes another push. Upgrades persist when a piece leaves the board.

In Upgrade mode, upgraded pieces are selected by default when available; players can explicitly choose base pieces. Base pieces cannot push upgraded pieces, including off an edge. Upgraded pieces can push either type, regardless of owner.

Base or mixed triples return to supply upgraded. Connected, overlapping triples offer a choice of one triple; disconnected triples resolve separately. Eight pieces on the board without a triple let the player choose one base piece to return upgraded. A triple takes precedence over the eight-piece reward, because resolving it removes pieces from the board. This precedence makes explicit an edge case not ordered in the supplied rules sheet.

Three upgraded pieces in a line, or all eight upgraded pieces on the board, win before any upgrade exchange. Undo restores the entire previous turn, including any upgrade choices.

## Terminal play and AI integration

```sh
npm run cli                         # Interactive Classic
npm run cli -- --mode upgrade       # Interactive Upgrade
node bin/empujon.mjs --json          # JSON Lines API for agent processes
```

The CLI reuses the website's TypeScript rules engine. For AI integrations, every response exposes the full state, the actual decision owner, and all legal actions. TypeScript agents can also import the engine directly without subprocess overhead. See [CLI and AI interface](docs/cli.md) for commands, protocol details, and a Python self-play example.

## Computer opponents

Select **Beginner**, **Intermediate**, or **Advanced** under **Who’s across the board?**.
You play Terracotta and move first; the computer plays Adoquín. All difficulties
support Classic and Upgrade, including both piece types and upgrade reward choices.

- **Beginner** takes immediate wins and varies among promising moves, valuing board presence, open pairs, and upgrades.
- **Intermediate** looks ahead to your reply to defend against immediate threats.
- **Advanced** searches up to one further placement to plan ahead.

The stronger difficulties use bounded minimax search and keep the last fully
completed search when their work limit is reached. Search runs in a worker to
keep the board responsive. Undo takes back your placement and the computer reply
together. Switching opponents starts a new game, with confirmation if play has begun.
The policies live in `src/ai.ts` and reuse the shared engine and legal actions.
