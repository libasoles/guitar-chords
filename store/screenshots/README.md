# Screenshots for Chrome Web Store

Required size: **1280×800** or **640×400** (same ratio). PNG or JPEG.

Recommended shots (5 max in the store):

| File | What to capture |
|---|---|
| `01-search.png` | Typing "C" — chord diagram visible |
| `02-pinned.png` | Two chords pinned (G + D7 for example) while searching |
| `03-filters.png` | Filter pills — e.g. "Minor 7th" selected, results filtered |

## How to capture

1. `npm run build:ext`
2. Load unpacked from `dist/extension/` in Chrome
3. Open the extension popup, resize to ~380×600 px
4. Take a screenshot with the OS screenshot tool or Chrome DevTools device emulator
5. Save here as `01-search.png`, etc.

## OG image for the site

Also save a **1200×630** screenshot as `src/site/og-image.png` — the build script
copies it to `dist/site/assets/og-image.png` for og:image / Twitter card.
