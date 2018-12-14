#!/usr/bin/env python

#
# run on the outputted log of the tests with KEYBASE_TIMERS=a to figure
# out which are the slowest API calls.
#
import sys
import re

rxx = re.compile(r"timer: (.*?) \[(\d+) ms\]")
counts = {}
for line in sys.stdin:
    m = rxx.search(line)
    if m:
        which = m.group(1)
        time = int(m.group(2))
        if not counts.get(which):
            counts[which] = 0
        counts[which] += time
vec = counts.items()
vec.sort(key = lambda x: -x[1])
for line in vec:
    print line[1], "\t", line[0]

