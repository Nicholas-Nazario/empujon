import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { Sessions } from './sessions.ts';

const sessions = new Sessions(() => Date.now(), process.env.DATABASE_PATH ?? 'sessions.sqlite');
const dev = process.argv.includes('--dev');
const vite = dev ? await (await import('vite')).createServer({ server: { middlewareMode: true }, appType: 'spa' }) : null;
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) {
    if (vite) return vite.middlewares(req, res);
    try {
      const path = resolve('dist', '.' + decodeURIComponent(url.pathname));
      if (!path.startsWith(resolve('dist') + '/')) throw new Error();
      const content = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' }); res.end(content);
    } catch { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(await readFile('dist/index.html')); }
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  try {
    const match = url.pathname.match(/^\/api\/games\/([a-z0-9]{6})\/(join|events|move)$/i);
    if (req.method === 'GET' && match?.[2] === 'events') {
      const session = sessions.get(match[1]);
      sessions.seat(session, url.searchParams.get('token') ?? '');
      if (session.listeners.size >= 8) throw new Error('Too many open connections for this game.');
      res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      const send = () => {
        if (!sessions.games.has(session.code)) { res.write('event: expired\ndata: {}\n\n'); res.end(); }
        else res.write(`data: ${JSON.stringify(sessions.view(session))}\n\n`);
      };
      session.listeners.add(send); send();
      const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20000);
      req.on('close', () => { clearInterval(heartbeat); session.listeners.delete(send); });
      return;
    }
    if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) throw new Error('Request is too large.'); }
    const body = JSON.parse(raw || '{}');
    let result;
    if (url.pathname === '/api/games') result = sessions.create(body.mode, body.turnSeconds);
    else if (match?.[2] === 'join') result = sessions.join(match[1], body.token);
    else if (match?.[2] === 'move') result = sessions.move(match[1], body.token, body.revision, body.action);
    else { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
  } catch (error) {
    if (!res.headersSent) res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed.' }));
  }
});
const sweep = setInterval(() => sessions.sweep(), 1000);
sweep.unref();
const port = Number(process.env.PORT ?? (dev ? 5173 : 8080));
server.listen(port, dev ? '127.0.0.1' : '0.0.0.0', () => console.log(`Empujón listening on http://127.0.0.1:${port}`));
