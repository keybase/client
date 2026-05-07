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
        sentinel.write_text(str(__import__('time').time()) + "\n")
        print(f"build-text: wrote {out_dir}", file=sys.stderr)


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

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
