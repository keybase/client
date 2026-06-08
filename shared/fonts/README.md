# Keybase Fonts

## Source Provenance

### Keybase text fonts (`keybase-*.ttf`)
Mark Simonson Studio typeface renamed to `Keybase`, processed through Font Squirrel and
`ttfautohint`. **Only the processed TTFs exist in the repo — no `.glyphs`, `.ufo`, or
other source files are available.** The TTFs are the canonical inputs for the build pipeline.

### Source Code Pro (`SourceCodePro-*.ttf`)
Adobe Source Code Pro, imported binaries. No modifications.

### Icon font (`kb.ttf`)
Generated from `shared/images/iconfont/*.svg` by `shared/desktop/yarn-helper/font.mts`.
Codepoint assignment is driven by filename counters to stay stable across regenerations.

---

## Directory Layout

| Directory | Contents |
|-----------|----------|
| `shared/fonts/` | Canonical source TTFs and this README |
| `shared/fonts/ios/` | iOS-specific built outputs |
| `shared/fonts/electron/` | Electron-specific built outputs (may have patched metrics) |
| `shared/fonts/android/` | Android-specific built outputs (patched underline position) |
| `shared/fonts/generated/` | Intermediate staging from build tool; not platform assets |

Platform-specific directories exist because different rendering engines interpret the same
font metrics differently. Each platform gets its own copy so patches can be applied per
platform without affecting others.

---

## Build Commands

Install the Python tooling dependencies once:

```sh
pip3 install -r shared/tools/fonts/requirements.txt
```

Build all text fonts for iOS and Electron:

```sh
yarn font:build-text
```

Build Android fonts (separate because they need different underline patches):

```sh
yarn font:build-android
```

Build icon font (`kb.ttf`) for all platforms (iOS, Electron) from SVGs in `shared/images/iconfont/`:

```sh
yarn font:build-icon
```

Build icon font for Android:

```sh
yarn font:build-icon-android
```

Other commands:

```sh
yarn font:inspect          # dump OpenType table data for current fonts
yarn font:snapshot-metrics # regenerate shared/fonts/metrics.json from current outputs
yarn font:verify-text      # verify generated fonts match metrics.json
yarn font:diff-metrics     # compare metrics between two font directories
```

---

## Manifest (`manifest.json`)

`manifest.json` is the single source of truth for the build. For each text font it declares:

- `source` — canonical input TTF path
- `patches` — metric patches applied to all platforms (OS/2 table)
- `androidPatches` — additional patches for Android only (post table underlinePosition)
- `electronPatches` — additional patches for Electron only (see below)
- `outputs` — per-platform destination paths

Edit the manifest when changing metrics or adding fonts, then run `yarn font:build-text`.

---

## Platform Metric Quirks

### Strikethrough position

**Chromium/macOS (Electron):**
Chromium on macOS computes CSS `text-decoration: line-through` position from
`hhea.ascender` via Core Text. It does **not** use `OS/2.yStrikeoutPosition` or
`OS/2.sxHeight` — changing those fields has zero effect on strikethrough position in
Electron.

To move the strikethrough down, reduce `hhea.ascender`. The current value for bold weights
in Electron is 1750 (down from the default 2210), which places the strike at the optical
center of the lowercase `a`.

**iOS/Android:**
Core Text on iOS measures actual glyph bounding boxes, so `hhea.ascender` changes do not
affect strikethrough position there. iOS and Android use the unpatched fonts (hhea.ascender
stays at 2210).

This is why bold and bold-italic have `electronPatches: {"hhea": {"ascender": 1750}}` in
the manifest — they need a lower value for Electron without breaking iOS.

### OS/2 metrics (`sxHeight`, `sCapHeight`, `yStrikeoutPosition`)

The original Font Squirrel processing halved `sxHeight` and `sCapHeight`. The manifest
patches correct these to the actual glyph measurements. `yStrikeoutPosition` is set to
approximately x-height / 2 per weight.

These values have no effect on strikethrough rendering in Chromium on macOS (see above),
but they are correct for platforms that do use them and for font inspection tools.

### Android underline position

Android uses `post.underlinePosition` for underline placement. Each font has an
`androidPatches` entry in the manifest to set the correct per-weight value.

---

## Metric Reference (keybase-medium baseline)

| Metric | Value | Notes |
|--------|-------|-------|
| `sTypoAscender` | 1618 | |
| `sTypoDescender` | −430 | |
| `sTypoLineGap` | 0 | |
| `usWinAscent` | 2210 | |
| `usWinDescent` | 736 | |
| `hhea.ascender` | 2210 | Electron bold uses 1750 |
| `hhea.descender` | −736 | |
| `OS/2.sxHeight` | 989 | Corrected from Font Squirrel 495 |
| `OS/2.sCapHeight` | 1366 | Corrected from Font Squirrel 683 |
| `yStrikeoutPosition` | 460 | ≈ sxHeight / 2 |
| `post.underlinePosition` | −154 | |
| `post.underlineThickness` | 102 | |

`USE_TYPO_METRICS` (`OS/2.fsSelection` bit 7) is currently **not set**. Line spacing uses
`usWinAscent`/`usWinDescent` on Windows and `hhea` on macOS/iOS.

---

## Open Questions

- Should web font generation remain part of this repo, or is it obsolete?
