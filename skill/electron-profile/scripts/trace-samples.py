#!/usr/bin/env python3
"""CPU sample attribution from a DevTools Performance trace's embedded sampling
profile (Profile/ProfileChunk events). Reports self time, inclusive time, and
app-frame attribution (nearest non-node_modules stack frame), optionally
restricted to a time window."""
import argparse
from collections import Counter

import tracelib

ap = argparse.ArgumentParser(description=__doc__)
tracelib.add_common_args(ap)
ap.add_argument('--window', nargs=2, type=float, metavar=('FROM_S', 'TO_S'),
                help='restrict to seconds relative to first sample')
ap.add_argument('--top', type=int, default=30, help='rows per report')
args = ap.parse_args()

ev = tracelib.load(args.trace)
main = tracelib.resolve_main(ev, args)
print('MAIN (pid, tid):', main)

nodes = {}    # id -> {name, url, line, parent}
samples = []  # (ts, nodeId)
cur_ts = None

# Profile events carry the profile on several threads of the pid; filter by pid only
profs = [e for e in ev if e.get('name') in ('Profile', 'ProfileChunk') and e.get('pid') == main[0]]
print('profile events:', len(profs))

for e in profs:
    data = e['args']['data']
    if e['name'] == 'Profile':
        cur_ts = data.get('startTime')
        cp = data
    else:
        cp = data.get('cpuProfile', {})
    for n in cp.get('nodes', []):
        cf = n['callFrame']
        nodes[n['id']] = {
            'name': cf.get('functionName') or '(anonymous)',
            'url': cf.get('url', ''),
            'line': cf.get('lineNumber', -1),
            'parent': n.get('parent'),
        }
    sm = cp.get('samples', [])
    td = data.get('timeDeltas', cp.get('timeDeltas', []))
    for s, dt in zip(sm, td):
        cur_ts += dt
        samples.append((cur_ts, s))

print('nodes:', len(nodes), 'samples:', len(samples))
if not samples:
    raise SystemExit('no samples — was CPU sampling enabled for the recording?')

sample_t0 = samples[0][0]
print(f'sample span: {(samples[-1][0] - sample_t0) / 1e6:.2f}s')
span = (samples[-1][0] - sample_t0) / len(samples)  # avg sample interval (us)
print(f'avg sample interval: {span:.1f}us')

if args.window:
    lo, hi = (sample_t0 + s * 1e6 for s in args.window)
    samples = [x for x in samples if lo <= x[0] <= hi]
    print(f'window {args.window[0]:g}s..{args.window[1]:g}s: {len(samples)} samples')


def keyof(nid):
    n = nodes.get(nid)
    if not n:
        return f'node{nid}'
    u = n['url']
    if u:
        u = u.split('/')[-1]
    return f"{n['name']} ({u}:{n['line']})"


def is_app(nid):
    u = nodes[nid]['url']
    return bool(u) and 'node_modules' not in u and not u.startswith(('chrome-extension:', 'node:', 'pptr:'))


memo = {}


def chain(nid):
    """nid plus all ancestors, leaf first."""
    if nid in memo:
        return memo[nid]
    out = []
    x = nid
    while x is not None and x in nodes:
        out.append(x)
        x = nodes[x]['parent']
    memo[nid] = out
    return out


def report(cnt, title, top):
    print(f'\n{title}:')
    for k, c in cnt.most_common(top):
        print(f'  {c * span / 1000:8.1f}ms  {c:6d}  {k}')


self_c = Counter()
for ts, nid in samples:
    self_c[keyof(nid)] += 1
report(self_c, 'TOP SELF', args.top)

tot_c = Counter()
for ts, nid in samples:
    seen = set()
    for a in chain(nid):
        k = keyof(a)
        if k not in seen:
            seen.add(k)
            tot_c[k] += 1
report(tot_c, 'TOP TOTAL/inclusive', args.top)

# nearest app frame: walk up from leaf to first frame with an app URL
app_c = Counter()
no_app = 0
for ts, nid in samples:
    for a in chain(nid):
        if is_app(a):
            app_c[keyof(a)] += 1
            break
    else:
        no_app += 1
report(app_c, 'TOP APP FRAMES (nearest app-URL frame per sample)', args.top)
print(f'\nsamples with no app frame anywhere on stack: {no_app} '
      f'({no_app * span / 1000:.0f}ms, {100 * no_app / len(samples):.0f}%)')
