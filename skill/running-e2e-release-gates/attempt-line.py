"""One iOS gate attempt record (tests/results/ios-report/attempts/*.json) as a watch line.

Prints a line for a failed attempt, nothing for a passed one. Exits 1 when the attempt is not over
yet (its record still being written, or the gate's placeholder), so watch-run.sh reads it again on
its next pass.
"""
import json
import sys

try:
    with open(sys.argv[1]) as f:
        record = json.load(f)
except Exception:
    sys.exit(1)

# The gate writes this placeholder as an attempt begins and replaces it as the attempt ends (gate/attempt.ts
# NEVER_ENDED): still running, so it is read again. A worker that really died is in the flows phase line.
if record.get('error') == 'the attempt never ended (the test worker stopped during it)':
    sys.exit(1)

if record.get('status') == 'failed':
    title = ' > '.join(record.get('titlePath', []))
    error = ' '.join(str(record.get('error', '')).split())[:300]
    print('FAILED (attempt %s) %s: %s' % (record.get('attempt', 0), title, error), flush=True)
