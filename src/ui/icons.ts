import sun from '@phosphor-icons/core/assets/regular/sun.svg?raw';
import moon from '@phosphor-icons/core/assets/regular/moon.svg?raw';
import touch from '@phosphor-icons/core/assets/regular/hand-tap.svg?raw';
import eye from '@phosphor-icons/core/assets/regular/eye.svg?raw';
import eyeSlash from '@phosphor-icons/core/assets/regular/eye-slash.svg?raw';
import robot from '@phosphor-icons/core/assets/regular/robot.svg?raw';
import robotDuotone from '@phosphor-icons/core/assets/duotone/robot-duotone.svg?raw';
import robotFill from '@phosphor-icons/core/assets/fill/robot-fill.svg?raw';
import info from '@phosphor-icons/core/assets/regular/info.svg?raw';
import invite from '@phosphor-icons/core/assets/regular/user-plus.svg?raw';
import classic from '@phosphor-icons/core/assets/regular/checkerboard.svg?raw';
import island from '@phosphor-icons/core/assets/duotone/island-duotone.svg?raw';
import undo from '@phosphor-icons/core/assets/regular/arrow-counter-clockwise.svg?raw';
import restart from '@phosphor-icons/core/assets/regular/arrow-clockwise.svg?raw';
import music from '@phosphor-icons/core/assets/regular/music-note-simple.svg?raw';
import copy from '@phosphor-icons/core/assets/regular/copy.svg?raw';
import close from '@phosphor-icons/core/assets/regular/x.svg?raw';
import online from '@phosphor-icons/core/assets/regular/broadcast.svg?raw';
import upgrade from '@phosphor-icons/core/assets/fill/crown-simple-fill.svg?raw';

// Phosphor has no single-note muted variant. Keep the same note and add a
// diagonal slash matching its regular 16-unit stroke on the 256-unit grid.
const mutedMusic = music.replace('</svg>', '<path d="M40 40l176 176" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" /></svg>');
const touchOff = touch.replace('</svg>', '<path d="M40 40l176 176" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" /></svg>');
const icons = { sun, moon, touch, 'touch-off': touchOff, eye, 'eye-off': eyeSlash, robot, 'robot-duotone': robotDuotone, 'robot-fill': robotFill, info, invite, classic, island, undo, restart, music, 'music-off': mutedMusic, copy, close, online, upgrade };
export type IconName = keyof typeof icons;

/** Only explicitly imported SVGs are bundled; labels live on their controls. */
export function renderIcon(name: IconName): string {
  return icons[name].replace('<svg ', '<svg class="ui-icon" width="16" height="16" aria-hidden="true" focusable="false" ');
}

export function renderTemplateIcons(html: string): string {
  return html.replace(/<span data-icon="([a-z-]+)"><\/span>/g, (_, name: string) => {
    if (!(name in icons)) throw new Error(`Unknown icon: ${name}`);
    return renderIcon(name as IconName);
  });
}
