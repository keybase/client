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
PINNED = {'react', 'react-dom', 'react-is', 'react-test-renderer', 'react-native'}
# Project terminology: a version-line change (0.86 -> 0.87) is a MAJOR, the
# last number (.1, .2) is minor. These must stay on react-native's major
# (0.86), but minor bumps within it are allowed (0.86.0 -> 0.86.1, never 0.87.x).
RN_MAJOR_PINNED = {'@react-native/babel-preset', '@react-native/eslint-config', '@react-native/metro-config'}

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
    if name in SKIP or current.startswith(('file:', 'link:', 'github:')):
        return name, current, current, 'skip', current
    # npm: alias (e.g. typescript-native -> "npm:typescript@7.0.2"): query the
    # real package; report under the alias name with the real version.
    query_name = name
    if current.startswith('npm:'):
        query_name, current = current[4:].rsplit('@', 1)
    is_pre = _is_prerelease(current)
    try:
        r = subprocess.run(['yarn', 'info', query_name, 'versions', '--json'],
                          capture_output=True, text=True, timeout=15)
        if r.returncode != 0:
            raise RuntimeError(f'yarn info exited {r.returncode}: {r.stderr.strip() or r.stdout.strip()}')
        raw = r.stdout.strip()
        if not raw:
            raise RuntimeError('yarn info returned empty output')
        parsed = json.loads(raw)
        all_versions = parsed.get('data', [])
        cur_major = _parse_semver(current)[0]
        if name in RN_MAJOR_PINNED:
            # Cap at react-native's major (0.86) — minor bumps only.
            cur_rn_major = _parse_semver(current)[1]
            candidates = [v for v in all_versions if not _is_prerelease(v)
                          and _parse_semver(v)
                          and _parse_semver(v)[0] == cur_major
                          and _parse_semver(v)[1] == cur_rn_major]
            latest = max(candidates, key=semver_key) if candidates else current
            if semver_key(latest) < semver_key(current):
                latest = current
            return name, current, latest, 'rn-major-pinned', latest
        if is_pre:
            # Consider all versions on the same major — pre or stable.
            # This handles graduation (e.g. 56.0.0-preview.x → 56.0.5 stable).
            candidates = [v for v in all_versions if _parse_semver(v) and _parse_semver(v)[0] == cur_major]
            latest = max(candidates, key=semver_key) if candidates else current
            # in-major == overall for pre packages (already major-scoped).
            in_major = latest
        else:
            candidates = [v for v in all_versions if not _is_prerelease(v)]
            latest = max(candidates, key=semver_key) if candidates else current
            # Highest stable WITHIN the current major — the safe upgrade that
            # avoids a major-version jump (e.g. babel 7.x newest, not 8.x).
            in_major_c = [v for v in candidates if _parse_semver(v) and _parse_semver(v)[0] == cur_major]
            in_major = max(in_major_c, key=semver_key) if in_major_c else current
        if semver_key(latest) < semver_key(current):
            latest = current
        if semver_key(in_major) < semver_key(current):
            in_major = current
        return name, current, latest, 'pre' if is_pre else 'stable', in_major
    except Exception as e:
        return name, current, f'ERROR: {e}', 'error', current

results = []
with ThreadPoolExecutor(max_workers=20) as ex:
    futures = {ex.submit(get_latest, n, v): n for n, v in deps.items()}
    for fut in futures:
        results.append(fut.result())
results.sort()

print('\n=== OUTDATED ===')
for name, cur, lat, kind, in_major in results:
    if kind not in ('skip', 'error') and name not in PINNED and cur != lat and lat and 'ERROR' not in lat:
        pre = ' [PRE]' if kind == 'pre' else ''
        # If the cross-major latest is also reachable without leaving the
        # current major, just print the one line. Otherwise show the safe
        # in-major upgrade first, then flag the major jump separately so we
        # can take the in-major bump without being forced onto a new major.
        if in_major != lat and semver_key(in_major) > semver_key(cur):
            cur_major = _parse_semver(cur)[0]
            lat_major = _parse_semver(lat)[0]
            print(f'  {name}: {cur} -> {in_major}  (in-major){pre}')
            print(f'      ↳ MAJOR jump available: -> {lat} (major {cur_major} -> {lat_major})')
        else:
            print(f'  {name}: {cur} -> {lat}{pre}')

print('\n=== UP TO DATE ===')
for name, cur, lat, kind, in_major in results:
    if kind not in ('skip', 'error') and name not in PINNED and (cur == lat or not lat):
        print(f'  {name}: {cur}')

print('\n=== PINNED (skipped) ===')
for name, cur, lat, kind, in_major in results:
    if name in PINNED:
        print(f'  {name}: {cur}')

errors = [(name, lat) for name, cur, lat, kind, in_major in results if kind == 'error']
if errors:
    print('\n=== ERRORS (script broken — fix before trusting results) ===', file=sys.stderr)
    for name, msg in errors:
        print(f'  {name}: {msg}', file=sys.stderr)
    sys.exit(1)
