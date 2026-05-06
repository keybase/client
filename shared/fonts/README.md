# Keybase Fonts

## Source Provenance

### Keybase text fonts (`keybase-*.ttf`)
The Keybase text fonts are derived from a Mark Simonson Studio typeface renamed to
`Keybase`, then processed through Font Squirrel and `ttfautohint`. The repo does not
contain the original licensed `.glyphs` or `.ufo` source files — only the processed
TTFs. See [Open Questions](#open-questions) below.

### Source Code Pro (`SourceCodePro-*.ttf`)
Adobe Source Code Pro, imported binaries. No modifications.

### Icon font (`kb.ttf`)
Generated from `shared/images/iconfont/*.svg` by `shared/desktop/yarn-helper/font.mts`.
Codepoint assignment is driven by filename counters to stay stable across regenerations.

### Android copies (`android/`)
`shared/fonts/android/` contains per-platform copies of the Keybase text fonts with a
patched `post.underlinePosition` applied by `android/fixes.py` (requires FontForge).
This is a workaround for Android underline rendering and is not a source-of-truth build.
It will be removed once the new build pipeline produces correct metrics directly.

---

## Metric Policy (current state, not yet enforced)

The current fonts do **not** set `USE_TYPO_METRICS` (`OS/2.fsSelection` bit 7). This
means Windows and older renderers use `usWinAscent`/`usWinDescent` for line spacing
rather than the typo metrics, causing the two sets of metrics to diverge:

| Metric | keybase-medium value |
|--------|---------------------|
| `sTypoAscender` | 1618 |
| `sTypoDescender` | −430 |
| `sTypoLineGap` | 0 |
| `usWinAscent` | 2210 |
| `usWinDescent` | 736 |
| `hhea.ascender` | 2210 |
| `hhea.descender` | −736 |
| `yStrikeoutPosition` | 592 |
| `yStrikeoutSize` | 131 |
| `post.underlinePosition` | −154 |
| `post.underlineThickness` | 102 |

Target metric policy will be decided in Phase 4 of the font tooling rollout.

---

## Build Commands

Install the Python tooling dependencies once:

```sh
pip3 install -r shared/tools/fonts/requirements.txt
```

### Inspect fonts

Emit OpenType table data as JSON for one or more fonts:

```sh
yarn font:inspect --inputs shared/fonts/*.ttf --output /tmp/keybase-font-inspect.json
# or directly:
python3 shared/tools/fonts/font_tool.py inspect \
  --inputs shared/fonts/*.ttf \
  --output /tmp/keybase-font-inspect.json
```

### Manifest

`shared/fonts/manifest.json` is the declarative source-to-output mapping. It lists
every text font and icon font, their canonical source paths, per-platform output paths,
and provenance notes. Edit this file when adding or renaming fonts.

---

## Open Questions

- Do we still have the licensed source package for the Mark Simonson font, or only the
  post-processed TTFs?
- Should generated fonts retain the existing `Keybase` family naming for compatibility?
- Should Android move from `assets/fonts` to `res/font` XML registration for cleaner
  weight selection?
- Which exact visual target should strikethrough use: optical center of x-height,
  current desktop Chrome behaviour, or a design-specified ratio?
- Should web font generation remain part of this repo, or is it obsolete?
- Do we want generated font binaries committed, or produced only by release tooling?
