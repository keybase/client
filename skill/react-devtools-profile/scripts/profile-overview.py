#!/usr/bin/env python3
"""Overview of a React DevTools Profiler export: commit totals, top commits with
their updaters, top components by aggregate self duration, commit timeline."""

import argparse
from collections import defaultdict

from rdtlib import load, root_info, updater_names

ap = argparse.ArgumentParser()
ap.add_argument("profile")
ap.add_argument("--top", type=int, default=25, help="rows in component ranking")
ap.add_argument("--bucket-ms", type=int, default=500, help="timeline bucket size")
args = ap.parse_args()

data = load(args.profile)
print("version:", data.get("version"))
roots = data["dataForRoots"]
print("roots:", len(roots))

for r in roots:
    commits = r["commitData"]
    if not commits:
        continue
    print(f"\n=== root {r.get('rootID')} displayName={r.get('displayName')} commits={len(commits)} ===")
    names, _ = root_info(r)

    total = sum(c["duration"] for c in commits)
    eff = sum(c.get("effectDuration") or 0 for c in commits)
    passive = sum(c.get("passiveEffectDuration") or 0 for c in commits)
    ts0 = commits[0]["timestamp"]
    print(f"total commit render time: {total:.1f}ms  effects:{eff:.1f}ms passive:{passive:.1f}ms")
    print(f"span: {commits[-1]['timestamp'] - ts0:.0f}ms")

    print("\ntop 15 commits by duration (#N = index for profile-commits.py --commit):")
    for i, c in sorted(enumerate(commits), key=lambda ic: -ic[1]["duration"])[:15]:
        ups = ",".join(n.split("#")[0] for n in updater_names(c))[:60]
        print(
            f"  #{i:<3d} t={c['timestamp'] - ts0:7.0f}ms dur={c['duration']:7.2f}ms"
            f" eff={(c.get('effectDuration') or 0):6.2f} passive={(c.get('passiveEffectDuration') or 0):6.2f}"
            f" prio={c.get('priorityLevel')} updaters={ups}"
        )

    self_tot = defaultdict(float)
    self_cnt = defaultdict(int)
    for c in commits:
        for fid, d in c.get("fiberSelfDurations", []):
            n = names.get(fid, f"fiber{fid}")
            self_tot[n] += d
            self_cnt[n] += 1
    print(f"\ntop {args.top} components by total self duration (all commits):")
    for n, d in sorted(self_tot.items(), key=lambda kv: -kv[1])[: args.top]:
        print(f"  {d:8.1f}ms  x{self_cnt[n]:4d}  {n}")

    print(f"\ncommit timeline (per {args.bucket_ms}ms bucket: count / total ms):")
    buckets = defaultdict(lambda: [0, 0.0])
    for c in commits:
        b = int((c["timestamp"] - ts0) // args.bucket_ms)
        buckets[b][0] += 1
        buckets[b][1] += c["duration"]
    for b in sorted(buckets):
        cnt, d = buckets[b]
        print(f"  {b * args.bucket_ms:6d}-{(b + 1) * args.bucket_ms:6d}ms: {cnt:3d} commits {d:7.1f}ms")
