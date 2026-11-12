import './style.css';
import { startApp } from './ui/app.ts';
import { renderIcon } from './ui/icons.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root: #app');

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let theme = 'system';
let toggle: HTMLButtonElement | null = null;
try {
  const saved = localStorage.getItem('empujon:theme');
  if (saved === 'light' || saved === 'dark') theme = saved;
} catch { /* Follow the system when storage is unavailable. */ }

function applyTheme() {
  const dark = theme === 'system' ? systemTheme.matches : theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (toggle) {
    toggle.setAttribute('aria-checked', String(dark));
    toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.innerHTML = renderIcon(dark ? 'moon' : 'sun');
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    // Resolve light-dark() to the active canvas color for browser chrome.
    meta.content = getComputedStyle(document.documentElement).backgroundColor;
  }
}
applyTheme();
startApp(root);
toggle = root.querySelector<HTMLButtonElement>('#theme')!;
applyTheme();
toggle.addEventListener('click', () => {
  theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('empujon:theme', theme); } catch { /* Retain the session choice. */ }
  applyTheme();
});
systemTheme.addEventListener('change', applyTheme);
