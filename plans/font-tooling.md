# Font Tooling Plan

## Goal

Create a clean, repeatable font pipeline for Keybase text fonts and icon fonts, with explicit metrics and platform validation for iOS, Android, and Electron.

The immediate visual issue is mobile strikethrough placement, but the plan should validate the whole typography setup so future font changes do not rely on hidden platform workarounds.

## Current Findings

- `shared/desktop/yarn-helper/font.mts` only generates `shared/fonts/kb.ttf`, the icon font, from `shared/images/iconfont/*.svg`.
- `shared/fonts/keybase*.ttf` are imported binary text fonts. The repo does not contain source `.glyphs`, `.ufo`, `.designspace`, or `.fea` files for them. **Confirmed: only the post-processed TTFs exist. No source files are available.**
- The text fonts identify as Mark Simonson Studio fonts renamed to `Keybase`, then processed through Font Squirrel and `ttfautohint`.
- `shared/fonts/android/keybase*.ttf` are separate Android copies. Their only clear metric difference is a patched underline position from `shared/fonts/android/fixes.py`.
- The Android copies are a workaround, not a source-of-truth build.
- Current text fonts do not set `USE_TYPO_METRICS`; `OS/2` typo metrics and `hhea`/Windows metrics differ significantly.

## Principles

- Keep canonical source inputs separate from generated outputs.
- Prefer one generated font byte sequence per weight/style across all platforms; platform-specific filenames or registration are acceptable, platform-specific font metrics are not.
- Make every intentional metric explicit in a checked-in manifest.
- Make font changes reproducible from CLI commands.
- Validate both static font tables and rendered platform output.
- Keep icon font generation separate from text font generation.
- Remove legacy FontForge and `webfonts-generator` dependency from the core path.

## Proposed File Layout

- `shared/fonts/source/`
  Canonical licensed input font files. This directory should include provenance notes and should not contain generated outputs.
- `shared/fonts/manifest.json`
  Declarative source-to-output mapping for every Keybase text font and Source Code Pro font.
- `shared/fonts/metrics.json`
  Expected OpenType table metrics for every generated font.
- `shared/fonts/generated/`
  Temporary or ignored staging directory used by the build command before copying outputs into platform asset locations.
- `shared/tools/fonts/`
  Python CLI tooling based on `fontTools`.
- `shared/tools/fonts/fixtures/`
  Static strings and visual test definitions shared by RN and Electron test pages.
- `shared/fonts/README.md`
  Human-facing documentation for source provenance, build commands, metric policy, and platform validation.

## CLI Tooling

- [x] Add a Python CLI under `shared/tools/fonts/font_tool.py`.
- [x] Pin Python dependencies for the font tooling, primarily `fontTools` (`requirements.txt` pins `fonttools==4.60.2`).
- [x] Add a command to inspect existing fonts and emit table data:
  `inspect --inputs shared/fonts/*.ttf --output /tmp/keybase-font-inspect.json`
- [x] Add a command to generate `shared/fonts/metrics.json` from the current fonts as a starting snapshot:
  `snapshot-metrics --manifest shared/fonts/manifest.json --output shared/fonts/metrics.json`
- [x] Add a command to build text fonts from canonical inputs:
  `build-text --manifest shared/fonts/manifest.json` (supports `--platform android` for Android-specific patches)
- [x] Add a command to verify generated text fonts against the manifest and metrics:
  `verify-text --manifest shared/fonts/manifest.json --metrics shared/fonts/metrics.json`
- [ ] Add a command to render deterministic local HTML/SVG/canvas fixtures for quick desktop inspection.
- [x] Add a command to summarize changed font tables between two directories:
  `diff-metrics --before shared/fonts --after shared/fonts/generated`
- [x] Add package scripts in `shared/package.json` only as wrappers around the CLI once the CLI exists:
  `font:inspect`, `font:snapshot-metrics`, `font:build-text`, `font:build-android`, `font:verify-text`, `font:diff-metrics`.

## Text Font Build Requirements

- [x] Define canonical font sources and document where they came from (`manifest.json` + `README.md`).
- [ ] Decide whether `Keybase` stays a renamed family or whether the original licensed family names should remain in metadata.
- [ ] For every generated font, set and verify:
  `name`, `head`, `hhea`, `OS/2`, `post`, `gasp`, `cmap`, `GPOS`, `GSUB`, and glyph bounds.
- [ ] Make family grouping explicit:
  iOS/Electron can use `fontFamily: Keybase` with numeric weights; Android may need either family XML registration or separate family names.
- [ ] Decide whether to use Android `res/font` XML family registration so numeric weights can map cleanly.
- [x] Android-only metric patch is now reproducible via `yarn font:build-android` (no longer requires FontForge). Per-font `androidPatches` values are explicit in `manifest.json`. Actual replacement of `fonts/android/` assets is blocked on metrics policy decision (Phase 4).
- [x] Keep Source Code Pro in the same verification pipeline, even if it is not modified (`verify-text` checks it).

## Metrics Policy

- [ ] Define target line metrics:
  `OS/2.sTypoAscender`, `sTypoDescender`, `sTypoLineGap`, `hhea.ascender`, `hhea.descender`, `hhea.lineGap`, `usWinAscent`, `usWinDescent`.
- [ ] Decide whether to set `USE_TYPO_METRICS`.
- [x] Define target decoration metrics:
  `OS/2.yStrikeoutPosition` corrected per-weight (strike center ≈ actual x-height/2); `OS/2.sxHeight` and `OS/2.sCapHeight` corrected to actual glyph measurements (Font Squirrel halving bug fixed). `post.underlinePosition` and `post.underlineThickness` left as-is pending Phase 4 policy.
- [ ] Define clipping policy for accents, combining marks, emoji-adjacent text, and descenders.
- [ ] Define per-weight tolerances where exact equality is not appropriate.
- [ ] Include derived ratios in generated reports, such as strike position relative to x-height and cap height.

## Icon Font Tooling

- [ ] Split icon font generation out of text font tooling.
- [ ] Replace `webfonts-generator` with maintained lower-level packages or a Python/fontTools-based builder.
- [ ] Preserve existing codepoint assignment from filename counters.
- [ ] Preserve deterministic glyph names and generated `icon.constants-gen.shared.tsx`.
- [ ] Preserve Windows installer behavior that required a unique TTF version, but document it and make it explicit.
- [ ] Verify `kb.ttf` metrics, GASP settings, and glyph bounds without FontForge.
- [ ] Decide whether web icon fonts are still needed; if not, remove the obsolete `update-web-font` path in a later cleanup.

## Static Validation

- [ ] Verify all generated outputs match `shared/fonts/metrics.json`.
- [ ] Verify generated fonts are byte-identical on repeated builds, except explicitly versioned fields.
- [ ] Verify no required glyph coverage is lost.
- [ ] Verify all name records are expected and contain no stale Font Squirrel or temporary build metadata unless intentionally retained.
- [ ] Verify Android asset filenames and/or XML family names match the React Native loader path.
- [ ] Verify iOS project resources and Info.plist include every required font.
- [ ] Verify Electron CSS `@font-face` names, weights, and paths match generated outputs.

## App Test Surfaces

- [x] Add a dev-only Settings row named `Typography` (`settings/typography.tsx`).
- [x] Gate the row behind `__DEV__` so it never appears in production release UI.
- [x] Add a shared route/screen for native and desktop (`settings/routes.tsx`, both `sharedNewRoutes` and `settingsDesktopTabRoutes`).
- [x] Keep the screen unframed and dense: it is a debugging tool, not a marketing page.
- [x] Include controls for theme (dark/light background), text type, decoration, sample string cycling.
- [x] On React Native, capture `onTextLayout` for each sample and display ascender, descender, capHeight, xHeight, height, width, and line count.
- [ ] On Electron, display computed CSS font family, font weight, font size, line height, and `document.fonts.check(...)` result.

## Visual Test Content

- [x] App text types: `BodyTiny`, `BodySmall`, `Body`, `BodyBig`, `Header`, `HeaderBig` (terminal text not yet).
- [ ] Weights and styles: weight/style selector not yet separate from text type.
- [x] Decorations: none, underline, strikethrough, underline plus strikethrough.
- [x] Markdown rendering: `~~strike~~`, `**bold**`, `_italic_`, `code`, links (mentions/blockquote not yet).
- [x] Baseline strings: `Hxpxgy`, `Hamburgefontsiv`, `0123456789`, `gjpqy ÁÉÍÓÚ ÅÄÖ` (cycle via Next button).
- [ ] Clipping strings: dedicated section with `ÁÉÍÓÚ ÅÄÖ Ñ Ç`, combining marks, long descender lines not yet added.
- [ ] Real UI contexts: chat message, username, team name, link, button label, input, nav row, popup/menu row, terminal/code block.
- [ ] Multi-line wrapping and tight line-height samples.

## Platform Validation

- [ ] Electron: Playwright screenshot of the font debug route at normal and dark themes.
- [ ] iOS: simulator screenshot of the font debug route at default and large text settings.
- [ ] Android: emulator screenshot of the font debug route at default and large text settings.
- [ ] Android: verify custom fonts are loaded for every intended weight and not synthesized or falling back.
- [ ] All platforms: compare screenshot fixtures against checked-in or saved baseline images.
- [ ] All platforms: run a simple pixel analysis for decoration bands on high-contrast text.

## Decoration-Specific Tests

- [ ] Render `xxxx`, `HHHH`, `agpxy`, and `Hamburgefontsiv` at every app font size.
- [ ] Locate the strikethrough band in screenshots and compare it to x-height/cap-height derived targets.
- [ ] Locate underline band and verify it clears descenders by the chosen minimum.
- [ ] Verify decoration thickness scales consistently by font weight.
- [ ] Verify markdown strikethrough and direct `Text` strikethrough produce the same result.
- [ ] Verify Electron CSS `text-decoration` and RN `textDecorationLine` are both covered.

## Rollout Plan

- [x] Phase 1: Land documentation and static inspection tooling only.
- [x] Phase 2: Generate metrics snapshots from current fonts and document the current platform differences.
- [x] Phase 3: Add dev-only app font debug pages and screenshots without changing font bytes.
- [x] Phase 4: Choose target metrics and update the build CLI to produce adjusted fonts. Fixed Font Squirrel sxHeight/sCapHeight halving bug and per-weight yStrikeoutPosition. Fonts rebuilt and metrics.json regenerated.
- [~] Phase 5: Replace Android-only font copies with clean generated outputs. (Pipeline done via `font:build-android`; actual asset replacement blocked on Phase 4 metric decisions.)
- [ ] Phase 6: Replace or isolate icon font tooling.
- [ ] Phase 7: Add CI validation for static metrics and screenshot fixtures where available.

## Open Questions

- [x] Do we still have the licensed source package for the Mark Simonson font, or only the post-processed TTFs? **Answer: only the post-processed TTFs. No .glyphs/.ufo source files.**
- [ ] Should generated fonts retain existing `Keybase` family naming for compatibility?
- [ ] Should Android move from `assets/fonts` to `res/font` XML registration for cleaner weight selection?
- [x] Which exact visual target should strikethrough use: optical center of x-height, current desktop Chrome behavior, or a design-specified ratio? **Answer: optical center of actual x-height (yMax of 'x' glyph / 2). Implemented.**
- [ ] Should web font generation remain part of this repo, or is it obsolete?
- [ ] Do we want generated font binaries committed, or produced only by release tooling?

## Definition Of Done

- [ ] A fresh checkout can generate all font outputs from documented inputs.
- [ ] Static metric verification fails on accidental font table drift.
- [ ] The dev-only font debug page exists on iOS, Android, and Electron.
- [ ] Strikethrough, underline, line height, clipping, and weight selection are validated by fixtures.
- [ ] Android no longer depends on `fonts/android/fixes.py` or metric-divergent font copies.
- [ ] The old icon font tooling is either replaced or clearly isolated from text font tooling.
