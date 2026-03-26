# SnippetVault design

The UI is called **Workbench**. It is a tool for people who read code all day,
so it should feel like a good editor panel or mail client: dense, quiet, fast.
The code is the main thing on every screen, the chrome stay out of the way.

## Colour

5 neutrals, 1 accent, and a few colours that each have one job.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--paper` | `#17181a` | `#fbfbfa` | app background |
| `--surface` | `#1f2023` | `#f2f2f0` | sidebar, list, panels |
| `--line` | `#34363b` | `#dcdcd8` | 1px borders and row dividers |
| `--ink` | `#e6e6e3` | `#1d1e20` | main text |
| `--ink-muted` | `#9a9b98` | `#5f6064` | secondary text, metadata |
| `--accent` | `#7aa2d6` | `#1f5fa8` | links, focus ring, selection, the one primary button per view |
| `--danger` | `#e06c6c` | `#b3261e` | errors and destructive actions |
| `--ok` | `#6fb37f` | `#2e7d32` | success |
| `--sensitive` | `#d9a441` | `#8a5a00` | encrypted snippets only, always with the lock icon |

Every text colour on `--paper` and `--surface` pass WCAG AA (4.5:1) in both themes.
Theme follow the system setting, the toggle is saved in localStorage.

## Type

IBM Plex Sans for UI, IBM Plex Mono for code. Fonts are bundled, no CDN.
Sizes 12 / 13 / 14 / 16 / 20 px, weights 400 / 500 / 600. Body is 14px.
Nothing bigger than 20px inside the app.

Mono is only for code, ids and keyboard shortcuts. Not for labels.

## Layout

- Lists are rows, not cards. Tables for tokens, events, expired snippets.
- Structure come from 1px lines, not shadows.
- Spacing on a 4px grid: 4, 8, 12, 16, 24, 32.
- Radius: 0 on rows and tables, 4px on inputs and buttons, 6px on dialogs and menus.
- One shadow (`--shadow-float`), only on things that float: menus, palette, dialogs.

## Not allowed

Checked by stylelint in CI where possible:

- blur, backdrop-filter, glass panels
- gradients, gradient text
- glow or coloured shadows
- radius bigger than 6px, pill buttons
- animations when a page or list appear
- colours written outside `tokens.css`

Checked in review:

- purple / violet accents
- card grids for list data, cards inside cards
- all-caps small labels above headings
- emoji as icons (we use lucide, 16px)
- made up numbers or filler text

## Words

Buttons say what they do: "Save snippet", "Copy code", "Revoke token".
Empty states say what to do next. Short sentences.

## Keyboard

`/` search, `N` new snippet, `↑ ↓` move in list, `Enter` open, `Ctrl K` palette.
Focus ring is 2px `--accent` and always visible.
