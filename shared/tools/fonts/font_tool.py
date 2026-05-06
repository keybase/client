#!/usr/bin/env python3
"""Keybase font tooling CLI."""

import argparse
import glob
import json
import sys
from pathlib import Path


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

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
