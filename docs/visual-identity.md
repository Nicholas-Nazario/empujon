# Visual identity

## Direction

Empujón takes its visual cues from Old San Juan: limewashed facades, crisp
stucco trim, blue-gray adoquines, and matte mineral surfaces. The chosen palette
is **Seafoam Courtyard**, a single permanent palette, paired with the
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
color. The browser toolbar color reads `--canvas` at startup rather than keeping
a separate hexadecimal value in HTML.

Display player names are **Terracotta** and **Adoquín**, defined once in
`src/game.ts` and shared by the interface and CLI. Use those shared names for
labels, announcements, and online identity.

Keep white surfaces white in their selected and current states. Use borders,
small marks, badges, and text to communicate selection and player identity.
Green remains available for neutral controls, focus, choices, and win states.
The wordmark's colored punctuation is an intentional branding use of the two
player colors.

## Board and pieces

- Keep the A–F / 1–6 coordinate frame stucco white, with readable neutral labels.
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
- Movement annotations use short, softly transparent black direction arrows with substantial strokes; off-board
  pushes keep black arrows and use a × in the pushed piece’s player color and an explicit return-to-supply description.
  The existing last-move dot identifies the placement; omit destination rings and placement outlines. The eye-icon toggle controls only board arrows and off-board marks.
  Default annotations to off. Keep the last-move description visible inside
  the turn heading and name the player who placed the piece. Place the
  annotation toggle in the action bar alongside sound, undo, and new game.
  Keep preview text below the board. Touch users preview first and confirm with a labeled button.
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

Use the existing Phosphor icons with consistent footprints.

Keep the wordmark lettering dark brown, its accent Adoquín blue, and its period
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
