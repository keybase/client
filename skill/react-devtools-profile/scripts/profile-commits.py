#!/usr/bin/env python3
"""Per-commit detail of a React DevTools Profiler export: full updater list, fiber
count, top fibers by self duration with ancestor paths, changeDescriptions when the
profile was recorded with 'Record why each component rendered'."""

import argparse

from rdtlib import load, root_info, fiber_path, updater_names

ap = argparse.ArgumentParser()
ap.add_argument("profile")
ap.add_argument("--root", type=int, default=0, help="index into dataForRoots")
ap.add_argument("--commit", type=int, help="only this commit index")
ap.add_argument("--top", type=int, default=10, help="fibers shown per commit")
args = ap.parse_args()

data = load(args.profile)
r = data["dataForRoots"][args.root]
commits = r["commitData"]
names, parents = root_info(r)

ts0 = commits[0]["timestamp"]
for i, c in enumerate(commits):
    if args.commit is not None and i != args.commit:
        continue
    print(f"\n--- commit {i} t={c['timestamp'] - ts0:.0f}ms dur={c['duration']:.2f}ms prio={c.get('priorityLevel')}")
    print("  updaters:", ", ".join(updater_names(c)))
    rendered = c.get("fiberActualDurations", [])
    print(f"  fibers rendered: {len(rendered)}")
    for fid, d in sorted(c.get("fiberSelfDurations", []), key=lambda kv: -kv[1])[: args.top]:
        print(f"    {d:6.2f}ms  {fiber_path(fid, names, parents)}")
    cds = c.get("changeDescriptions")
    if not cds:
        print("  changeDescriptions: not recorded (enable 'Record why each component rendered')")
    else:
        print("  why (changeDescriptions):")
        for fid, cd in cds:
            bits = []
            if cd.get("isFirstMount"):
                bits.append("mount")
            if cd.get("props"):
                bits.append("props:" + ",".join(map(str, cd["props"])))
            if cd.get("state"):
                bits.append("state:" + ",".join(map(str, cd["state"])))
            if cd.get("hooks"):
                bits.append("hooks:" + ",".join(map(str, cd["hooks"])))
            if cd.get("context"):
                bits.append("context")
            print(f"    {names.get(fid, f'#{fid}')}#{fid}: {' '.join(bits) or cd}")
