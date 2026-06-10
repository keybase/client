#!/usr/bin/env python3
# Run from shared/: python3 ../.claude/skills/update-dependencies/check-audit.py
#
# Runs `yarn audit --json`, dedupes advisories, and for each vulnerable package
# works out the cheapest fix strategy by cross-referencing yarn.lock:
#
#   1. DIRECT     — package is in our package.json: bump it there.
#   2. LOCKFILE   — transitive, and a patched version satisfies every range the
#                   lockfile entry was resolved from: delete those yarn.lock
#                   entries and re-run `yarn` so it re-resolves to the patched
#                   version. No package.json change needed.
#   3. RESOLUTION — transitive, but the patched version is OUTSIDE the range the
#                   parent package accepts: add a `resolutions` entry to force it.
#                   Verify the app still works — the parent never tested this.
#   4. NO-FIX     — advisory has no patched version. Nothing to do but note it.
import json, re, subprocess, sys, os
from collections import defaultdict

if not os.path.exists('yarn.lock'):
    print('Error: yarn.lock not found. Run from shared/.', file=sys.stderr)
    sys.exit(2)

# ---------- minimal semver ----------

def parse_ver(v):
    m = re.match(r'v?(\d+)\.(\d+)\.(\d+)', v)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None

def satisfies_comparator(ver, comp):
    comp = comp.strip()
    if comp in ('*', '', 'latest'):
        return True
    m = re.match(r'(\^|~|>=|<=|>|<|=)?\s*v?(\d+)\.(\d+)\.(\d+)', comp)
    if not m:
        return False  # git urls, tags, x-ranges we don't model — be conservative
    op = m.group(1) or '='
    base = (int(m.group(2)), int(m.group(3)), int(m.group(4)))
    if op == '^':
        if base[0] > 0:
            return ver >= base and ver[0] == base[0]
        if base[1] > 0:
            return ver >= base and ver[:2] == base[:2]
        return ver == base
    if op == '~':
        return ver >= base and ver[:2] == base[:2]
    return {'>=': ver >= base, '<=': ver <= base, '>': ver > base,
            '<': ver < base, '=': ver == base}[op]

def satisfies_range(ver, rng):
    # OR branches split on ||, AND comparators split on spaces
    for branch in rng.split('||'):
        comps = branch.strip().split()
        if comps and all(satisfies_comparator(ver, c) for c in comps):
            return True
    return False

def patched_candidates(patched):
    # ">=2.0.0 <3.0.0 || >=3.0.1" -> minimal version per OR branch
    out = []
    for branch in patched.split('||'):
        m = re.search(r'>=\s*v?(\d+\.\d+\.\d+)', branch)
        if m:
            out.append(parse_ver(m.group(1)))
    return out

# ---------- yarn.lock: name -> [(entry_key, [ranges], resolved_version)] ----------

lock_entries = defaultdict(list)
with open('yarn.lock') as f:
    key, ranges = None, []
    for line in f:
        if line.startswith('#') or not line.strip():
            continue
        if not line.startswith(' '):
            key = line.rstrip().rstrip(':')
            specs = [s.strip().strip('"') for s in key.split(', ')]
            ranges = []
            name = None
            for s in specs:
                at = s.rfind('@')
                name, rng = s[:at], s[at + 1:]
                ranges.append(rng)
            cur = (key, name, ranges)
        elif line.strip().startswith('version ') and key:
            ver = line.strip().split()[1].strip('"')
            lock_entries[cur[1]].append((cur[0], cur[2], ver))

with open('package.json') as f:
    pkg = json.load(f)
our_deps = set(pkg.get('dependencies', {})) | set(pkg.get('devDependencies', {}))
existing_resolutions = pkg.get('resolutions', {})

# ---------- run audit ----------

proc = subprocess.run(['yarn', 'audit', '--json'], capture_output=True, text=True)
advisories = {}   # id -> advisory data
paths = defaultdict(set)  # id -> resolution paths
for line in proc.stdout.splitlines():
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        continue
    if obj.get('type') != 'auditAdvisory':
        continue
    adv = obj['data']['advisory']
    advisories[adv['id']] = adv
    paths[adv['id']].add(obj['data']['resolution']['path'])

if not advisories:
    print('yarn audit: no vulnerabilities found.')
    sys.exit(0)

SEV_ORDER = {'critical': 0, 'high': 1, 'moderate': 2, 'low': 3, 'info': 4}
print(f'yarn audit: {len(advisories)} advisor(ies) found.\n')

needs_fix = False
for aid, adv in sorted(advisories.items(), key=lambda kv: (SEV_ORDER.get(kv[1]['severity'], 9), kv[1]['module_name'])):
    name = adv['module_name']
    patched = adv.get('patched_versions') or '<0.0.0'
    vuln_versions = {f['version'] for f in adv.get('findings', [])}
    cands = patched_candidates(patched)
    print(f'[{adv["severity"].upper()}] {name} — {adv.get("title", "")}')
    print(f'  installed: {", ".join(sorted(vuln_versions))}   patched: {patched}')
    print(f'  via: {"; ".join(sorted(paths[aid]))}')
    if adv.get('url'):
        print(f'  {adv["url"]}')

    if patched == '<0.0.0' or not cands:
        print('  → NO-FIX: no patched version published. Note it and move on.\n')
        continue
    needs_fix = True
    suggest = max(cands)
    suggest_str = '.'.join(map(str, suggest))

    if name in our_deps:
        print(f'  → DIRECT: bump "{name}" in package.json to {suggest_str} (exact), then yarn.\n')
        continue

    # Lockfile entries whose resolved version is one of the vulnerable installs
    vuln_entries = [e for e in lock_entries.get(name, []) if e[2] in vuln_versions]
    if vuln_entries and all(
        any(all(satisfies_range(c, r) for r in ranges) for c in cands)
        for _, ranges, _ in vuln_entries
    ):
        print('  → LOCKFILE: patched version satisfies all requiring ranges.')
        print('    Delete these yarn.lock entries, then run `yarn` to re-resolve:')
        for entry_key, _, ver in vuln_entries:
            print(f'      {entry_key}   (currently {ver})')
        print()
    else:
        cur = existing_resolutions.get(f'**/{name}') or existing_resolutions.get(name)
        note = f' (updating existing resolution {cur})' if cur else ''
        print(f'  → RESOLUTION: patched version is outside the range parents accept.')
        print(f'    Add to package.json resolutions{note}:  "**/{name}": "{suggest_str}"')
        print('    Then run `yarn`. Verify behavior — the parent package was never tested with this version.\n')

sys.exit(1 if needs_fix else 0)
