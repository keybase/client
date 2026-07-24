#!/usr/bin/env python3
"""Compare RPC counts between two runs, to prove a fix landed.

  python3 rpc-diff.py before.log after.log [--top 30]

Counts app->service and service->server calls in each and prints the change.
Only meaningful if both runs did the same thing - e.g. the same e2e suite.
"""

import argparse
import collections

import kblog


def counts(path):
    app, remote = collections.Counter(), collections.Counter()
    for line in kblog.iter_lines([path]):
        m = kblog.SERVER_RE.search(line)
        if m:
            app[m.group(1)] += 1
        m = kblog.REMOTE_RE.search(line)
        if m:
            remote[m.group(1)] += 1
    return app, remote


def show(title, before, after, top):
    keys = set(before) | set(after)
    rows = []
    for k in keys:
        b, a = before.get(k, 0), after.get(k, 0)
        rows.append((a - b, b, a, k))
    rows.sort(key=lambda r: abs(r[0]), reverse=True)
    print(f"\n== {title}   before {sum(before.values())} -> after {sum(after.values())}")
    print(f"{'delta':>8} {'before':>8} {'after':>8}  call")
    for delta, b, a, k in rows[:top]:
        if delta == 0:
            continue
        mark = "  <-- gone" if a == 0 and b else ("  <-- new" if b == 0 else "")
        print(f"{delta:+8d} {b:8d} {a:8d}  {k}{mark}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("before")
    ap.add_argument("after")
    ap.add_argument("--top", type=int, default=30)
    args = ap.parse_args()

    ba, br = counts(args.before)
    aa, ar = counts(args.after)
    show("REMOTE  service -> keybase servers", br, ar, args.top)
    show("APP  app -> service", ba, aa, args.top)


if __name__ == "__main__":
    main()
