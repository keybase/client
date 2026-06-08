#!/usr/bin/env python3
# Run from shared/: python3 ../.claude/skills/update-dependencies/check-outdated.py
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

with open('package.json') as f:
    pkg = json.load(f)

deps = {}
deps.update(pkg.get('dependencies', {}))
deps.update(pkg.get('devDependencies', {}))

SKIP = {'react-native-kb'}
PINNED = {'react', 'react-dom', 'react-is', 'react-test-renderer',
          'react-native', '@react-native/babel-preset', '@react-native/eslint-config', '@react-native/metro-config'}

import re as _re

def _parse_semver(v):
    """Return (major, minor, patch, pre) or None. Strips build metadata (+...)."""
    v = v.split('+')[0]
    m = _re.match(r'^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$', v)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4) or ''

def _ident_key(p):
    # semver §11.4: purely-numeric identifiers sort before alphanumeric ones.
    # Use a 3-tuple so both branches are always comparable without TypeError.
    try:
        return (0, int(p), '')
    except ValueError:
        return (1, 0, p)

def semver_key(v):
    """Sort key implementing semver.org §11 precedence rules."""
    parsed = _parse_semver(v)
    if not parsed:
        return (0, 0, 0, 0, [])
    major, minor, patch, pre = parsed
    # semver §11.3: pre-release identifiers are dot-separated (not hyphen-separated).
    pre_parts = [_ident_key(p) for p in pre.split('.')] if pre else []
    # semver §11.3: a pre-release version has lower precedence than the normal version.
    is_stable = 0 if pre else 1
    return (major, minor, patch, is_stable, pre_parts)

def _is_prerelease(v):
    """True if v has a pre-release component per semver (no keyword guessing)."""
    parsed = _parse_semver(v)
    return bool(parsed and parsed[3])

def get_latest(name, current):
    if name in SKIP or current.startswith('file:'):
        return name, current, current, 'skip'
    is_pre = _is_prerelease(current)
    try:
        r = subprocess.run(['yarn', 'info', name, 'versions', '--json'],
                          capture_output=True, text=True, timeout=15)
        if r.returncode != 0:
            raise RuntimeError(f'yarn info exited {r.returncode}: {r.stderr.strip() or r.stdout.strip()}')
        raw = r.stdout.strip()
        if not raw:
            raise RuntimeError('yarn info returned empty output')
        parsed = json.loads(raw)
        all_versions = parsed.get('data', [])
        if is_pre:
            # Consider all versions on the same major — pre or stable.
            # This handles graduation (e.g. 56.0.0-preview.x → 56.0.5 stable).
            cur_major = _parse_semver(current)[0]
            candidates = [v for v in all_versions if _parse_semver(v) and _parse_semver(v)[0] == cur_major]
            latest = max(candidates, key=semver_key) if candidates else current
        else:
            candidates = [v for v in all_versions if not _is_prerelease(v)]
            latest = max(candidates, key=semver_key) if candidates else current
        if semver_key(latest) < semver_key(current):
            latest = current
        return name, current, latest, 'pre' if is_pre else 'stable'
    except Exception as e:
        return name, current, f'ERROR: {e}', 'error'

results = []
with ThreadPoolExecutor(max_workers=20) as ex:
    futures = {ex.submit(get_latest, n, v): n for n, v in deps.items()}
    for fut in futures:
        results.append(fut.result())
results.sort()

print('\n=== OUTDATED ===')
for name, cur, lat, kind in results:
    if kind not in ('skip', 'error') and name not in PINNED and cur != lat and lat and 'ERROR' not in lat:
        print(f'  {name}: {cur} -> {lat}' + (' [PRE]' if kind == 'pre' else ''))

print('\n=== UP TO DATE ===')
for name, cur, lat, kind in results:
    if kind not in ('skip', 'error') and name not in PINNED and (cur == lat or not lat):
        print(f'  {name}: {cur}')

print('\n=== PINNED (skipped) ===')
for name, cur, lat, kind in results:
    if name in PINNED:
        print(f'  {name}: {cur}')

errors = [(name, lat) for name, cur, lat, kind in results if kind == 'error']
if errors:
    print('\n=== ERRORS (script broken — fix before trusting results) ===', file=sys.stderr)
    for name, msg in errors:
        print(f'  {name}: {msg}', file=sys.stderr)
    sys.exit(1)
