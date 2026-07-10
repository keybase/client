#!/usr/bin/env python3
"""Overview of a DevTools Performance trace: processes, main thread, long tasks,
X-event category totals. Run this first; it prints the pid/tid that
trace-samples.py will auto-pick."""
import argparse
from collections import Counter

import tracelib

ap = argparse.ArgumentParser(description=__doc__)
tracelib.add_common_args(ap)
ap.add_argument('--long-ms', type=float, default=50, help='long-task threshold (ms)')
ap.add_argument('--top', type=int, default=30, help='rows per report')
args = ap.parse_args()

ev = tracelib.load(args.trace)
procs, threads = tracelib.meta(ev)

print('processes:', procs)
renderer_mains = [k for k, n in threads.items() if n == 'CrRendererMain']
print('renderer mains:', renderer_mains)

ts_all = [e['ts'] for e in ev if e.get('ts')]
t0, t1 = min(ts_all), max(ts_all)
print(f'trace span: {(t1 - t0) / 1e6:.2f}s')

main = tracelib.resolve_main(ev, args)
print('MAIN (pid, tid):', main)

mainev = [e for e in ev if e.get('pid') == main[0] and e.get('tid') == main[1]]
print('main thread events:', len(mainev))

tasks = [e for e in mainev if e.get('ph') == 'X' and e['name'] == 'RunTask']
tasks.sort(key=lambda e: -e.get('dur', 0))
thresh = args.long_ms * 1000
print(f'\nlong tasks >{args.long_ms:g}ms:', sum(1 for e in tasks if e.get('dur', 0) > thresh))
print(f'top {args.top} tasks (ms, t_offset_s):')
for e in tasks[:args.top]:
    print(f"  {e['dur'] / 1000:8.1f}ms  t={(e['ts'] - t0) / 1e6:7.2f}s")

# nested-inclusive, so totals overlap; judge relative shape not sum
names = Counter()
for e in mainev:
    if e.get('ph') == 'X':
        names[e['name']] += e.get('dur', 0)
print(f'\ntop {args.top} X-event names by total dur (ms, nested-inclusive):')
for n, t in names.most_common(args.top):
    print(f'  {t / 1000:10.1f}  {n}')
