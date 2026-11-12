#!/usr/bin/env python3
# Run from shared/: python3 ../.claude/skills/update-dependencies/find-workarounds.py [--base REF] [--all] [pkg ...]
#                   python3 ../.claude/skills/update-dependencies/find-workarounds.py --patches
#
# Default mode lists where we may be working around a package: its patch (with the
# patches/README.md entries), `resolutions` entries, comments and memory notes. With no
# package names it takes the packages whose version changed since the merge-base with
# REF (default: master). It is an inventory, not a verdict: it cannot tell whether
# upstream fixed anything, and a workaround whose comment never names the package is
# not in it.
#
# --patches checks patches/README.md against the patch files and exits 1 on a gap. It
# checks that every patched file is named, not that every hunk is described.
import argparse, json, os, re, subprocess, sys

# Names we use for a package in comments. The npm name is always searched; nothing is
# derived from it, because the last segment of a scoped name is usually an ordinary word
# (@storybook/react, @react-navigation/native). All-caps aliases match case-sensitively.
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
    '@react-navigation/native-stack': ['native-stack', 'native stack'],
    '@gorhom/bottom-sheet': ['BottomSheet'],
    'typescript-native': ['TS7', 'tsgo'],
    'babel-plugin-react-compiler': ['react compiler', 'react-compiler'],
    'oxc-transform-react': ['oxc'],
}

SIGNAL = re.compile(
    r'work(s|ed|ing)?[ -]?around|\bbug|\bissue|upstream|\bhack|\buntil\b|\bfix(ed|es)?\b|broken|regress|'
    r'crash|quirk|\btodo\b|\bfixme\b|\bpatch|https?://|#\d{2,}|\b\d+\.\d+(\.\d+)?\b',
    re.I,
)
COMMENT = re.compile(r'(?<!:)//(.*)$|^\s*(?:/?\*+|#|<!--|\{/\*)(.*)$')
SKIP_FILES = re.compile(
    r'(^|/)rpc-gen\.tsx$|(^|/)patches/|\.(snap|svg|json|lock|pbxproj|avdl)$|^go/|^protocol/|^skill/|(^|/)tests/results/'
)
FIELDS = ('Files', 'Why', 'Upstream', 'Remove when', 'Check')
# How far a comment's reason may sit from the line that names the package.
CONTEXT_LINES = 3
# Real workaround comments are mostly plain prose, so the signal is a poor filter: it is
# only used when a package is mentioned too often to read every comment.
PRINT_ALL_UP_TO = 40


def git(*args, cwd=None):
    r = subprocess.run(('git',) + args, capture_output=True, text=True, cwd=cwd)
    # git grep exits 1 for "no match"
    if r.returncode > 1:
        sys.exit(f'Error: git {" ".join(args[:2])} failed: {r.stderr.strip()}')
    return r.stdout


def installed_version(install_path):
    try:
        return json.load(open(f'node_modules/{install_path}/package.json'))['version']
    except (OSError, ValueError, KeyError):
        return None


def bumped(base):
    prefix = git('rev-parse', '--show-prefix').strip()
    fork = git('merge-base', base, 'HEAD').strip() or base
    old = json.loads(git('show', f'{fork}:{prefix}package.json'))
    new = json.load(open('package.json'))
    out = []
    for sec in ('dependencies', 'devDependencies'):
        for name, ver in new.get(sec, {}).items():
            was = old.get(sec, {}).get(name)
            if was is not None and was != ver:
                out.append((name, was, ver))
    return out


def terms_for(pkg):
    terms = {pkg, *ALIASES.get(pkg, [])}
    try:
        repo = json.load(open(f'node_modules/{pkg}/package.json')).get('repository')
        url = repo.get('url', '') if isinstance(repo, dict) else (repo or '')
        m = re.search(r'github\.com[/:]([^/]+/[^/#]+?)(?:\.git)?(?:[/#]|$)', url)
        if m:
            terms.add(f'github.com/{m.group(1)}/')
    except (OSError, ValueError):
        pass
    return terms


def matcher(terms):
    # Not inside a longer name or path, except directly under node_modules/.
    before = r'(?<![\w-])(?<!(?<!node_modules)/)'
    parts_ci, parts_cs = [], []
    for t in terms:
        pat = before + re.escape(t) + ('' if t.endswith('/') else r'(?![\w-])')
        (parts_cs if t.isupper() else parts_ci).append(pat)
    ci = re.compile('|'.join(parts_ci), re.I) if parts_ci else None
    cs = re.compile('|'.join(parts_cs)) if parts_cs else None
    return lambda s: bool((ci and ci.search(s)) or (cs and cs.search(s)))


def comment_text(path, line):
    if path.endswith(('.md', '.txt')):
        return line
    m = COMMENT.search(line)
    return (m.group(1) or m.group(2)) if m else None


def comments_for(pkg_hit, grep_terms, root, show_all):
    # (printed rows, count of mentions left out)
    rows, files = [], {}
    for row in git('grep', '-nIi', '-E', grep_terms, cwd=root).splitlines():
        path, _, rest = row.partition(':')
        lineno, _, line = rest.partition(':')
        if SKIP_FILES.search(path):
            continue
        text = comment_text(path, line)
        if not text or not pkg_hit(text):
            continue
        if path not in files:
            try:
                files[path] = open(os.path.join(root, path), errors='replace').read().splitlines()
            except OSError:
                files[path] = []
        n = int(lineno) - 1
        near = files[path][max(0, n - CONTEXT_LINES) : n + CONTEXT_LINES + 1]
        block = ' '.join(filter(None, (comment_text(path, l) for l in near))) or text
        rows.append((bool(SIGNAL.search(block)), f'  COMMENT     {path}:{lineno}: {line.strip()[:160]}'))
    if show_all or len(rows) <= PRINT_ALL_UP_TO:
        return [r for _, r in rows], 0
    kept = [r for signal, r in rows if signal]
    return kept, len(rows) - len(kept)


def patch_files():
    # {package as README names it: (patch file, version, path under node_modules)}
    # A patch of a nested copy, a++b+1.0.0.patch, is named "a > b".
    out = {}
    for p in sorted(os.listdir('patches')) if os.path.isdir('patches') else []:
        m = re.match(r'^(.+)\+(\d[^+]*)\.patch$', p)
        if m:
            chain = [seg.replace('+', '/') for seg in m.group(1).split('++')]
            out[' > '.join(chain)] = (p, m.group(2), '/node_modules/'.join(chain))
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


def print_patch(pkg, patch, ver, install_path, notes):
    # Prints one patch with its README entries; returns the problems found.
    installed = installed_version(install_path)
    note = '' if installed in (None, ver) else f'  (patch is for {ver}, installed {installed})'
    print(f'  PATCH       patches/{patch}{note}')
    problems = []
    entries = notes.get(pkg, [])
    if not entries:
        problems.append(f'patches/{patch}: no "## {pkg}" section with entries in patches/README.md')
    described = set()
    for title, fields in entries:
        print(f'    - {title}')
        for f in ('Upstream', 'Remove when'):
            if fields.get(f):
                print(f'        {f}: {fields[f][:200]}')
        missing = [f for f in FIELDS if not fields.get(f)]
        if missing:
            problems.append(f'{pkg} / {title}: missing {", ".join(missing)}')
        described.update(re.findall(r'`([^`]+)`', fields.get('Files', '')))
    if entries:
        diff = open(f'patches/{patch}').read()
        for path in re.findall(r'^diff --git a/node_modules/\S+ b/node_modules/(\S+)$', diff, re.M):
            rel = path[len(install_path) + 1 :] if path.startswith(install_path + '/') else path
            if rel not in described:
                problems.append(f'patches/{patch}: `{rel}` is not named in any entry\'s Files')
    for prob in problems:
        print(f'    !! {prob}')
    return problems


def check_patches():
    files, notes = patch_files(), patch_notes()
    problems = []
    for pkg, info in files.items():
        print(f'\n=== {pkg} ===')
        problems += print_patch(pkg, *info, notes)
    for pkg in notes:
        if pkg not in files:
            prob = f'patches/README.md: "## {pkg}" has no patch file; delete the section'
            print(f'\n!! {prob}')
            problems.append(prob)
    print(f'\n{len(problems)} problem(s)' if problems else '\nEvery patch is described in patches/README.md.')
    return problems


def memory_notes():
    common = git('rev-parse', '--path-format=absolute', '--git-common-dir').strip()
    mem = os.path.expanduser(f'~/.claude/projects/{re.sub(r"[/.]", "-", os.path.dirname(common))}/memory')
    out = []
    for f in sorted(os.listdir(mem)) if os.path.isdir(mem) else []:
        if f.endswith('.md') and f != 'MEMORY.md':
            try:
                out.append((f, open(os.path.join(mem, f)).read()))
            except OSError:
                pass
    return out


def main():
    ap = argparse.ArgumentParser(description='Inventory of workarounds per package; see the header of this file.')
    ap.add_argument('--base', default='master', help='ref to diff package.json against (default: master)')
    ap.add_argument('--all', action='store_true', help='print every comment that mentions the package')
    ap.add_argument('--patches', action='store_true', help='check patches/README.md against the patch files')
    ap.add_argument('packages', nargs='*')
    args = ap.parse_args()
    if not os.path.isfile('package.json'):
        sys.exit('Error: package.json not found. Run from shared/.')
    if args.patches:
        sys.exit(1 if check_patches() else 0)

    pkgs = [(n, None, None) for n in args.packages] or bumped(args.base)
    if not pkgs:
        print(f'No package versions differ from {args.base}.')
        return

    root = git('rev-parse', '--show-toplevel').strip()
    resolutions = json.load(open('package.json')).get('resolutions', {})
    patches, notes, memory = patch_files(), patch_notes(), memory_notes()

    for pkg, was, now in pkgs:
        print(f'\n=== {pkg}' + (f'  {was} -> {now}' if was else '') + ' ===')
        terms = terms_for(pkg)
        hit = matcher(terms)
        found = False

        for name, info in patches.items():
            if pkg in name.split(' > '):
                print_patch(name, *info, notes)
                found = True

        for key, ver in resolutions.items():
            if f'/{pkg}/' in f'/{key}/':
                print(f'  RESOLUTION  "{key}": "{ver}"')
                found = True

        rows, quiet = comments_for(hit, '|'.join(re.escape(t) for t in terms), root, args.all)
        print('\n'.join(rows), end='\n' if rows else '')
        if quiet:
            print(f'  ({quiet} more comment(s) mention it without a workaround signal nearby; --all shows them)')

        for f, body in memory:
            desc = re.search(r'^description:\s*(.*)$', body, re.M)
            head = f + ' ' + (desc.group(1) if desc else '')
            # a note is about the package when its name/description says so, or it keeps coming back to it
            if hit(head.replace('_', ' ')) or sum(hit(l) for l in body.splitlines()) >= 3:
                print(f'  MEMORY      {f}: {(desc.group(1).strip(chr(34)) if desc else "")[:150]}')
                found = True

        if not (found or rows or quiet):
            print('  nothing found')


main()
