#!/usr/bin/env python3
# Run from shared/: python3 ../.claude/skills/update-dependencies/find-workarounds.py [--base REF] [--all] [pkg ...]
#                    python3 ../.claude/skills/update-dependencies/find-workarounds.py --patches
#
# Lists the places where we may be working around a package, so that after a bump each
# one can be checked against the new version. With no package names it takes the
# packages whose version differs between REF (default: master) and the working tree.
#
# For each package it prints:
#   - patches/*.patch files for it (and whether the patch's version matches the install),
#     with what patches/README.md records for each change: upstream state, when it can go
#   - `resolutions` entries that name it
#   - comments, anywhere in the repo, that mention it (by name, alias or upstream repo URL).
#     Comments that also carry a workaround signal (bug, issue link, "until", a version
#     number, ...) are printed; the rest are only counted unless --all is given.
#   - memory notes about it (named in the note's title/description, or on 3+ lines)
#
# This is an inventory, not a verdict: it cannot tell whether upstream fixed anything.
#
# --patches checks patches/README.md against the patch files instead: it prints every
# patch with its entries and exits 1 if a patch, or a file inside one, is not described
# there, if an entry lacks a field, or if a README section has no patch left.
import json, os, re, subprocess, sys

# Names we use for a package in comments that can't be derived from its npm name.
# All-caps aliases match case-sensitively.
ALIASES = {
    'react-native': ['RN', 'Fabric', 'Yoga', 'Hermes', 'Metro'],
    '@legendapp/list': ['LegendList', 'legend-list', 'legend list'],
    'react-native-screens': ['RNS', 'rnscreens', 'rn-screens'],
    'react-native-keyboard-controller': ['KC', 'KeyboardController', 'KeyboardAvoidingView', 'KAV'],
    'react-native-gesture-handler': ['RNGH', 'gesture-handler', 'gesture handler'],
    'react-native-reanimated': ['reanimated'],
    'react-native-worklets': ['worklets', 'worklet'],
    'react-native-webview': ['WebView'],
    'react-native-safe-area-context': ['SafeAreaView', 'safe area'],
    '@react-navigation/native': ['react-navigation', 'React Navigation'],
    '@react-navigation/native-stack': ['native stack'],
    '@gorhom/bottom-sheet': ['BottomSheet'],
    'typescript-native': ['TS7', 'tsgo'],
    'babel-plugin-react-compiler': ['react compiler', 'react-compiler'],
    'oxc-transform-react': ['oxc'],
}

SIGNAL = re.compile(
    r'work(s|ed|ing)?[ -]?around|\bbug|\bissue|upstream|\bhack|\buntil\b|\bonce\b|\bdrop\b|\bremove\b|'
    r'\bfix(ed|es)?\b|broken|regress|crash|quirk|\bnever\b|doesn\'?t|does not|won\'?t|can\'?t|cannot|'
    r'\btodo\b|\bfixme\b|\bpatch|https?://|#\d{2,}|\b\d+\.\d+(\.\d+)?\b',
    re.I,
)
COMMENT = re.compile(r'(?<!:)//(.*)$|^\s*(?:/?\*+|#|<!--|\{/\*)(.*)$')
SKIP_FILES = re.compile(
    r'(^|/)(yarn\.lock|package\.json|package-lock\.json|Podfile\.lock|rpc-gen\.tsx)$|(^|/)patches/|'
    r'\.(patch|snap|svg|json|lock|pbxproj|avdl)$|^go/|^protocol/|^skill/|(^|/)tests/results/'
)


def sh(*cmd, cwd=None):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return r.stdout if r.returncode in (0, 1) else ''


def bumped(base):
    prefix = sh('git', 'rev-parse', '--show-prefix').strip()
    old = sh('git', 'show', f'{base}:{prefix}package.json')
    if not old:
        sys.exit(f'Error: cannot read package.json at {base}. Pass --base or package names.')
    old = json.loads(old)
    new = json.load(open('package.json'))
    out = []
    for sec in ('dependencies', 'devDependencies'):
        for name, ver in new.get(sec, {}).items():
            was = old.get(sec, {}).get(name)
            if was is not None and was != ver:
                out.append((name, was, ver))
    return out


def terms_for(pkg):
    terms = {pkg}
    bare = pkg.split('/')[-1] if pkg.startswith('@') else pkg
    if len(bare) >= 5:
        terms.add(bare)
    terms.update(ALIASES.get(pkg, []))
    try:
        repo = json.load(open(f'node_modules/{pkg}/package.json')).get('repository')
        url = repo.get('url', '') if isinstance(repo, dict) else (repo or '')
        m = re.search(r'github\.com[/:]([^/]+/[^/#.]+)', url)
        if m:
            terms.add(f'github.com/{m.group(1)}/')
    except (OSError, ValueError):
        pass
    return terms


def matcher(terms):
    parts_ci, parts_cs = [], []
    for t in terms:
        pat = r'(?<![\w/-])' + re.escape(t) + (r'' if t.endswith('/') else r'(?![\w-])')
        (parts_cs if t.isupper() else parts_ci).append(pat)
    ci = re.compile('|'.join(parts_ci), re.I) if parts_ci else None
    cs = re.compile('|'.join(parts_cs)) if parts_cs else None
    return lambda s: bool((ci and ci.search(s)) or (cs and cs.search(s)))


def comment_text(path, line):
    if path.endswith(('.md', '.txt')):
        return line
    m = COMMENT.search(line)
    return (m.group(1) or m.group(2)) if m else None


PATCH_NAME = re.compile(r'^(.+)\+(\d[^+]*)\.patch$')
FIELDS = ('Files', 'Why', 'Upstream', 'Remove when', 'Check')


def patch_files():
    out = {}
    for p in sorted(os.listdir('patches')) if os.path.isdir('patches') else []:
        m = PATCH_NAME.match(p)
        if m:
            out[m.group(1).replace('+', '/')] = (p, m.group(2))
    return out


def patch_notes():
    # {package: [(entry title, {field: text})]} from patches/README.md
    notes, pkg, entry = {}, None, None
    try:
        lines = open('patches/README.md').read().splitlines()
    except OSError:
        return notes
    for line in lines:
        if line.startswith('## '):
            pkg, entry = line[3:].strip(), None
            notes[pkg] = []
        elif line.startswith('### ') and pkg:
            entry = (line[4:].strip(), {})
            notes[pkg].append(entry)
        elif entry:
            m = re.match(r'- \*\*([^*]+):\*\*\s*(.*)$', line)
            if m:
                entry[1][m.group(1)] = m.group(2)
    return notes


def print_patch(pkg, patch, ver, notes):
    # Prints one patch with its README entries; returns the problems found.
    try:
        installed = json.load(open(f'node_modules/{pkg}/package.json'))['version']
    except (OSError, ValueError, KeyError):
        installed = None
    note = '' if installed in (None, ver) else f'  (patch is for {ver}, installed {installed})'
    print(f'  PATCH       patches/{patch}{note}')
    problems = []
    entries = notes.get(pkg)
    if not entries:
        problems.append(f'patches/{patch}: no "## {pkg}" section in patches/README.md')
    described = ''
    for title, fields in entries or []:
        print(f'    - {title}')
        for f in ('Upstream', 'Remove when'):
            if fields.get(f):
                print(f'        {f}: {fields[f][:200]}')
        missing = [f for f in FIELDS if not fields.get(f)]
        if missing:
            problems.append(f'{pkg} / {title}: missing {", ".join(missing)}')
        described += fields.get('Files', '')
    if entries:
        touched = re.findall(r'^diff --git a/node_modules/\S+? b/node_modules/(\S+)$', open(f'patches/{patch}').read(), re.M)
        for path in touched:
            rel = path[len(pkg) + 1 :]
            if rel not in described:
                problems.append(f'patches/{patch}: {rel} is not named in any entry\'s Files')
    for prob in problems:
        print(f'    !! {prob}')
    return problems


def check_patches():
    files, notes = patch_files(), patch_notes()
    problems = []
    for pkg, (patch, ver) in files.items():
        print(f'\n=== {pkg} ===')
        problems += print_patch(pkg, patch, ver, notes)
    for pkg in notes:
        if pkg not in files:
            prob = f'patches/README.md: "## {pkg}" has no patch file; delete the section'
            print(f'\n!! {prob}')
            problems.append(prob)
    print(f'\n{len(problems)} problem(s)' if problems else '\nEvery patch is described in patches/README.md.')
    sys.exit(1 if problems else 0)


def memory_dir(root):
    common = sh('git', 'rev-parse', '--path-format=absolute', '--git-common-dir').strip()
    main = os.path.dirname(common) if common else root
    slug = re.sub(r'[/.]', '-', main)
    return os.path.expanduser(f'~/.claude/projects/{slug}/memory')


def main():
    args = sys.argv[1:]
    show_all = '--all' in args
    base = 'master'
    if '--base' in args:
        base = args[args.index('--base') + 1]
        del args[args.index('--base') : args.index('--base') + 2]
    names = [a for a in args if not a.startswith('--')]
    if not os.path.isfile('package.json'):
        sys.exit('Error: package.json not found. Run from shared/.')
    if '--patches' in args:
        check_patches()
    pkgs = [(n, None, None) for n in names] or bumped(base)
    if not pkgs:
        print(f'No package versions differ from {base}.')
        return

    root = sh('git', 'rev-parse', '--show-toplevel').strip()
    resolutions = json.load(open('package.json')).get('resolutions', {})
    patches, notes = patch_files(), patch_notes()
    mem = memory_dir(root)
    mem_files = sorted(f for f in os.listdir(mem) if f.endswith('.md') and f != 'MEMORY.md') if os.path.isdir(mem) else []

    for pkg, was, now in pkgs:
        print(f'\n=== {pkg}' + (f'  {was} -> {now}' if was else '') + ' ===')
        terms = terms_for(pkg)
        hit = matcher(terms)
        found = False

        if pkg in patches:
            print_patch(pkg, *patches[pkg], notes)
            found = True

        for key, ver in resolutions.items():
            if pkg in [s for s in key.split('/') if s != '**'] or key.endswith('/' + pkg):
                print(f'  RESOLUTION  "{key}": "{ver}"')
                found = True

        grep_terms = '|'.join(re.escape(t) for t in terms)
        likely, other = [], 0
        for row in sh('git', 'grep', '-nIi', '-E', grep_terms, cwd=root).splitlines():
            path, _, rest = row.partition(':')
            lineno, _, line = rest.partition(':')
            if SKIP_FILES.search(path):
                continue
            text = comment_text(path, line)
            if not text or not hit(text):
                continue
            if show_all or SIGNAL.search(text):
                likely.append(f'  COMMENT     {path}:{lineno}: {line.strip()[:160]}')
            else:
                other += 1
        for row in likely:
            print(row)
        found = found or bool(likely)
        if other:
            print(f'  ({other} more comment(s) mention it without a workaround signal; --all shows them)')

        for f in mem_files:
            try:
                body = open(os.path.join(mem, f)).read()
            except OSError:
                continue
            desc = re.search(r'^description:\s*(.*)$', body, re.M)
            head = f + ' ' + (desc.group(1) if desc else '')
            # a note is about the package when its name/description says so, or it keeps coming back to it
            if hit(head.replace('_', ' ')) or sum(hit(l) for l in body.splitlines()) >= 3:
                print(f'  MEMORY      {f}: {(desc.group(1).strip(chr(34)) if desc else "")[:150]}')
                found = True

        if not found and not other:
            print('  nothing found')


main()
