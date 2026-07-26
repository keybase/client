#!/usr/bin/env python3
"""Rank operations by the time they actually took, not by how often they appear.

  python3 rpc-cost.py <log>... [--top 20] [--min-mean-ms 0]

Count and cost are different questions, and the loudest thing in the log is
usually not the expensive one. In one capture the top line by count was an
in-memory map lookup running 15,767 times for 0.16s total, while the real cost
was 469 team loads at 292ms each - 186 seconds, and only the 30th most common
line.

Reads the [time=...] that the Go tracing helpers put on every span exit, so it
only sees operations that are traced. Times overlap across goroutines, so the
totals are service time, not wall clock.
"""

import argparse
import collections
import re

import kblog

# "- Namespace: Op(args) -> ok [time=1.234ms]", optionally behind a "++Chat: "
# prefix. Keep the whole "Namespace: Op": stopping the name at the first colon
# collapsed every "Server: X" and "RemoteClient: X" into one row, which hid the
# per-operation breakdown this script exists to produce. A colon only ends the
# name when it is not followed by a space.
EXIT_RE = re.compile(
    r"\]\s+\w+\s+(?:\+\+\w+:\s+)?-\s+((?:[^\s(:]|:(?= )|(?<=:) )+?)\s*(?:\(| ->).*\[time=([^\]]+)\]"
)
# Go durations are compound once they pass a minute ("1m28.867s", "1h2m3s").
# Matching only a single number+unit silently dropped exactly the slowest spans.
DUR_RE = re.compile(r"(?:([\d.]+)h)?(?:([\d.]+)m(?!s))?(?:([\d.]+)(ms|s|µs|ns))?$")
UNIT_MS = {"ms": 1.0, "s": 1000.0, "µs": 0.001, "ns": 1e-6}


def parse_duration_ms(text):
    """Return milliseconds for a Go duration string, or None if unparseable."""
    m = DUR_RE.match(text.strip())
    if not m:
        return None
    hours, minutes, value, unit = m.groups()
    total = 0.0
    if hours:
        total += float(hours) * 3_600_000
    if minutes:
        total += float(minutes) * 60_000
    if value:
        total += float(value) * UNIT_MS[unit]
    return total if (hours or minutes or value) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("logs", nargs="+")
    ap.add_argument("--start")
    ap.add_argument("--end")
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--min-mean-ms", type=float, default=0.0, help="hide cheap chatty ops")
    args = ap.parse_args()

    total = collections.Counter()
    calls = collections.Counter()
    worst = {}

    for line in kblog.iter_lines(args.logs, args.start, args.end):
        m = EXIT_RE.search(line)
        if not m:
            continue
        # "Namespace: Op" is the useful grouping; anything past that is an
        # argument ("localizerPipeline: localizeConversation: TLF: foo") and
        # would split one operation into a row per argument value.
        name = ": ".join(m.group(1).strip().split(": ")[:2])[:45]
        ms = parse_duration_ms(m.group(2))
        if ms is None:
            continue
        total[name] += ms
        calls[name] += 1
        if ms > worst.get(name, 0):
            worst[name] = ms

    if not calls:
        print("no traced spans with [time=] found")
        return

    print(f"{sum(calls.values())} traced spans, {sum(total.values()) / 1000:.1f}s of service time")
    print("(times overlap across goroutines - this is service time, not wall clock)\n")
    print(f"{'total_s':>9} {'calls':>7} {'mean_ms':>9} {'max_ms':>9}  operation")
    shown = 0
    for name, ms in total.most_common():
        mean = ms / calls[name]
        if mean < args.min_mean_ms:
            continue
        print(f"{ms / 1000:9.2f} {calls[name]:7d} {mean:9.2f} {worst[name]:9.1f}  {name}")
        shown += 1
        if shown >= args.top:
            break


if __name__ == "__main__":
    main()
