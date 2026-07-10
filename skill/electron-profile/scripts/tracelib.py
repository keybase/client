"""Shared helpers for DevTools Performance trace analysis."""
import json
from collections import Counter


def load(path):
    return json.load(open(path))['traceEvents']


def meta(ev):
    """Return (procs, threads): pid -> process name, (pid, tid) -> thread name."""
    procs, threads = {}, {}
    for e in ev:
        if e.get('ph') == 'M':
            if e['name'] == 'process_name':
                procs[e['pid']] = e['args']['name']
            elif e['name'] == 'thread_name':
                threads[(e['pid'], e['tid'])] = e['args']['name']
    return procs, threads


def find_main(ev, threads):
    """Busiest CrRendererMain thread by total X-event duration."""
    mains = [k for k, n in threads.items() if n == 'CrRendererMain']
    busy = Counter()
    for e in ev:
        if e.get('ph') == 'X' and (e.get('pid'), e.get('tid')) in mains:
            busy[(e['pid'], e['tid'])] += e.get('dur', 0)
    if busy:
        return busy.most_common(1)[0][0]
    return mains[0] if mains else None


def resolve_main(ev, args):
    """Main thread from --pid/--tid args, else auto-detect."""
    if args.pid and args.tid:
        return (args.pid, args.tid)
    _, threads = meta(ev)
    main = find_main(ev, threads)
    if main is None:
        raise SystemExit('no CrRendererMain thread found; pass --pid/--tid')
    return main


def add_common_args(ap):
    ap.add_argument('trace', help='DevTools Performance trace .json')
    ap.add_argument('--pid', type=int, help='renderer main pid (default: auto)')
    ap.add_argument('--tid', type=int, help='renderer main tid (default: auto)')
