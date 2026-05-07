#!/usr/bin/env python3
"""Keybase font tooling CLI."""

import argparse
import glob
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

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


def _draw_svg_path(d: str, pen) -> None:
    """Parse an SVG path `d` string and draw into a fonttools SegmentPen."""
    tokens = re.findall(
        r'[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?',
        d
    )
    idx = 0
    cmd = ''
    cx, cy = 0.0, 0.0
    prev_x2, prev_y2 = 0.0, 0.0
    contour_open = False

    def is_numeric(t: str) -> bool:
        return not re.match(r'[A-Za-z]', t)

    def has_nums(n: int) -> bool:
        if idx + n > len(tokens):
            return False
        return all(is_numeric(tokens[idx + i]) for i in range(n))

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

    _cmd_nums = {'M': 2, 'm': 2, 'L': 2, 'l': 2, 'H': 1, 'h': 1, 'V': 1, 'v': 1,
                 'C': 6, 'c': 6, 'S': 4, 's': 4, 'Q': 4, 'q': 4, 'T': 2, 't': 2}

    while idx < len(tokens):
        t = tokens[idx]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            idx += 1
        elif cmd in _cmd_nums and not has_nums(_cmd_nums[cmd]):
            # Implicit repeat but next token is a command letter — stop repeating.
            continue

        if cmd in ('M', 'm'):
            ensure_closed()
            x, y = nums(2)
            if cmd == 'm':
                x, y = cx + x, cy + y
            pen.moveTo((x, y))
            contour_open = True
            cx, cy = x, y
            prev_x2, prev_y2 = cx, cy
            # Subsequent coords in an M sequence are implicit L/l
            cmd = 'L' if cmd == 'M' else 'l'
        elif cmd in ('L', 'l'):
            x, y = nums(2)
            if cmd == 'l':
                x, y = cx + x, cy + y
            pen.lineTo((x, y))
            cx, cy = x, y
            prev_x2, prev_y2 = cx, cy
        elif cmd in ('H', 'h'):
            x, = nums(1)
            if cmd == 'h':
                x = cx + x
            pen.lineTo((x, cy))
            cx = x
            prev_x2, prev_y2 = cx, cy
        elif cmd in ('V', 'v'):
            y, = nums(1)
            if cmd == 'v':
                y = cy + y
            pen.lineTo((cx, y))
            cy = y
            prev_x2, prev_y2 = cx, cy
        elif cmd in ('C', 'c'):
            x1, y1, x2, y2, x, y = nums(6)
            if cmd == 'c':
                x1, y1 = cx + x1, cy + y1
                x2, y2 = cx + x2, cy + y2
                x, y = cx + x, cy + y
            pen.curveTo((x1, y1), (x2, y2), (x, y))
            cx, cy = x, y
            prev_x2, prev_y2 = x2, y2
        elif cmd in ('S', 's'):
            x2_rel, y2_rel, x_rel, y_rel = nums(4)
            if cmd == 's':
                x2_final = cx + x2_rel
                y2_final = cy + y2_rel
                x_final = cx + x_rel
                y_final = cy + y_rel
            else:
                x2_final, y2_final = x2_rel, y2_rel
                x_final, y_final = x_rel, y_rel
            x1_final = 2 * cx - prev_x2
            y1_final = 2 * cy - prev_y2
            pen.curveTo((x1_final, y1_final), (x2_final, y2_final), (x_final, y_final))
            prev_x2, prev_y2 = x2_final, y2_final
            cx, cy = x_final, y_final
        elif cmd in ('Z', 'z'):
            if contour_open:
                pen.closePath()
                contour_open = False
            prev_x2, prev_y2 = cx, cy
        else:
            idx += 1  # unknown command, skip

    ensure_closed()


def _build_icon_glyph(svg_path: str, size: int) -> tuple:
    """
    Parse one SVG icon file and return (TTGlyph, advance_width, lsb).
    size is the icon grid size (8, 16, or 24).
    """
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.pens.cu2quPen import Cu2QuPen

    scale = _ICON_FONT_HEIGHT / size
    # SVG y=0 (top) maps to TYPO_ASCENT; 24-size icons shift lower to match original fontforge placement
    y_shift = _ICON_TYPO_ASCENT
    if size == 24:
        y_shift -= _ICON_24_EXTRA_SHIFT

    tt_pen = TTGlyphPen(None)
    cu2qu_pen = Cu2QuPen(tt_pen, max_err=1.0, reverse_direction=False)

    ns = 'http://www.w3.org/2000/svg'
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Build a parent map so we can walk up from <path> to collect <g transform="translate(...)">
    parent_map = {child: parent for parent in root.iter() for child in parent}

    _translate_re = re.compile(r'translate\(\s*([-\d.]+)(?:[,\s]\s*([-\d.]+))?\s*\)')

    for elem in root.iter(f'{{{ns}}}path'):
        d = elem.get('d', '').strip()
        if not d:
            continue

        # Accumulate translate offsets from ancestor <g> elements (innermost first)
        tx, ty = 0.0, 0.0
        node = parent_map.get(elem)
        while node is not None and node is not root:
            t_attr = node.get('transform', '')
            if t_attr:
                m = _translate_re.search(t_attr)
                if m:
                    tx += float(m.group(1))
                    ty += float(m.group(2) or 0)
            node = parent_map.get(node)

        # Compose SVG translate into the scale+flip affine matrix:
        #   x_font = (x_svg + tx) * scale
        #   y_font = y_shift - (y_svg + ty) * scale
        transform_pen = TransformPen(cu2qu_pen, (scale, 0, 0, -scale, tx * scale, y_shift - ty * scale))
        _draw_svg_path(d, transform_pen)

    advance_width = int(round(size * scale))  # = 1024 for all sizes
    glyph = tt_pen.glyph(dropImpliedOnCurves=True)
    if glyph.numberOfContours != 0:
        glyph.recalcBounds(None)
        lsb = glyph.xMin
    else:
        lsb = 0
    return glyph, advance_width, lsb


def _ttfont(path: str):
    from fontTools.ttLib import TTFont
    return TTFont(path)


def _os2_flags(os2):
    flags = {}
    fs_selection = os2.fsSelection
    flags["USE_TYPO_METRICS"] = bool(fs_selection & (1 << 7))
    flags["WOFF_OBLIQUE"] = bool(fs_selection & (1 << 9))
    return flags


def inspect_font(path: str) -> dict:
    font = _ttfont(path)

    result: dict = {"path": path, "tables": {}}

    # name table
    name_table = font["name"]
    names = {}
    for record in name_table.names:
        try:
            val = record.toUnicode()
        except Exception:
            continue
        key = f"{record.nameID}"
        if key not in names:
            names[key] = val
    result["tables"]["name"] = names

    # head
    head = font["head"]
    result["tables"]["head"] = {
        "unitsPerEm": head.unitsPerEm,
        "macStyle": head.macStyle,
        "lowestRecPPEM": head.lowestRecPPEM,
        "indexToLocFormat": head.indexToLocFormat,
    }

    # hhea
    hhea = font["hhea"]
    result["tables"]["hhea"] = {
        "ascender": hhea.ascender,
        "descender": hhea.descender,
        "lineGap": hhea.lineGap,
        "caretSlopeRise": hhea.caretSlopeRise,
        "caretSlopeRun": hhea.caretSlopeRun,
    }

    # OS/2
    os2 = font["OS/2"]
    result["tables"]["OS/2"] = {
        "version": os2.version,
        "xAvgCharWidth": os2.xAvgCharWidth,
        "usWeightClass": os2.usWeightClass,
        "usWidthClass": os2.usWidthClass,
        "fsType": os2.fsType,
        "sTypoAscender": os2.sTypoAscender,
        "sTypoDescender": os2.sTypoDescender,
        "sTypoLineGap": os2.sTypoLineGap,
        "usWinAscent": os2.usWinAscent,
        "usWinDescent": os2.usWinDescent,
        "ySubscriptXSize": os2.ySubscriptXSize,
        "ySubscriptYSize": os2.ySubscriptYSize,
        "ySubscriptXOffset": os2.ySubscriptXOffset,
        "ySubscriptYOffset": os2.ySubscriptYOffset,
        "ySuperscriptXSize": os2.ySuperscriptXSize,
        "ySuperscriptYSize": os2.ySuperscriptYSize,
        "ySuperscriptXOffset": os2.ySuperscriptXOffset,
        "ySuperscriptYOffset": os2.ySuperscriptYOffset,
        "yStrikeoutSize": os2.yStrikeoutSize,
        "yStrikeoutPosition": os2.yStrikeoutPosition,
        "sFamilyClass": os2.sFamilyClass,
        "fsSelection": os2.fsSelection,
        "flags": _os2_flags(os2),
        "sxHeight": getattr(os2, "sxHeight", None),
        "sCapHeight": getattr(os2, "sCapHeight", None),
        "usDefaultChar": getattr(os2, "usDefaultChar", None),
        "usBreakChar": getattr(os2, "usBreakChar", None),
        "usMaxContext": getattr(os2, "usMaxContext", None),
    }

    # post
    post = font["post"]
    result["tables"]["post"] = {
        "formatType": post.formatType,
        "italicAngle": post.italicAngle,
        "underlinePosition": post.underlinePosition,
        "underlineThickness": post.underlineThickness,
        "isFixedPitch": post.isFixedPitch,
    }

    # gasp
    if "gasp" in font:
        gasp = font["gasp"]
        result["tables"]["gasp"] = {
            "version": gasp.version,
            "gaspRange": {str(k): v for k, v in gasp.gaspRange.items()},
        }

    # cmap: summarize platform/encoding entries
    cmap_table = font["cmap"]
    cmap_entries = []
    for table in cmap_table.tables:
        cmap_entries.append({
            "platformID": table.platformID,
            "platEncID": table.platEncID,
            "format": table.format,
            "numGlyphs": len(table.cmap),
        })
    result["tables"]["cmap"] = cmap_entries

    # glyph count and bounds summary
    glyf = font.get("glyf")
    glyph_order = font.getGlyphOrder()
    result["glyphCount"] = len(glyph_order)
    if glyf is not None:
        bounds_list = []
        for name in glyph_order:
            g = glyf[name]
            if hasattr(g, "xMin") and g.numberOfContours != 0:
                bounds_list.append((g.xMin, g.yMin, g.xMax, g.yMax))
        if bounds_list:
            result["glyphBoundsSummary"] = {
                "xMin": min(b[0] for b in bounds_list),
                "yMin": min(b[1] for b in bounds_list),
                "xMax": max(b[2] for b in bounds_list),
                "yMax": max(b[3] for b in bounds_list),
            }

    # GSUB/GPOS presence
    result["tables"]["GSUB"] = "present" if "GSUB" in font else "absent"
    result["tables"]["GPOS"] = "present" if "GPOS" in font else "absent"

    font.close()
    return result


def _metric_snapshot(path: str) -> dict:
    """Extract the metrics we care about from a single font."""
    font = _ttfont(path)
    os2 = font["OS/2"]
    hhea = font["hhea"]
    post = font["post"]
    head = font["head"]
    snapshot = {
        "unitsPerEm": head.unitsPerEm,
        "hhea": {
            "ascender": hhea.ascender,
            "descender": hhea.descender,
            "lineGap": hhea.lineGap,
        },
        "OS/2": {
            "sTypoAscender": os2.sTypoAscender,
            "sTypoDescender": os2.sTypoDescender,
            "sTypoLineGap": os2.sTypoLineGap,
            "usWinAscent": os2.usWinAscent,
            "usWinDescent": os2.usWinDescent,
            "yStrikeoutPosition": os2.yStrikeoutPosition,
            "yStrikeoutSize": os2.yStrikeoutSize,
            "usWeightClass": os2.usWeightClass,
            "fsSelection": os2.fsSelection,
            "USE_TYPO_METRICS": bool(os2.fsSelection & (1 << 7)),
            "sxHeight": getattr(os2, "sxHeight", None),
            "sCapHeight": getattr(os2, "sCapHeight", None),
        },
        "post": {
            "underlinePosition": post.underlinePosition,
            "underlineThickness": post.underlineThickness,
            "italicAngle": post.italicAngle,
        },
    }
    font.close()
    return snapshot


def cmd_snapshot_metrics(args):
    manifest = json.loads(Path(args.manifest).read_text())
    metrics: dict = {"_comment": "Generated snapshot — do not edit by hand. Run: yarn font:snapshot-metrics", "fonts": {}}

    entries = manifest.get("textFonts", [])
    icon = manifest.get("iconFont")
    if icon:
        entries = entries + [{"id": icon["id"], "source": icon["output"]}]

    repo_root = Path(args.manifest).resolve().parent.parent.parent  # shared/fonts/manifest.json -> repo root
    for entry in entries:
        src = repo_root / entry["source"]
        if not src.exists():
            print(f"WARNING: {src} not found, skipping", file=sys.stderr)
            continue
        metrics["fonts"][entry["id"]] = _metric_snapshot(str(src))

    output = json.dumps(metrics, indent=2)
    Path(args.output).write_text(output)
    print(f"Wrote {args.output}", file=sys.stderr)


def cmd_diff_metrics(args):
    """Summarize changed font table values between two directories."""
    before_dir = Path(args.before)
    after_dir = Path(args.after)

    before_files = {p.name: p for p in sorted(before_dir.glob("*.ttf"))}
    after_files = {p.name: p for p in sorted(after_dir.glob("*.ttf"))}

    all_names = sorted(before_files.keys() | after_files.keys())
    diffs: list = []

    for name in all_names:
        if name not in before_files:
            diffs.append({"font": name, "status": "added"})
            continue
        if name not in after_files:
            diffs.append({"font": name, "status": "removed"})
            continue

        b = _metric_snapshot(str(before_files[name]))
        a = _metric_snapshot(str(after_files[name]))
        changes = _diff_snapshots(b, a)
        if changes:
            diffs.append({"font": name, "changes": changes})

    output = json.dumps(diffs, indent=2)
    if args.output == "-":
        print(output)
    else:
        Path(args.output).write_text(output)
        print(f"Wrote {args.output}", file=sys.stderr)

    if not diffs:
        print("No metric differences found.", file=sys.stderr)


def _diff_snapshots(before: dict, after: dict, prefix: str = "") -> list:
    changes = []
    for key, bval in before.items():
        aval = after.get(key)
        full_key = f"{prefix}{key}" if not prefix else f"{prefix}.{key}"
        if isinstance(bval, dict):
            changes.extend(_diff_snapshots(bval, aval or {}, full_key))
        elif bval != aval:
            changes.append({"field": full_key, "before": bval, "after": aval})
    for key in after:
        if key not in before:
            full_key = f"{prefix}{key}" if not prefix else f"{prefix}.{key}"
            changes.append({"field": full_key, "before": None, "after": after[key]})
    return changes


FS_SELECTION_USE_TYPO_METRICS = 1 << 7


def _apply_patches(font, patches: dict) -> list[str]:
    """Apply buildConfig patches to an open TTFont. Returns list of change descriptions."""
    changes = []
    os2_patches = patches.get("OS/2", {})
    if os2_patches:
        os2 = font["OS/2"]
        if "USE_TYPO_METRICS" in os2_patches:
            target = bool(os2_patches["USE_TYPO_METRICS"])
            current = bool(os2.fsSelection & FS_SELECTION_USE_TYPO_METRICS)
            if target != current:
                if target:
                    os2.fsSelection |= FS_SELECTION_USE_TYPO_METRICS
                else:
                    os2.fsSelection &= ~FS_SELECTION_USE_TYPO_METRICS
                changes.append(f"OS/2.fsSelection USE_TYPO_METRICS → {target}")
        for field in ("sTypoAscender", "sTypoDescender", "sTypoLineGap",
                      "usWinAscent", "usWinDescent",
                      "yStrikeoutPosition", "yStrikeoutSize",
                      "sxHeight", "sCapHeight"):
            if field in os2_patches:
                old = getattr(os2, field)
                setattr(os2, field, os2_patches[field])
                if old != os2_patches[field]:
                    changes.append(f"OS/2.{field}: {old} → {os2_patches[field]}")
    hhea_patches = patches.get("hhea", {})
    if hhea_patches:
        hhea = font["hhea"]
        for field in ("ascender", "descender", "lineGap"):
            if field in hhea_patches:
                old = getattr(hhea, field)
                setattr(hhea, field, hhea_patches[field])
                if old != hhea_patches[field]:
                    changes.append(f"hhea.{field}: {old} → {hhea_patches[field]}")
    post_patches = patches.get("post", {})
    if post_patches:
        post = font["post"]
        for field in ("underlinePosition", "underlineThickness"):
            if field in post_patches:
                old = getattr(post, field)
                setattr(post, field, post_patches[field])
                if old != post_patches[field]:
                    changes.append(f"post.{field}: {old} → {post_patches[field]}")
    return changes


def cmd_build_text(args):
    import shutil
    manifest = json.loads(Path(args.manifest).read_text())
    repo_root = Path(args.manifest).resolve().parent.parent.parent
    build_cfg = manifest.get("buildConfig", {})
    platform: str = args.platform

    if platform == "android":
        out_dir = repo_root / build_cfg.get("androidOutputDir", "shared/fonts/generated/android")
    else:
        out_dir = repo_root / build_cfg.get("outputDir", "shared/fonts/generated")

    global_patches = build_cfg.get("patches", {})
    out_dir.mkdir(parents=True, exist_ok=True)

    errors = 0
    for entry in manifest.get("textFonts", []):
        src = repo_root / entry["source"]
        if not src.exists():
            print(f"ERROR: source not found: {src}", file=sys.stderr)
            errors += 1
            continue
        dest = out_dir / src.name
        font = _ttfont(str(src))
        per_font_patches: dict = entry.get("patches", {})
        if platform == "android":
            android_patches: dict = entry.get("androidPatches", {})
            per_font_patches = {
                table: {**per_font_patches.get(table, {}), **android_patches.get(table, {})}
                for table in set(list(per_font_patches.keys()) + list(android_patches.keys()))
            }
        merged: dict = {}
        for table in set(list(global_patches.keys()) + list(per_font_patches.keys())):
            merged[table] = {**global_patches.get(table, {}), **per_font_patches.get(table, {})}
        changes = _apply_patches(font, merged)
        font.save(str(dest))
        font.close()
        tag = f"  [{', '.join(changes)}]" if changes else "  (no changes)"
        print(f"  {src.name} → {dest}{tag}", file=sys.stderr)

        # Copy to platform destinations where the target directory exists.
        # For android platform, use the "android" output key; otherwise copy to all
        # non-android outputs (ios + electron) when building the default platform.
        outputs: dict = entry.get("outputs", {})
        electron_patches: dict = entry.get("electronPatches", {})
        copy_keys = ["android"] if platform == "android" else [k for k in outputs if k != "android"]
        for key in copy_keys:
            out_path_rel = outputs.get(key)
            if not out_path_rel:
                continue
            out_path = repo_root / out_path_rel
            if out_path == dest:
                continue  # already the staging dest
            out_path.parent.mkdir(parents=True, exist_ok=True)
            if key == "electron" and electron_patches and platform != "android":
                efont = _ttfont(str(dest))
                echanges = _apply_patches(efont, electron_patches)
                efont.save(str(out_path))
                efont.close()
                etag = f"  [{', '.join(echanges)}]" if echanges else ""
                print(f"    → {key}: {out_path}{etag}", file=sys.stderr)
            elif out_path.parent.exists():
                shutil.copy2(str(dest), str(out_path))
                print(f"    → {key}: {out_path}", file=sys.stderr)

    if errors:
        print(f"build-text: {errors} error(s)", file=sys.stderr)
        sys.exit(1)
    else:
        # Touch a sentinel file so webpack's filesystem cache knows fonts changed.
        sentinel = repo_root / "shared" / "fonts" / ".font-build-stamp"
        sentinel.write_text(str(time.time()) + "\n")
        print(f"build-text: wrote {out_dir}", file=sys.stderr)


def cmd_build_icon(args):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.ttLib.tables._g_l_y_f import Glyph as TTGlyph

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
        counter, name, size = int(m.group(1)), m.group(2), int(m.group(3))
        entries.append((counter, name, size, svg_file))
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
        "fullName": "kb",
        "psName": "kb",
    })
    fb.setupOS2(
        sTypoAscender=_ICON_TYPO_ASCENT,
        sTypoDescender=_ICON_TYPO_DESCENT,
        sTypoLineGap=0,
        usWinAscent=_ICON_WIN_ASCENT,
        usWinDescent=_ICON_WIN_DESCENT,
        fsType=0,
        fsSelection=0,
    )
    fb.setupPost(keepGlyphNames=False)
    from fontTools.ttLib.tables._g_a_s_p import table__g_a_s_p
    gasp = table__g_a_s_p()
    gasp.version = 1
    gasp.gaspRange = {65535: 15}
    fb.font["gasp"] = gasp

    # Determine output paths from manifest iconFont config
    outputs = icon_cfg.get("outputs", [icon_cfg.get("output", "")])
    if isinstance(outputs, str):
        outputs = [outputs]

    platform: str = args.platform
    android_output = icon_cfg.get("androidOutput", "")

    wrote = []
    if platform == "android":
        if android_output:
            out_path = repo_root / android_output
            out_path.parent.mkdir(parents=True, exist_ok=True)
            fb.font.save(str(out_path))
            wrote.append(str(out_path))
        else:
            print("WARNING: --platform android but iconFont.androidOutput not set in manifest", file=sys.stderr)
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
    if wrote:
        sentinel = repo_root / "shared" / "fonts" / ".font-build-stamp"
        sentinel.write_text(str(time.time()) + "\n")


def cmd_verify_text(args):
    manifest = json.loads(Path(args.manifest).read_text())
    expected = json.loads(Path(args.metrics).read_text())
    repo_root = Path(args.manifest).resolve().parent.parent.parent

    # verify-text checks the generated dir if it exists, otherwise the source
    build_cfg = manifest.get("buildConfig", {})
    generated_dir = repo_root / build_cfg.get("outputDir", "shared/fonts/generated")

    failures: list[str] = []
    checked = 0
    for entry in manifest.get("textFonts", []):
        font_id = entry["id"]
        if font_id not in expected.get("fonts", {}):
            print(f"  SKIP {font_id}: not in metrics.json", file=sys.stderr)
            continue
        src = repo_root / entry["source"]
        generated = generated_dir / Path(entry["source"]).name
        path = generated if generated.exists() else src
        if not path.exists():
            failures.append(f"{font_id}: source not found at {path}")
            continue
        actual = _metric_snapshot(str(path))
        exp = expected["fonts"][font_id]
        mismatches = _diff_snapshots(exp, actual)
        if mismatches:
            for m in mismatches:
                failures.append(f"{font_id}: {m['field']} expected={m['before']} got={m['after']}")
        else:
            print(f"  OK  {font_id} ({path.name})", file=sys.stderr)
        checked += 1

    if failures:
        print(f"\nverify-text: {len(failures)} failure(s):", file=sys.stderr)
        for f in failures:
            print(f"  FAIL {f}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"verify-text: all {checked} fonts pass", file=sys.stderr)


def cmd_inspect(args):
    inputs: list[str] = []
    for pattern in args.inputs:
        expanded = glob.glob(pattern)
        if expanded:
            inputs.extend(expanded)
        else:
            inputs.append(pattern)

    results = []
    for path in sorted(inputs):
        try:
            results.append(inspect_font(path))
        except Exception as e:
            results.append({"path": path, "error": str(e)})

    output = json.dumps(results, indent=2)
    if args.output == "-":
        print(output)
    else:
        Path(args.output).write_text(output)
        print(f"Wrote {args.output}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(
        prog="font_tool",
        description="Keybase font tooling",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_inspect = sub.add_parser("inspect", help="Inspect fonts and emit table data as JSON")
    p_inspect.add_argument("--inputs", nargs="+", required=True, metavar="PATTERN",
                           help="Font file paths or glob patterns")
    p_inspect.add_argument("--output", default="-", metavar="FILE",
                           help="Output JSON file (default: stdout)")
    p_inspect.set_defaults(func=cmd_inspect)

    p_build = sub.add_parser("build-text", help="Build text fonts from canonical inputs")
    p_build.add_argument("--manifest", required=True, metavar="FILE")
    p_build.add_argument("--platform", default="all", choices=["all", "android"],
                         help="Target platform (default: all; 'android' applies androidPatches)")
    p_build.set_defaults(func=cmd_build_text)

    p_verify = sub.add_parser("verify-text", help="Verify text fonts against manifest and metrics")
    p_verify.add_argument("--manifest", required=True, metavar="FILE")
    p_verify.add_argument("--metrics", required=True, metavar="FILE")
    p_verify.set_defaults(func=cmd_verify_text)

    p_snap = sub.add_parser("snapshot-metrics", help="Generate metrics.json from current fonts")
    p_snap.add_argument("--manifest", required=True, metavar="FILE",
                        help="Path to shared/fonts/manifest.json")
    p_snap.add_argument("--output", required=True, metavar="FILE",
                        help="Output metrics JSON file")
    p_snap.set_defaults(func=cmd_snapshot_metrics)

    p_diff = sub.add_parser("diff-metrics", help="Summarize changed font table values between two directories")
    p_diff.add_argument("--before", required=True, metavar="DIR", help="Directory with original TTFs")
    p_diff.add_argument("--after", required=True, metavar="DIR", help="Directory with new TTFs")
    p_diff.add_argument("--output", default="-", metavar="FILE",
                        help="Output JSON file (default: stdout)")
    p_diff.set_defaults(func=cmd_diff_metrics)

    p_icon = sub.add_parser("build-icon", help="Build kb.ttf icon font from SVGs")
    p_icon.add_argument("--manifest", required=True, metavar="FILE")
    p_icon.add_argument("--platform", default="all", choices=["all", "android"],
                        help="Target platform (default: all; 'android' writes androidOutput)")
    p_icon.set_defaults(func=cmd_build_icon)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
