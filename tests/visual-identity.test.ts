import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const identity = readFileSync(new URL('../src/visual-identity.css', import.meta.url), 'utf8');
const components = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('visual identity tokens have one definition and component references resolve', () => {
  const definitions = [...identity.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]);
  assert.equal(new Set(definitions).size, definitions.length, 'Identity tokens must not be redefined');
  // Root tokens cannot resolve player variables defined only on descendants.
  assert.doesNotMatch(identity, /var\(--(?:player|tint)\)/);
  const contextual = new Set(['--player', '--tint']);
  for (const match of components.matchAll(/(--[\w-]+)\s*:/g)) {
    assert.ok(contextual.has(match[1]), `Define ${match[1]} in visual-identity.css`);
  }
  const known = new Set([...definitions, ...contextual]);
  for (const match of (identity + components).matchAll(/var\((--[\w-]+)/g)) {
    assert.ok(known.has(match[1]), `Undefined visual token: ${match[1]}`);
  }
  for (const player of ['terracotta', 'adoquin']) {
    assert.ok(known.has(`--${player}`));
    assert.ok(components.includes(`var(--${player})`));
  }
});

test('component colors and font families come from the visual identity', () => {
  assert.doesNotMatch(components, /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i);
  for (const match of components.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
    assert.match(match[1], /^var\(--font-[\w-]+\)$/);
  }
  for (const match of components.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
    assert.match(match[1], /^var\(--font-size-[\w-]+\)$/);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /name="theme-color"[^>]*content=/);
});
