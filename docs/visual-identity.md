# Visual identity

## Direction

Empujón takes its visual cues from Old San Juan: limewashed facades, crisp
stucco trim, blue-gray adoquines, and matte mineral surfaces. The chosen palette
is **Seafoam Courtyard**, one palette with light and dusk appearances, paired with the
**Fortress & Modernism** typography system.

Let the canvas supply the color, keep cards mostly stucco white, and reserve
the two piece colors for player identity and turn indicators. Preserve the
generally flat, quiet presentation. Material character should come from subtle
tonal variation and fine grain.

## Palette and roles

The executable source of truth is [`src/visual-identity.css`](../src/visual-identity.css).
It defines each identity token once: palette, font families, type scale, heading treatment,
shape scale, mineral grain, surface shading, and shadows. Components in `src/style.css`
consume these tokens; they must not redefine identity tokens or introduce
hardcoded colors or font families. Contextual `--player` and `--tint` variables
select the canonical player tokens for each seat.

| Role | Token |
| --- | --- |
| Page canvas | `--canvas` |
| Cards, dialogs, turn heading, coordinate frame | `--osj-stucco-white` |
| Terracotta pieces and identity | `--terracotta` |
| Adoquín pieces and identity | `--adoquin` |
| Player tints | `--terracotta-tint`, `--adoquin-tint` |
| Light and alternate board cells | `--board-cell`, `--board-cell-alternate` |
| Grid lines | `--board-grid` |
| Main text | `--osj-adoquin-blue` |
| Wordmark lettering | `--osj-ausubo-wood` |
| General separators | `--line` |

Change palette values in the token file, not in individual components or this
document. Its values are authoritative; this document describes their roles.
The dark slate text token differs intentionally from the bluer Adoquín piece
color. The browser toolbar color follows the resolved canvas color on startup and whenever
the theme changes, without a separate hexadecimal value in HTML.

Display player names are **Terracotta** and **Adoquín**, defined once in
`src/game.ts` and shared by the interface and CLI. Use those shared names for
labels, announcements, and online identity.

Keep neutral surfaces neutral in their selected and current states. Use borders,
small marks, badges, and text to communicate selection and player identity.
Green remains available for neutral controls, focus, choices, and win states.
The wordmark's colored punctuation is an intentional branding use of the two
player colors.

## Board and pieces

- Keep the A–F / 1–6 coordinate frame neutral stucco, with readable neutral labels.
  Preserve the square six-by-six grid and its alignment with the coordinates.
- Keep the board cool blue-gray with modest alternating-cell contrast so the
  pieces remain the focus.
- Pieces should suggest matte stone, using faint mineral grain, broad soft
  shading, and a small contact shadow. Keep Terracotta and Adoquín visibly
  distinct, with Adoquín reading as blue rather than charcoal or purple.
- Use restrained CSS gradients and the lightweight inline SVG grain already in
  the stylesheet. Apply texture to surfaces without filtering text or controls.
- Keep relief shallow: the current piece shadow is about 2px, and the frame
  shadow is small and faint. Avoid stacked extrusion shadows, glossy highlights,
  raised rims, conspicuous stripes, or coarse texture.
- Preserve gold upgrade rings and marks, last-move dots, choice outlines,
  hover previews, and win highlights. Material effects must not obscure them.
- Movement annotations use short, softly transparent dark direction arrows (pale mineral in dark mode) with substantial strokes; off-board
  pushes keep the same neutral arrows and use a × in the pushed piece’s player color and an explicit return-to-supply description.
  The existing last-move dot identifies the placement; omit destination rings and placement outlines. The eye-icon toggle controls only board arrows and off-board marks.
  Default annotations to off. Keep the last-move description visible inside
  the turn heading and name the player who placed the piece. Keep annotations, sound effects, and touch preview together in the header preferences menu.
  Keep preview text in the information panel above the board. Touch users place with a single tap by default. An optional, saved “Touch preview” icon setting previews on the first tap and confirms with a second tap on the same square or the labeled placement button.
- Placements settle with a small scale motion; pushed pieces slide together one square after a brief contact beat. Off-board pieces shrink and fade as they leave the grid, followed by one subtle pulse on each receiving supply. A soft descending return sound follows the push sound when sound is enabled. Keep stationary pieces still, pause piece input during movement, and finish slides before upgrade or win pulses. Reduced-motion users see the final positions immediately.
- Upgrade selection takes over the existing fixed-height turn tracker without shifting the board. Tap eligible pieces to preview a triple; repeat taps on a shared piece cycle through its triples. Highlight all selected pieces together and confirm with a gold “Confirm upgrade” action inside the tracker. Once selected, explicitly instruct the player to confirm; give the action one restrained pulse, respecting reduced motion. Keep all upgrade interactions on the board and tracker, with no option buttons below the board. Pulse eligible pieces once, respecting reduced motion. Single-piece returns use the same interaction.
- Upgrade triples pulse in order using the winning-piece animation, without a green cell fill, before returning to supply. Keep them visible briefly with reduced motion and pause board input during the indication.
- Winning lines use a stronger green cell fill.
  Count across the winning pieces with one staggered pulse, then wait two
  seconds from the finish before fading in the result dialog. Reduced-motion
  users get static highlights and no fade or pulse, with the same reading pause.

The architectural references guide color and material choices. They do not
require literal balconies, wood grain, arches, or dramatic tropical shadows in
the interface.

## Typography and branding

The chosen typography is **Fortress & Modernism**:

- Use Playfair Display 700 for the wordmark, headings, mode titles, and player
  names, with tight tracking (`-.025em`) to give them structural weight.
- Use Montserrat for interface text, with 400 for body copy and heavier weights
  for emphasis. Keep small functional text readable rather than using light
  weights for atmosphere.
- Keep the Seafoam Courtyard palette and matte material styling alongside this
  pairing. The typography is fixed; there is no preview picker.

Playfair's substantial serif forms supply the historical, masonry-inspired
character. Montserrat supplies the clean geometric structure and open feel of
the functional interface. Maintain that hierarchy when adding components:
expressive serif titles, clear sans-serif instructions and controls.

| Role | Typeface | Desktop size | Mobile size |
| --- | --- | --- | --- |
| Wordmark | Playfair Display 700 | 40px | 34px; 29px on the smallest screens |
| Section headings (`h2`) | Playfair Display 700 | 24px | 22px |
| Mode titles | Playfair Display 700 | 20px | 17px |
| Player names | Playfair Display 700 | 17px | 15px |
| Body, controls, status, labels, coordinates | Montserrat | Follow component scale | Check readability at 320px |

Use `--font-heading` and `--font-body` from `src/visual-identity.css` rather than adding
new font families to individual components. Reuse the `--font-size-*` scale for
component text sizes; keep layout dimensions in `src/style.css`. Keep the serif's tight tracking
out of body copy and small labels. Preserve generous line height for rules and
instructions, and check long labels after any typography change.

Use the existing Phosphor icons with consistent footprints. Game preferences, music, appearance,
and How to play share the same bordered square header icon button, including
size, surface, hover, and keyboard focus treatment. Keep accessible names and
tooltips for icon-only controls.

Keep the wordmark lettering ausubo brown (warm sand in dark mode), its accent Adoquín blue, and its period
Terracotta. The accent sits close to the “o”; its current positioning is
`top: .03em; left: .12em`, scaling with the wordmark on smaller screens.

## Interaction and review

Keep keyboard focus visible and pair color with labels, borders, icons, or
marks. Maintain reduced-motion support and the visibility of upgrade symbols
at small piece sizes. Check text and control contrast when changing colors.

For visual changes, run `npm run build` and inspect the affected states in the
browser. Check desktop, tablet, and 320px/390px mobile layouts for clipping,
horizontal overflow, square board geometry, and readable coordinates. When
changing game-state styling, also inspect both players' turns, upgrades, hover
and focus, choices, and wins. Use the existing browser checks where applicable.

Update this document when an intentional design decision changes these rules.

On mobile, keep setup inside a collapsed Game settings disclosure with the current rules and opponent in its summary. Expanded opponent choices use two columns; desktop keeps setup expanded.

On mobile, place the player piece trackers directly below the board.

## Dark mode: courtyard at dusk

The header offers a single light/dark toggle, with a sun or moon showing the
current appearance. Default to the operating system’s appearance and follow
system changes until the user toggles it. Save that explicit override locally
and keep it across reloads and subsequent system changes. Both appearances use
the same identity tokens, with paired `light-dark()` values in `src/visual-identity.css`.

Dark mode uses deep seafoam for the canvas, warm shaded mineral surfaces for
cards and the coordinate frame, and cool blue-gray paving for the board.
Terracotta stays earthy orange-red clay; Adoquín stays blue, never charcoal or
purple. Their dusk values are lighter to remain legible on dark surfaces. Keep
the shared player names, gold upgrades, typography, grain, and shallow relief.
Use warm sand for the wood wordmark and pale mineral ink for movement arrows.
Selection and turn states retain neutral surfaces with colored borders and marks.

## Post-game review

The result dialog offers “Review game”. Only after that button is clicked, show
review controls inside the existing information panel above the board. Combine
the current position’s heading, last-move description, first/previous/next/final
controls, and position counter in that single panel. Place the review counter in its heading. Omit duplicate review labels
and move counts. Record every placement and explicit upgrade choice, including CPU
turns. Review updates the board, supplies, last-move description, and optional
annotations together. Keep historical positions read-only, with no previews,
placement controls, or thinking prompts. Single steps in both directions animate placements, pushes, and off-board
returns. Backward steps slide pushed pieces back, bring exited pieces onto the
board, and return the placed piece to supply. Upgrade decisions and jumps are immediate. Review stays silent
and honors reduced motion. Retain static winning highlights without repeating win animations or dialogs.
Use the same neutral stucco surfaces and Phosphor icons in both appearances.
New game starts a fresh timeline. Online timelines last for the session and
survive reconnection; sessions created before history was recorded can only
show their available positions.

## Board information component

`src/ui/components/board-information.ts` owns the single changing information
panel above the board, with its markup in `src/ui/templates/board-information.html`.
Use a fixed heading row and a shared content area. During ordinary play, move
details and status use that area. When actions appear, show the move
description alongside compact controls in the same space, keeping secondary status
available to assistive technology. Do not reserve a separate empty action row. Upgrade selection
and confirmation, optional touch-preview placement, and review navigation share
that slot; none add a new row or panel. Preview text replaces the last-move
description within the details slot. Keep local, CPU, online, win, and review
states within the same footprint at each screen size, so the board stays in place.
Long descriptions use the reserved lines, with full text available to assistive
technology and on hover. Online identity stays in the session banner; changing
connection and turn information belongs in the board information panel.

## Background music

Music uses a header icon beside the theme toggle and opens a compact, nonmodal popover, dismissible by Escape or an outside tap. Keep it separate from game sounds. All tracks are included by default; persist explicit exclusions, and advance through included songs in order, wrapping at the end. Start
paused and require a deliberate Play action; remember track and volume preferences.
Keep track choices and full composer, license, and provider credits together in
the music selection screen, with visibly linked attribution in each track’s expandable credits. Use the existing
neutral surfaces, green controls, and responsive dialog styling.

While music is playing, gently sway the header note icon. On a new track,
briefly reveal its title and composer beside the icon, without shifting the
header or board. Dismiss the announcement after about four seconds or on pause;
replace it when another track starts. Reduced motion keeps the icon still and
shows the same temporary announcement without movement or fading.

Header preferences use a gear icon and a nonmodal popover with labeled sound,
annotations, and touch-preview toggles. Put Undo and New game in the information
panel’s heading alongside the move counter; keep contextual upgrade, placement,
and review controls in their existing slot. Preserve the panel’s fixed height.
