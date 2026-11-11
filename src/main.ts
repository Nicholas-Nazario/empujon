import './style.css';
import { startApp } from './ui/app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root: #app');

// Keep browser chrome in sync with the canonical canvas color.
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
if (themeColor) {
  themeColor.content = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
}

startApp(root);
