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
PRE_KEYWORDS = ['beta', 'alpha', 'rc', 'dev', 'canary', 'nightly', 'preview']

def semver_key(v):
    import re
    m = re.match(r'(\d+)\.(\d+)\.(\d+)(?:[.-](.+))?', v)
    if not m:
        return (0, 0, 0, [])
    major, minor, patch, pre = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4) or ''
    # Parse pre-release segments numerically so beta.9 < beta.56, alpha.9 < alpha.29
    def part_key(p):
        try:
            return (0, int(p))
        except ValueError:
            return (1, p)
    pre_parts = [part_key(p) for p in re.split(r'[.\-]', pre)] if pre else []
    return (major, minor, patch, pre_parts)

def get_latest(name, current):
    if name in SKIP or current.startswith('file:'):
        return name, current, current, 'skip'
    is_pre = any(k in current for k in PRE_KEYWORDS)
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
            cur_pre = next((k for k in PRE_KEYWORDS if k in current), None)
            prefix = current.split('-')[0]
            matching = [v for v in all_versions if cur_pre in v and v.startswith(prefix)]
            latest = max(matching, key=semver_key) if matching else current
            if semver_key(latest) < semver_key(current):
                latest = current
        else:
            cur_major_minor = '.'.join(current.split('.')[:2])
            stable = [v for v in all_versions
                     if not any(k in v for k in PRE_KEYWORDS)
                     and v.startswith(cur_major_minor + '.')]
            all_stable = [v for v in all_versions if not any(k in v for k in PRE_KEYWORDS)]
            same_line_latest = stable[-1] if stable else current
            overall_latest = all_stable[-1] if all_stable else current
            latest = overall_latest if semver_key(overall_latest) > semver_key(current) else same_line_latest
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
