# Chrome Web Store — Publishing checklist

## Pre-submission

- [ ] `npm run build:ext` — produces `dist/extension.zip`
- [ ] Load unpacked in Chrome and smoke-test the popup (search, pin, unpin)
- [ ] Verify the extension works in both English and Spanish Chrome installs
- [ ] Place `store/screenshots/*.png` files (see below)
- [ ] Host `store/privacy-policy.html` at a public URL (e.g. GitHub Pages `store/` path)

## Dashboard — https://chrome.google.com/webstore/devconsole

### 1. Package
Upload `dist/extension.zip`.

### 2. Store listing
Use the copy in [`listing.md`](listing.md).

| Field | Limit | Source |
|---|---|---|
| Name | 45 chars | "Guitar Chords" |
| Summary | 132 chars | See `listing.md` |
| Description | 16 384 chars | See `listing.md` |
| Category | — | Productivity |
| Language | — | English + Spanish |

### 3. Graphics

| Asset | Size | Notes |
|---|---|---|
| Icon | 128×128 | Already in `dist/extension/icons/icon-128.png` |
| Screenshots | 1280×800 or 640×400 | At least 1 required; 5 recommended |
| Small promo tile | 440×280 | Optional but helps discoverability |
| Marquee | 1400×560 | Optional; shown on homepage features |

Place screenshot PNGs in `store/screenshots/`:
- `01-search.png` — typing a chord name, diagram shown
- `02-pinned.png` — pinned chords panel
- `03-filters.png` — filter pills active

### 4. Privacy

- **Single purpose:** Look up guitar chord diagrams.
- **Permissions:** none (the extension declares no special permissions).
- **Data collection:** none — all chord data is bundled locally; nothing is sent over the network.
- **Privacy policy URL:** host `store/privacy-policy.html` and paste the URL.

### 5. Pricing
Free.

### 6. Distribution
All regions. All users.

## After approval

- Update `EXTENSION_STORE_URL` in CI / build scripts to the live store URL.
- Re-build the site to enable the "Add to Chrome" button:
  ```
  EXTENSION_STORE_URL=https://chromewebstore.google.com/detail/guitar-chords/<id> npm run build:site
  ```
- Deploy the updated site.
