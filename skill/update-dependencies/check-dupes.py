#!/usr/bin/env python3
# Run from shared/: python3 ../.claude/skills/update-dependencies/check-dupes.py
#
# Finds actionable duplicate package installs: cases where a nested node_modules
# contains a NEWER version of a package than what's at the top level.
#
# This is the fixable case: a dependency requires a newer range (e.g. ^1.2) and yarn
# resolves it to 1.3, but our package.json pins 1.2 exactly, so yarn can't deduplicate
# and installs a nested copy. Fix: bump our pin to 1.3.
#
# Ignores nested installs that are OLDER than top-level — those are locked by their
# parent packages and can't be fixed by bumping our own pins.
import os, json, re, sys
from collections import defaultdict

root = 'node_modules'
if not os.path.isdir(root):
    print(f'Error: {root} not found. Run from shared/.', file=sys.stderr)
    sys.exit(1)

with open('package.json') as f:
    pkg = json.load(f)
our_deps = set(pkg.get('dependencies', {}).keys()) | set(pkg.get('devDependencies', {}).keys())

# Packages that break when duplicated regardless of pinning — they use module-level
# singletons like React.createContext() where two installs = two separate objects.
SINGLETON_PACKAGES = {
    'react',
    'react-native',
    '@react-navigation/core',
    '@react-navigation/native',
    '@react-navigation/native-stack',
    '@react-navigation/bottom-tabs',
    '@react-navigation/elements',
    'react-native-reanimated',
    'react-native-screens',
    'react-native-safe-area-context',
}

interesting = our_deps | SINGLETON_PACKAGES

def semver_key(v):
    m = re.match(r'(\d+)\.(\d+)\.(\d+)(?:[.\-](.+))?', v)
    if not m:
        return (0, 0, 0, v)
    major, minor, patch, pre = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4) or ''
    # No pre-release suffix sorts higher than any pre-release (1.0.0 > 1.0.0-alpha)
    return (major, minor, patch, '\xff' if not pre else pre)

# Collect installs: separate top-level from nested
top_level = {}   # name -> version
nested = defaultdict(list)  # name -> [(version, path)]

for dirpath, dirnames, filenames in os.walk(root):
    # Skip mock directories and hidden dirs
    dirnames[:] = [d for d in dirnames if not d.startswith('.') and d != 'node_modules_mock']
    if 'package.json' not in filenames:
        continue
    path = os.path.join(dirpath, 'package.json')
    try:
        with open(path) as f:
            data = json.load(f)
        name = data.get('name')
        version = data.get('version')
        if not name or not version or name not in interesting:
            continue
        # Determine if this is a top-level install
        # Top-level: node_modules/<name>/package.json (or node_modules/@scope/<name>/package.json)
        rel = os.path.relpath(dirpath, root)
        depth = rel.count(os.sep)
        is_top = depth == 0 or (rel.startswith('@') and depth == 1)
        if is_top:
            top_level[name] = version
        else:
            nested[name].append((version, dirpath))
    except Exception:
        continue

# Only flag when a nested version is strictly newer than the top-level version
actionable = {}
for name, nested_installs in nested.items():
    top_ver = top_level.get(name)
    if not top_ver:
        continue
    newer = [(v, p) for v, p in nested_installs if semver_key(v) > semver_key(top_ver)]
    if newer:
        actionable[name] = {'top': top_ver, 'newer': newer}

if not actionable:
    print('No actionable duplicate package versions found.')
    sys.exit(0)

print(f'Found {len(actionable)} package(s) with a newer version nested inside node_modules:\n')
for name in sorted(actionable):
    info = actionable[name]
    pinned = ' [pinned in package.json]' if name in our_deps else ' [singleton]'
    newer_versions = sorted(set(v for v, _ in info['newer']), key=semver_key)
    print(f'  {name}{pinned}')
    print(f'    top-level:  {info["top"]}')
    for v, p in sorted(info['newer'], key=lambda x: semver_key(x[0])):
        print(f'    nested:     {v}  ({p})')
    print(f'    → bump package.json to {newer_versions[-1]}')
    print()

print('Fix: update the versions above in package.json, then re-run yarn to deduplicate.')
sys.exit(1)
