#!/usr/bin/env python3
"""Explain a flood: who drives it, how it is paced, how big its batches are.

  python3 rpc-why.py <log>... --match 'refreshParticipantsRemote' [--start ...] [--end ...]

DRIVERS   the '+ X' logged immediately before each hit on the same chat-trace.
          This is what turns 'GetURL is called 8000 times' into 'userEmojis calls it'.
CADENCE   hits per second. A flat rate that never stops is a loop; spikes are mounts.
GAPS      ms between the end of one hit and the start of the next. Consistently
          ~0 means the caller re-fires the instant the previous lands - a feedback
          loop, not a user action.
BATCHES   distribution of any 'msgIDs: N' / 'convs: N' count on the line. A pile of
          1s means the caller is not batching.
"""

import argparse
import collections
import re

import kblog

COUNT_RE = re.compile(r"(msgIDs|convs|len|msgs): (\d+)")
# the +/-/| marker sits right after the log's sequence number, optionally behind
# a '++Chat: ' prefix. + enters a span, - leaves it, | is a note inside one.
MARKER_RE = re.compile(r"\]\s+\w+\s+(?:\+\+\w+:\s+)?([+\-|])\s+(.*)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("logs", nargs="+")
    ap.add_argument("--match", required=True, help="substring to explain")
    ap.add_argument("--start")
    ap.add_argument("--end")
    ap.add_argument("--top", type=int, default=10)
    args = ap.parse_args()

    drivers = collections.Counter()
    roots = collections.Counter()
    per_second = collections.Counter()
    batches = collections.Counter()
    last_enter = {}  # trace -> most recent span entered outside our match
    root_rpc = {}  # trace -> first 'Server: X' seen, i.e. what the app asked for
    inside = collections.Counter()  # trace -> depth inside our match
    hits = 0

    for line in kblog.iter_lines(args.logs, args.start, args.end):
        m = MARKER_RE.search(line)
        if not m:
            continue
        marker, text = m.group(1), kblog.TAGS_RE.sub("", m.group(2)).strip()
        tr = kblog.trace(line) or "-"
        mine = args.match in text

        srv = kblog.SERVER_RE.search(line)
        if srv and tr not in root_rpc:
            root_rpc[tr] = srv.group(1)

        if mine and marker == "+":
            hits += 1
            ts = kblog.stamp(line)
            if ts:
                per_second[ts] += 1
            # only attribute when this is the outermost hit on the trace, else the
            # driver is just our own previous frame
            if not inside[tr]:
                drivers[last_enter.get(tr, "<nothing preceding on this trace>")] += 1
                roots[root_rpc.get(tr, "<no app RPC on this trace>")] += 1
            c = COUNT_RE.search(text)
            if c:
                batches[int(c.group(2))] += 1
            inside[tr] += 1
        elif mine and marker == "-":
            inside[tr] = max(0, inside[tr] - 1)
        elif marker == "+" and not inside[tr]:
            # a span entered outside our match is a candidate driver; spans entered
            # while inside it are its own children
            last_enter[tr] = text[:55]

    if not hits:
        print(f"no lines matched {args.match!r}")
        return

    print(f"{hits} hits on {args.match!r}")

    print("\n== ROOT  app RPC that opened the trace this ran on")
    for k, v in roots.most_common(args.top):
        print(f"{v:8d}  {k}")
    unrooted = roots.get("<nothing preceding on this trace>", 0) + roots.get(
        "<no app RPC on this trace>", 0
    )
    if unrooted > hits * 0.5:
        print("  most hits have no app RPC above them: this is service-side background")
        print("  work, not something the client asked for. Look at DRIVERS instead, and")
        print("  grep the trace tags for CHTBKG= to confirm.")

    print("\n== DRIVERS  call logged just before, same chat-trace")
    for k, v in drivers.most_common(args.top):
        print(f"{v:8d}  {k}")

    print("\n== CADENCE  busiest seconds")
    for k, v in per_second.most_common(args.top):
        print(f"{v:8d}  {k}")
    spread = len(per_second)
    print(f"  spread over {spread} distinct seconds, mean {hits / max(spread, 1):.1f}/s")

    if batches:
        print("\n== BATCHES  count on the line")
        for size, n in batches.most_common(args.top):
            print(f"{n:8d}x  size {size}")
        ones = batches.get(1, 0)
        if ones > sum(batches.values()) * 0.5:
            print("  >half are size 1 - the caller is not batching")
    else:
        print("\n== BATCHES  none: these lines carry no item count")
        print("  Remote calls usually do not log one. To see batch sizes, match the")
        print("  local span that wraps this call instead - e.g. match")
        print("  'HybridConversationSource: GetMessages' rather than 'getMessagesRemote'.")


if __name__ == "__main__":
    main()
