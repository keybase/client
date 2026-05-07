# kb.ttf Icon Font Build Pipeline + Icon Browser

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `webfonts-generator` + `fontforge` pipeline for `kb.ttf` with pure Python using `fonttools`, and add a dev-only icon browser debug screen.

**Architecture:** Add a `build-icon` subcommand to `shared/tools/fonts/font_tool.py` (same file, same pattern as `build-text`). The command reads SVG files from `shared/images/iconfont/`, converts paths to TrueType quadratic outlines using `fonttools` + `cu2quPen`, applies the same metrics that `fontforge` currently sets, and writes `shared/fonts/kb.ttf` plus `shared/fonts/android/kb.ttf`. A new `shared/settings/icons.tsx` debug screen shows all iconfont glyphs in a scrollable grid, gated behind `__DEV__`.

**Tech Stack:** Python 3, `fonttools` 4.60.2 (already in `requirements.txt`), TypeScript/React Native for the debug screen. No new Python dependencies.

---

## Background: current pipeline

`yarn update-icon-font` runs `shared/desktop/yarn-helper/font.mts` which:
1. Uses `webfonts-generator` (Node.js) to combine the SVG files into a TTF
2. Calls `fontforge` via shell to apply OS/2, hhea, GASP metrics and shift glyphs vertically

The new pipeline eliminates both `webfonts-generator` and `fontforge`, keeping the produced binary byte-for-byte equivalent in metrics (visual output will be identical).

## Key constants (from `font.mts`)

```
FONT_HEIGHT   = 1024
DESCENT       = FONT_HEIGHT / 16 = 64
BASE_CHAR_CODE = 0xe900
codepoint(counter) = BASE_CHAR_CODE + counter - 1

WIN_ASCENT   = FONT_HEIGHT - DESCENT + 2  = 962
WIN_DESCENT  = DESCENT * 2 + 20          = 148
TYPO_ASCENT  = FONT_HEIGHT - DESCENT      = 960
TYPO_DESCENT = -DESCENT                  = -64
TYPO_LINE_GAP = 0
HHEA_ASCENT  = WIN_ASCENT                = 962
HHEA_DESCENT = -WIN_DESCENT             = -148
GASP         = {65535: 15}              (all 4 bits: gridfit + dogray + symmetric)

Glyph vertical shift (applied via coordinate transform during build):
  All glyphs:      shift Y by -64  (i.e., baseline = TYPO_ASCENT - FONT_HEIGHT = -64 below top)
  24-size glyphs:  shift Y by additional -22
```

## SVG coordinate transform

The icon SVGs use `viewBox="0 0 W W"` (W = 8, 16, or 24). Font EM = 1024. Y-axis is flipped (SVG y-down, font y-up).

For a glyph of grid size `W`:

```
scale     = 1024.0 / W
x_font    = x_svg * scale
y_font    = (W - y_svg) * scale - DESCENT         [for 8- and 16-size]
y_font    = (W - y_svg) * scale - DESCENT - 22    [for 24-size only]
```

This is expressed as an affine matrix `(xx, xy, yx, yy, dx, dy)` for `TransformPen`:
```
(scale, 0, 0, -scale, 0,  W*scale - DESCENT)          # 8 and 16
(scale, 0, 0, -scale, 0,  W*scale - DESCENT - 22)      # 24
```

Advance width for all glyphs = `W * scale = 1024`.

---

## File map

| Action | Path |
|--------|------|
| Modify | `shared/tools/fonts/font_tool.py` |
| Modify | `shared/fonts/manifest.json` |
| Modify | `shared/package.json` |
| Modify | `shared/fonts/README.md` |
| Create | `shared/settings/icons.tsx` |
| Modify | `shared/constants/settings.tsx` |
| Modify | `shared/settings/routes.tsx` |
| Modify | `shared/settings/root-phone.tsx` |
| Modify | `shared/settings/sub-nav/left-nav.tsx` |

---

## Task 1: Add imports, constants, and SVG path parser to `font_tool.py`

**Files:**
- Modify: `shared/tools/fonts/font_tool.py`

- [ ] **Step 1: Add imports at the top of `font_tool.py`**

After the existing `import glob, json, sys` block, add:

```python
import re
import xml.etree.ElementTree as ET
```

- [ ] **Step 2: Add icon font constants after existing imports**

```python
# --- Icon font build constants (match shared/desktop/yarn-helper/font.mts) ---
_ICON_FONT_HEIGHT = 1024
_ICON_DESCENT = _ICON_FONT_HEIGHT // 16          # 64
_ICON_BASE_CHAR_CODE = 0xe900
_ICON_WIN_ASCENT = _ICON_FONT_HEIGHT - _ICON_DESCENT + 2   # 962
_ICON_WIN_DESCENT = _ICON_DESCENT * 2 + 20                 # 148
_ICON_TYPO_ASCENT = _ICON_FONT_HEIGHT - _ICON_DESCENT      # 960
_ICON_TYPO_DESCENT = -_ICON_DESCENT                        # -64
_ICON_HHEA_ASCENT = _ICON_WIN_ASCENT                       # 962
_ICON_HHEA_DESCENT = -_ICON_WIN_DESCENT                    # -148
_ICON_24_EXTRA_SHIFT = 22
_ICON_FILENAME_RE = re.compile(r'^(\d+)-kb-iconfont-(.*?)-(\d+)\.svg$')
```

- [ ] **Step 3: Add SVG path parser function**

This parser handles the subset of SVG path commands used by the icon SVGs (`M`, `L`, `H`, `V`, `C`, `Z` and their lowercase relative variants). It draws into a fonttools `SegmentPen`.

```python
def _draw_svg_path(d: str, pen) -> None:
    """Parse an SVG path `d` string and draw into a fonttools SegmentPen."""
    tokens = re.findall(
        r'[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?',
        d
    )
    idx = 0
    cmd = ''
    cx, cy = 0.0, 0.0
    contour_open = False

    def nums(n: int) -> list:
        nonlocal idx
        result = [float(tokens[idx + i]) for i in range(n)]
        idx += n
        return result

    def ensure_closed():
        nonlocal contour_open
        if contour_open:
            pen.endPath()
            contour_open = False

    while idx < len(tokens):
        t = tokens[idx]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            idx += 1

        if cmd in ('M', 'm'):
            ensure_closed()
            x, y = nums(2)
            if cmd == 'm':
                x, y = cx + x, cy + y
            pen.moveTo((x, y))
            contour_open = True
            cx, cy = x, y
            # Subsequent coords in an M sequence are implicit L/l
            cmd = 'L' if cmd == 'M' else 'l'
        elif cmd in ('L', 'l'):
            x, y = nums(2)
            if cmd == 'l':
                x, y = cx + x, cy + y
            pen.lineTo((x, y))
            cx, cy = x, y
        elif cmd in ('H', 'h'):
            x, = nums(1)
            if cmd == 'h':
                x = cx + x
            pen.lineTo((x, cy))
            cx = x
        elif cmd in ('V', 'v'):
            y, = nums(1)
            if cmd == 'v':
                y = cy + y
            pen.lineTo((cx, y))
            cy = y
        elif cmd in ('C', 'c'):
            x1, y1, x2, y2, x, y = nums(6)
            if cmd == 'c':
                x1, y1 = cx + x1, cy + y1
                x2, y2 = cx + x2, cy + y2
                x, y = cx + x, cy + y
            pen.curveTo((x1, y1), (x2, y2), (x, y))
            cx, cy = x, y
        elif cmd in ('S', 's'):
            # Smooth cubic: x1/y1 is reflection of previous control point.
            # We don't track the previous control point so treat as C with x1=cx,y1=cy.
            x2, y2, x, y = nums(4)
            if cmd == 's':
                x2, y2 = cx + x2, cy + y2
                x, y = cx + x, cy + y
            pen.curveTo((cx, cy), (x2, y2), (x, y))
            cx, cy = x, y
        elif cmd in ('Z', 'z'):
            if contour_open:
                pen.closePath()
                contour_open = False
        else:
            idx += 1  # unknown command, skip

    ensure_closed()
```

- [ ] **Step 4: Verify the parser handles the real SVG files**

```bash
cd /path/to/client
python3 -c "
import sys; sys.path.insert(0, 'shared/tools/fonts')
from font_tool import _draw_svg_path
from fontTools.pens.recordingPen import RecordingPen
p = RecordingPen()
_draw_svg_path('M8 15.75C4.281 0.25 0 3.719.25 8Z', p)
print(p.value)
"
```

Expected: prints a list of pen operations ending with `('closePath', ())`

- [ ] **Step 5: Commit**

```bash
git add shared/tools/fonts/font_tool.py
git commit -m "font_tool: add SVG path parser for icon font build"
```

---

## Task 2: Add `_build_icon_glyph` and `cmd_build_icon` to `font_tool.py`

**Files:**
- Modify: `shared/tools/fonts/font_tool.py`

- [ ] **Step 1: Add the per-glyph builder function**

```python
def _build_icon_glyph(svg_path: str, size: int) -> tuple:
    """
    Parse one SVG icon file and return (TTGlyph, advance_width, lsb).
    size is the icon grid size (8, 16, or 24).
    """
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.pens.cu2quPen import Cu2QuPen

    scale = _ICON_FONT_HEIGHT / size
    y_shift = size * scale - _ICON_DESCENT
    if size == 24:
        y_shift -= _ICON_24_EXTRA_SHIFT

    # Pen chain: SVG path commands → transform → cubic→quadratic → TTGlyph
    tt_pen = TTGlyphPen(None)
    cu2qu_pen = Cu2QuPen(tt_pen, max_err=1.0, reverse_direction=False)
    transform_pen = TransformPen(cu2qu_pen, (scale, 0, 0, -scale, 0, y_shift))

    ns = 'http://www.w3.org/2000/svg'
    tree = ET.parse(svg_path)
    root = tree.getroot()

    for elem in root.iter(f'{{{ns}}}path'):
        d = elem.get('d', '').strip()
        if d:
            _draw_svg_path(d, transform_pen)

    advance_width = int(round(size * scale))  # = 1024 for all sizes
    glyph = tt_pen.glyph(dropImpliedOnCurves=True)
    lsb = glyph.xMin if glyph.numberOfContours != 0 else 0
    return glyph, advance_width, lsb
```

- [ ] **Step 2: Add `cmd_build_icon`**

```python
def cmd_build_icon(args):
    from fontTools.fontBuilder import FontBuilder

    manifest = json.loads(Path(args.manifest).read_text())
    repo_root = Path(args.manifest).resolve().parent.parent.parent
    icon_cfg = manifest.get("iconFont", {})
    iconfont_dir = repo_root / "shared" / "images" / "iconfont"

    # Collect and sort SVG files by counter
    entries = []
    for svg_file in sorted(iconfont_dir.glob("*.svg")):
        m = _ICON_FILENAME_RE.match(svg_file.name)
        if not m:
            continue
        counter, name, size_str = int(m.group(1)), m.group(2), int(m.group(3))
        entries.append((counter, name, size_str, svg_file))
    entries.sort(key=lambda e: e[0])

    if not entries:
        print("ERROR: no SVG files found", file=sys.stderr)
        sys.exit(1)

    # Build glyph data
    glyph_order = [".notdef"]
    char_map: dict[int, str] = {}
    glyph_data: dict = {}
    h_metrics: dict = {}

    # .notdef: empty glyph
    from fontTools.ttLib.tables._g_l_y_f import Glyph as TTGlyph
    empty = TTGlyph()
    empty.numberOfContours = 0
    empty.coordinates = []
    empty.flags = []
    empty.components = []
    glyph_data[".notdef"] = empty
    h_metrics[".notdef"] = (_ICON_FONT_HEIGHT, 0)

    seen_counters: set[int] = set()
    errors = 0
    for counter, name, size, svg_path in entries:
        if counter in seen_counters:
            print(f"ERROR: duplicate counter {counter} in {svg_path.name}", file=sys.stderr)
            errors += 1
            continue
        seen_counters.add(counter)

        glyph_name = f"uni{(_ICON_BASE_CHAR_CODE + counter - 1):04X}"
        codepoint = _ICON_BASE_CHAR_CODE + counter - 1
        glyph_order.append(glyph_name)
        char_map[codepoint] = glyph_name

        try:
            glyph, adv, lsb = _build_icon_glyph(str(svg_path), size)
            glyph_data[glyph_name] = glyph
            h_metrics[glyph_name] = (adv, lsb)
        except Exception as e:
            print(f"ERROR building glyph for {svg_path.name}: {e}", file=sys.stderr)
            errors += 1
            # insert empty glyph so glyph order stays consistent
            glyph_data[glyph_name] = empty
            h_metrics[glyph_name] = (_ICON_FONT_HEIGHT, 0)

    if errors:
        print(f"build-icon: {errors} error(s)", file=sys.stderr)
        sys.exit(1)

    # Assemble font
    fb = FontBuilder(_ICON_FONT_HEIGHT, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(char_map)
    fb.setupGlyf(glyph_data)
    fb.setupHorizontalMetrics(h_metrics)
    fb.setupHorizontalHeader(
        ascent=_ICON_HHEA_ASCENT,
        descent=_ICON_HHEA_DESCENT,
    )
    fb.setupNameTable({
        "familyName": "kb",
        "styleName": "Regular",
    })
    fb.setupOs2(
        sTypoAscender=_ICON_TYPO_ASCENT,
        sTypoDescender=_ICON_TYPO_DESCENT,
        sTypoLineGap=0,
        usWinAscent=_ICON_WIN_ASCENT,
        usWinDescent=_ICON_WIN_DESCENT,
        fsType=0,
        fsSelection=0,
    )
    fb.setupPost(keepGlyphNames=False)
    fb.setupGasp(gaspRange={65535: 15})

    # Determine output paths from manifest iconFont config
    outputs: list[str] = icon_cfg.get("outputs", [icon_cfg.get("output", "")])
    if isinstance(outputs, str):
        outputs = [outputs]

    platform: str = getattr(args, 'platform', 'all')
    android_output = icon_cfg.get("androidOutput", "")

    wrote = []
    if platform == "android":
        if android_output:
            out_path = repo_root / android_output
            out_path.parent.mkdir(parents=True, exist_ok=True)
            fb.font.save(str(out_path))
            wrote.append(str(out_path))
    else:
        for rel in outputs:
            if not rel:
                continue
            out_path = repo_root / rel
            out_path.parent.mkdir(parents=True, exist_ok=True)
            fb.font.save(str(out_path))
            wrote.append(str(out_path))

    for w in wrote:
        print(f"  wrote {w}", file=sys.stderr)
    print(f"build-icon: {len(entries)} glyphs, {len(wrote)} output(s)", file=sys.stderr)

    # Touch sentinel so webpack notices font change
    sentinel = repo_root / "shared" / "fonts" / ".font-build-stamp"
    sentinel.write_text(str(__import__('time').time()) + "\n")
```

- [ ] **Step 3: Register `cmd_build_icon` in `main()`**

In the `main()` function, add after the `p_diff` block (before `args = parser.parse_args()`):

```python
    p_icon = sub.add_parser("build-icon", help="Build kb.ttf icon font from SVGs")
    p_icon.add_argument("--manifest", required=True, metavar="FILE")
    p_icon.add_argument("--platform", default="all", choices=["all", "android"],
                        help="Target platform (default: all; 'android' writes androidOutput)")
    p_icon.set_defaults(func=cmd_build_icon)
```

- [ ] **Step 4: Commit**

```bash
git add shared/tools/fonts/font_tool.py
git commit -m "font_tool: add build-icon command (SVG→TTF via fonttools)"
```

---

## Task 3: Update `manifest.json`, `package.json`, and `README.md`

**Files:**
- Modify: `shared/fonts/manifest.json`
- Modify: `shared/package.json`
- Modify: `shared/fonts/README.md`

- [ ] **Step 1: Update `manifest.json` — add outputs and androidOutput to iconFont**

Replace the existing `"iconFont"` block:

```json
"iconFont": {
  "id": "kb",
  "source": "shared/images/iconfont/*.svg",
  "output": "shared/fonts/kb.ttf",
  "outputs": ["shared/fonts/kb.ttf", "shared/fonts/ios/kb.ttf", "shared/fonts/electron/kb.ttf"],
  "androidOutput": "shared/fonts/android/kb.ttf",
  "generator": "shared/tools/fonts/font_tool.py"
}
```

Note: `"generator"` is informational only (was pointing to the old font.mts). The `"output"` key stays for backward compatibility with `cmd_snapshot_metrics`.

- [ ] **Step 2: Add yarn scripts to `shared/package.json`**

In the `scripts` section, after `"font:build-android"`:

```json
"font:build-icon": "python3 tools/fonts/font_tool.py build-icon --manifest fonts/manifest.json",
"font:build-icon-android": "python3 tools/fonts/font_tool.py build-icon --manifest fonts/manifest.json --platform android",
```

- [ ] **Step 3: Add documentation to `shared/fonts/README.md`**

In the "Build Commands" section, after `yarn font:build-android`:

```markdown
Build icon font (kb.ttf) for all platforms (iOS, Electron) from SVGs:

```sh
yarn font:build-icon
```

Build icon font for Android:

```sh
yarn font:build-icon-android
```
```

Also update the "Directory Layout" table to add:

```markdown
| `shared/fonts/ios/` | iOS-specific built outputs (includes `kb.ttf`) |
```

And add a note under `## Open Questions` removing or resolving the web font question if appropriate (leave as-is if uncertain).

- [ ] **Step 4: Run the build and verify output exists**

```bash
cd shared
yarn font:build-icon
```

Expected stderr: lines like `  wrote .../shared/fonts/kb.ttf` then `build-icon: 193 glyphs, 3 output(s)`

Check the file was written:
```bash
ls -la shared/fonts/kb.ttf shared/fonts/android/kb.ttf
```

Expected: both files exist with recent modification time and size > 20KB.

- [ ] **Step 5: Inspect the built font and spot-check metrics**

```bash
cd shared
yarn font:inspect --inputs fonts/kb.ttf | python3 -c "
import json, sys
d = json.load(sys.stdin)[0]
os2 = d['tables']['OS/2']
hhea = d['tables']['hhea']
gasp = d['tables'].get('gasp', {})
print('WIN_ASCENT', os2['usWinAscent'], '== 962?', os2['usWinAscent'] == 962)
print('WIN_DESCENT', os2['usWinDescent'], '== 148?', os2['usWinDescent'] == 148)
print('TYPO_ASCENT', os2['sTypoAscender'], '== 960?', os2['sTypoAscender'] == 960)
print('HHEA_ASCENT', hhea['ascender'], '== 962?', hhea['ascender'] == 962)
print('GASP', gasp)
print('GLYPH_COUNT', d['glyphCount'], '>= 194?', d['glyphCount'] >= 194)
"
```

Expected: all comparisons print `True`, GASP shows `{\"65535\": 15}`, glyph count ≥ 194 (193 icons + .notdef).

- [ ] **Step 6: Commit**

```bash
git add shared/fonts/manifest.json shared/package.json shared/fonts/README.md
git commit -m "font: wire font:build-icon yarn scripts and manifest outputs"
```

---

## Task 4: Create `shared/settings/icons.tsx` icon browser

**Files:**
- Create: `shared/settings/icons.tsx`

This debug screen shows every `iconfont-*` entry from `iconMeta` in a scrollable grid. Each cell renders the glyph via `Kb.Icon` with the icon name below it. A search box filters by name.

- [ ] **Step 1: Create `shared/settings/icons.tsx`**

```tsx
// Dev-only icon browser. Gated by __DEV__ in nav and routes — never visible in production.
import * as Kb from '@/common-adapters'
import {iconMeta} from '@/common-adapters/icon.constants-gen.shared'
import type {IconType} from '@/common-adapters/icon.constants-gen.d'
import * as React from 'react'

const iconfontTypes: ReadonlyArray<IconType> = (Object.keys(iconMeta) as Array<IconType>)
  .filter(k => iconMeta[k].isFont)
  .sort()

const CELL_SIZE = 80

const IconCell = ({type}: {type: IconType}) => {
  const name = type.replace(/^iconfont-/, '')
  return (
    <Kb.Box2 direction="vertical" style={styles.cell} alignItems="center">
      <Kb.Icon type={type} sizeType="Big" />
      <Kb.Text type="BodyTiny" style={styles.cellLabel} lineClamp={2}>
        {name}
      </Kb.Text>
    </Kb.Box2>
  )
}

const Icons = () => {
  const [query, setQuery] = React.useState('')
  const filtered = query
    ? iconfontTypes.filter(t => t.includes(query.toLowerCase()))
    : iconfontTypes

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchRow}>
        <Kb.SearchFilter
          size="small"
          onChange={setQuery}
          placeholderText="Filter icons…"
          value={query}
        />
        <Kb.Text type="BodySmall" style={styles.count}>
          {filtered.length} / {iconfontTypes.length}
        </Kb.Text>
      </Kb.Box2>
      <Kb.ScrollView style={styles.scroll}>
        <Kb.Box2 direction="horizontal" style={styles.grid}>
          {filtered.map(t => (
            <IconCell key={t} type={t} />
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  cell: {
    height: CELL_SIZE,
    padding: Kb.Styles.globalMargins.xtiny,
    width: CELL_SIZE,
  },
  cellLabel: {
    color: Kb.Styles.globalColors.black_50,
    marginTop: 2,
    textAlign: 'center',
  },
  count: {
    color: Kb.Styles.globalColors.black_50,
    marginLeft: Kb.Styles.globalMargins.small,
  },
  grid: {
    flexWrap: 'wrap',
    padding: Kb.Styles.globalMargins.tiny,
  },
  scroll: {flex: 1},
  searchRow: {
    alignItems: 'center',
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    padding: Kb.Styles.globalMargins.small,
  },
}))

export default Icons
```

- [ ] **Step 2: Check that `Kb.SearchFilter` is the right component name**

```bash
cd shared
grep -r 'SearchFilter\|searchFilter' common-adapters/index.tsx | head -5
```

If `SearchFilter` is not exported from `@/common-adapters`, use `Kb.PlainInput` instead:

```tsx
<Kb.PlainInput
  value={query}
  onChangeText={setQuery}
  placeholder="Filter icons…"
  style={styles.searchInput}
/>
```

And add to styles:
```ts
searchInput: {
  borderColor: Kb.Styles.globalColors.black_10,
  borderRadius: 4,
  borderWidth: 1,
  flex: 1,
  padding: Kb.Styles.globalMargins.xtiny,
},
```

- [ ] **Step 3: Check that `sizeType="Big"` exists on `Kb.Icon`**

```bash
cd shared
grep -n 'sizeType\|Big' common-adapters/icon.tsx | head -10
```

If `sizeType` isn't a valid prop, replace with `fontSize={24}`.

- [ ] **Step 4: Run TypeScript check**

```bash
cd shared
yarn tsc --noEmit 2>&1 | grep icons
```

Expected: no errors in `settings/icons.tsx`

- [ ] **Step 5: Commit**

```bash
git add shared/settings/icons.tsx
git commit -m "settings: add dev-only icon browser screen"
```

---

## Task 5: Register the icon browser in settings routes and nav

**Files:**
- Modify: `shared/constants/settings.tsx`
- Modify: `shared/settings/routes.tsx`
- Modify: `shared/settings/root-phone.tsx`
- Modify: `shared/settings/sub-nav/left-nav.tsx`

The pattern to follow exactly mirrors how `settingsTypographyTab` and `typography.tsx` are wired up.

- [ ] **Step 1: Add constant to `shared/constants/settings.tsx`**

After line 23 (`export const settingsTypographyTab = ...`):

```ts
export const settingsIconsTab = 'settingsTabs.iconsTab'
```

- [ ] **Step 2: Add route to `shared/settings/routes.tsx`**

The typography block is at lines 134–137 (the `__DEV__` guard inside `sharedNewRoutes`). Add an adjacent entry immediately after the typography entry, before the closing of the `__DEV__` spread:

```ts
[Settings.settingsIconsTab]: {
  getOptions: {title: 'Icons'},
  screen: React.lazy(async () => import('./icons')),
},
```

Also at line 155 (the mobile-side `__DEV__` spread), add:

```ts
[Settings.settingsIconsTab]: sharedNewRoutes[Settings.settingsIconsTab],
```

Read the exact lines first to match the indentation and structure before editing.

- [ ] **Step 3: Add nav entry to `shared/settings/root-phone.tsx`**

Find the `__DEV__` block around line 183 that adds the Typography nav item. Add an Icons entry immediately after it:

```tsx
{__DEV__ && (
  <Kb.ClickableBox
    onClick={() => navigateAppend({name: Settings.settingsIconsTab, params: {}})}
  >
    <Kb.Text type="BodyBig">Icons</Kb.Text>
  </Kb.ClickableBox>
)}
```

Read the Typography entry first and match its exact JSX structure.

- [ ] **Step 4: Add nav entry to `shared/settings/sub-nav/left-nav.tsx`**

Find the `{__DEV__ && ...}` block around line 127 that renders the Typography nav link. Add an adjacent Icons block immediately after it:

```tsx
{__DEV__ && (
  <SubNav
    text="Icons"
    type={Settings.settingsIconsTab}
    selected={props.selected === Settings.settingsIconsTab}
  />
)}
```

Again read the Typography block first and match its exact JSX structure (the component name may differ from `SubNav`).

- [ ] **Step 5: Lint and type-check**

```bash
cd shared
yarn lint --quiet 2>&1 | grep -E 'icons|settings'
yarn tsc --noEmit 2>&1 | grep -E 'icons|settings'
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add shared/constants/settings.tsx shared/settings/routes.tsx \
        shared/settings/root-phone.tsx shared/settings/sub-nav/left-nav.tsx
git commit -m "settings: register dev-only icon browser in routes and nav"
```

---

## Self-review

**Spec coverage:**
- [x] Python build for `shared/fonts/kb.ttf` — Task 2
- [x] Python build for `shared/fonts/android/kb.ttf` — Tasks 2–3
- [x] Matches existing metrics (OS/2, hhea, GASP) — constants in Task 1, applied in Task 2
- [x] Yarn scripts `font:build-icon` / `font:build-icon-android` — Task 3
- [x] README updated — Task 3
- [x] Icon browser debug screen — Task 4
- [x] Screen registered behind `__DEV__` guard — Task 5

**Known tuning step (not in plan tasks):** If rendered icons look inverted or filled incorrectly, change `reverse_direction=False` to `reverse_direction=True` in `Cu2QuPen(...)` in `_build_icon_glyph`. This controls whether TrueType contour winding is reversed during cubic→quadratic conversion. The correct value depends on how the source SVGs specify fill direction.

**Placeholder check:** None — all steps include exact code or exact commands.
