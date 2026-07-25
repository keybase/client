#!/usr/bin/env python3
"""Summarize RPC traffic in a keybase service log.

  python3 rpc-report.py <log>... [--start 2026-07-24T17:23] [--end ...] [--top N]

Sections, in the order worth reading:
  REMOTE     service -> keybase servers. These burn the server rate limits.
  APP        app -> service. One of these usually explains a REMOTE row.
  HTTP       raw API calls.
  BURSTS     same RPC, same args, >=3 times inside one second. Missing dedupe.
  FLOODS     most repeated log lines overall, after collapsing ids/numbers.
"""

import argparse
import collections
import sys

import kblog


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("logs", nargs="+")
    ap.add_argument("--start", help="timestamp prefix, e.g. 2026-07-24T17:23")
    ap.add_argument("--end")
    ap.add_argument("--top", type=int, default=25)
    ap.add_argument("--burst-min", type=int, default=3, help="calls in one second to flag")
    args = ap.parse_args()

    app = collections.Counter()
    remote = collections.Counter()
    http = collections.Counter()
    floods = collections.Counter()
    per_second = collections.defaultdict(collections.Counter)  # sec -> (rpc, arg) -> n
    # Many RPCs log no arguments, so "same call twice in a second" would not prove
    # it was the same conversation. Recover the subject by correlating on the
    # chat-trace: the first id that shows up on the trace is what the call was for.
    pending = {}  # trace -> (second, rpc name)
    uid = None  # learned from the log, then excluded when guessing subjects
    total = 0
    first = last = None

    for line in kblog.iter_lines(args.logs, args.start, args.end):
        total += 1
        ts = kblog.stamp(line)
        if ts and ts.startswith("2"):
            # min/max, not first/last seen: rotated files are often concatenated
            # or globbed out of order, and stream order would report a range of
            # zero width
            first = ts if first is None or ts < first else first
            last = ts if last is None or ts > last else last
        floods[kblog.normalize(line)] += 1

        if uid is None:
            u = kblog.UID_RE.search(line)
            if u:
                uid = u.group(1)

        tr = kblog.trace(line)
        m = kblog.SERVER_RE.search(line)
        if m:
            name, arg = m.group(1), (m.group(2) or "")
            app[name] += 1
            if ts and arg:
                per_second[ts][(name, arg[:60])] += 1
            elif ts and tr:
                pending[tr] = (ts, name)
            elif ts:
                per_second[ts][(name, "")] += 1
        elif tr and tr in pending:
            subject = kblog.subject_of(line, uid)
            if subject:
                sec, name = pending.pop(tr)
                per_second[sec][(name, f"({subject[:16]})")] += 1
        m = kblog.REMOTE_RE.search(line)
        if m:
            remote[m.group(1)] += 1
        m = kblog.HTTP_RE.search(line)
        if m:
            http[m.group(2)[:80]] += 1

    if not total:
        sys.exit("no lines matched (check --start/--end)")

    print(f"{total} lines  {first} .. {last}")

    def section(title, counter, note=""):
        if not counter:
            return
        print(f"\n== {title}  (total {sum(counter.values())}) {note}")
        for k, v in counter.most_common(args.top):
            print(f"{v:8d}  {k}")

    section("REMOTE  service -> keybase servers", remote, "<- rate-limited")
    section("APP  app -> service", app)
    section("HTTP", http)

    bursts = collections.Counter()
    for sec, calls in per_second.items():
        for (name, arg), n in calls.items():
            if n >= args.burst_min:
                bursts[(name, arg)] = max(bursts[(name, arg)], n)
    if bursts:
        print(f"\n== BURSTS  same call+subject >={args.burst_min}x in one second")
        print("   subject in () is the call's own argument, or the first id seen on")
        print("   its chat-trace when the call logs none. Bare name = neither.")
        for (name, arg), n in bursts.most_common(args.top):
            print(f"{n:8d}x  {name}{arg}")

    print(f"\n== FLOODS  most repeated lines")
    for k, v in floods.most_common(args.top):
        print(f"{v:8d}  {k}")


if __name__ == "__main__":
    main()
