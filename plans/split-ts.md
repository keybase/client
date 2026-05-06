# Split TypeScript Config (Desktop vs Native) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `shared/tsconfig.json` with per-platform configs so that `dom` APIs are forbidden in native code, native-only APIs are forbidden in desktop code, and the `.d.ts` type stubs are eliminated in favor of auto-generated `paths` that resolve directly to platform implementation files.

**Architecture:** A generator script (`shared/tools/gen-ts-paths.mjs`) scans the filesystem for modules that have `.desktop.tsx`/`.native.tsx` variants but no plain `.tsx`, then writes `tsconfig.paths.desktop.json` and `tsconfig.paths.native.json`. Each platform tsconfig extends `tsconfig.base.json` plus its generated paths file (TypeScript 5.0 array `extends`). The generated files are gitignored and regenerated before every type-check. Because TypeScript `paths` only intercept non-relative import specifiers, this works cleanly for the `@/*` alias style used throughout the codebase.

**Tech Stack:** TypeScript (`tsgo`), tsconfig `extends` array (TS 5.0+), Node ESM script, `yarn` scripts

---

## File Map

| File | Action |
|---|---|
| `shared/tsconfig.json` | Modify → editor fallback, extends desktop |
| `shared/tsconfig.base.json` | Create — platform-agnostic compiler options |
| `shared/tsconfig.desktop.json` | Create — desktop lib/types, extends base + generated paths |
| `shared/tsconfig.native.json` | Create — native lib/types, extends base + generated paths |
| `shared/tsconfig.paths.desktop.json` | Generated (gitignored) — `@/foo` → `./foo.desktop` mappings |
| `shared/tsconfig.paths.native.json` | Generated (gitignored) — `@/foo` → `./foo.native` mappings |
| `shared/tools/gen-ts-paths.mjs` | Create — generator script |
| `shared/package.json` | Modify `tsc` script to run generator then both platform configs |
| `shared/**/*.d.ts` | Delete — replaced by generated paths (keep only non-platform stubs) |
| `.gitignore` | Modify — add generated paths files |

---

### Task 1: Create tsconfig.base.json

Extract platform-agnostic options from the current `shared/tsconfig.json`. `lib`, `types`, `outDir`, and `tsBuildInfoFile` are intentionally omitted — each platform config sets those.

**Files:**
- Create: `shared/tsconfig.base.json`

- [ ] **Step 1: Create the file**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "allowJs": false,
    "allowImportingTsExtensions": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "checkJs": false,
    "incremental": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "module": "preserve",
    "moduleResolution": "bundler",
    "exactOptionalPropertyTypes": false,
    "noEmit": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitAny": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": false,
    "strict": true,
    "target": "esnext"
  },
  "watchOptions": {
    "watchFile": "useFsEvents",
    "watchDirectory": "useFsEvents",
    "fallbackPolling": "dynamicPriority",
    "synchronousWatchDirectory": true,
    "excludeDirectories": ["**/node_modules", "./desktop/dist", "./desktop/build"]
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd shared && git add tsconfig.base.json
git commit -m "build: add tsconfig.base.json"
```

---

### Task 2: Write the paths generator script

This script scans `shared/` for modules that have only platform-specific variants (e.g. `foo.desktop.tsx` + `foo.native.tsx` but no `foo.tsx`) and writes two generated tsconfig paths files.

**Files:**
- Create: `shared/tools/gen-ts-paths.mjs`

- [ ] **Step 1: Create the script**

```js
#!/usr/bin/env node
import {readdirSync, statSync, writeFileSync, existsSync} from 'fs'
import {join, relative, dirname, basename, extname} from 'path'
import {fileURLToPath} from 'url'

const sharedDir = join(fileURLToPath(import.meta.url), '..', '..')

const PLATFORMS = ['desktop', 'native']
const EXTENSIONS = ['.tsx', '.ts', '.mts']
const SKIP_DIRS = new Set(['node_modules', '.tsOuts', 'dist', 'build', 'tools'])

function walk(dir, results = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), results)
    } else {
      results.push(join(dir, entry.name))
    }
  }
  return results
}

function stripExt(file) {
  for (const ext of EXTENSIONS) {
    if (file.endsWith(ext)) return file.slice(0, -ext.length)
  }
  return file
}

// Collect all files
const allFiles = new Set(walk(sharedDir))

// For each platform, find modules that have a platform variant but no plain variant
function buildPaths(platform) {
  const paths = {'@/*': ['./*']}

  for (const file of allFiles) {
    for (const ext of EXTENSIONS) {
      const suffix = `.${platform}${ext}`
      if (!file.endsWith(suffix)) continue

      // e.g. /shared/styles/index.desktop.tsx → base = /shared/styles/index
      const base = file.slice(0, -suffix.length)

      // Check if a plain variant exists (foo.tsx / foo.ts / foo.mts)
      const hasPlain = EXTENSIONS.some(e => existsSync(base + e))
      if (hasPlain) continue

      // Generate the @/* key and value
      const rel = relative(sharedDir, base) // e.g. "styles/index"
      const key = `@/${rel}`               // e.g. "@/styles/index"
      const value = `./${rel}.${platform}` // e.g. "./styles/index.desktop"
      paths[key] = [value]
    }
  }

  return paths
}

for (const platform of PLATFORMS) {
  const paths = buildPaths(platform)
  const out = {compilerOptions: {paths}}
  const outFile = join(sharedDir, `tsconfig.paths.${platform}.json`)
  writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote tsconfig.paths.${platform}.json (${Object.keys(paths).length - 1} platform paths)`)
}
```

- [ ] **Step 2: Make it executable and run it**

```bash
cd shared && chmod +x tools/gen-ts-paths.mjs && node tools/gen-ts-paths.mjs
```

Expected output (numbers will vary):
```
wrote tsconfig.paths.desktop.json (47 platform paths)
wrote tsconfig.paths.native.json (47 platform paths)
```

- [ ] **Step 3: Spot-check the output**

```bash
head -30 shared/tsconfig.paths.desktop.json
```

Expected to see entries like:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/styles/index": ["./styles/index.desktop"],
      "@/engine/index": ["./engine/index.desktop"],
      "@/common-adapters/animation": ["./common-adapters/animation.desktop"],
      ...
    }
  }
}
```

- [ ] **Step 4: Commit the script (not the generated files)**

```bash
cd shared && git add tools/gen-ts-paths.mjs
git commit -m "build: add gen-ts-paths.mjs to generate per-platform tsconfig paths"
```

---

### Task 3: Gitignore the generated paths files

**Files:**
- Modify: root `.gitignore` or `shared/.gitignore`

- [ ] **Step 1: Check which gitignore to update**

```bash
ls /Users/chrisnojima/go/src/github.com/keybase/client/shared/.gitignore 2>/dev/null && echo "shared gitignore exists" || echo "use root"
```

- [ ] **Step 2: Add entries**

Add to whichever `.gitignore` covers `shared/`:
```
shared/tsconfig.paths.desktop.json
shared/tsconfig.paths.native.json
shared/.tsOuts/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore generated tsconfig paths files and tsOuts"
```

---

### Task 4: Create tsconfig.desktop.json

**Files:**
- Create: `shared/tsconfig.desktop.json`

- [ ] **Step 1: Ensure paths files are generated**

```bash
cd shared && node tools/gen-ts-paths.mjs
```

- [ ] **Step 2: Create the file**

The `extends` array is processed left-to-right; later entries win on conflicts. The generated paths file comes last so its `paths` (which includes `@/*`) fully replaces the base's empty paths.

```json
{
  "extends": ["./tsconfig.base.json", "./tsconfig.paths.desktop.json"],
  "compilerOptions": {
    "lib": ["ESNext", "dom"],
    "types": ["jest", "node", "webpack-env"],
    "outDir": "./.tsOuts/.tsOut-desktop/emit",
    "tsBuildInfoFile": "./.tsOuts/.tsOut-desktop/cache"
  },
  "include": ["./**/*.mts", "./**/*.mjs", "./**/*.ts", "./**/*.tsx"],
  "exclude": [
    "**/node_modules",
    "./desktop/dist",
    "./desktop/build",
    "./**/*.native.tsx",
    "./**/*.native.ts",
    "./**/*.android.tsx",
    "./**/*.android.ts",
    "./**/*.ios.tsx",
    "./**/*.ios.ts",
    "./common-adapters/icon.constants-gen.desktop.tsx",
    "./common-adapters/icon.constants-gen.native.tsx",
    "./common-adapters/icon.constants-gen.shared.tsx"
  ]
}
```

- [ ] **Step 3: Run desktop type-check**

```bash
cd shared && ./node_modules/.bin/tsgo --project tsconfig.desktop.json 2>&1 | tee /tmp/desktop-ts-errors.txt | wc -l
```

Expected: same error count as the current `yarn tsc` (this is the baseline, desktop is the superset).

- [ ] **Step 4: Commit**

```bash
cd shared && git add tsconfig.desktop.json
git commit -m "build: add tsconfig.desktop.json"
```

---

### Task 5: Create tsconfig.native.json

**Files:**
- Create: `shared/tsconfig.native.json`

- [ ] **Step 1: Create the file**

No `dom` in lib, no `webpack-env` in types, excludes all `*.desktop.*` and the whole `./desktop/` directory.

```json
{
  "extends": ["./tsconfig.base.json", "./tsconfig.paths.native.json"],
  "compilerOptions": {
    "lib": ["ESNext"],
    "types": ["jest", "node"],
    "outDir": "./.tsOuts/.tsOut-native/emit",
    "tsBuildInfoFile": "./.tsOuts/.tsOut-native/cache"
  },
  "include": ["./**/*.mts", "./**/*.mjs", "./**/*.ts", "./**/*.tsx"],
  "exclude": [
    "**/node_modules",
    "./desktop",
    "./**/*.desktop.tsx",
    "./**/*.desktop.ts",
    "./common-adapters/icon.constants-gen.desktop.tsx",
    "./common-adapters/icon.constants-gen.native.tsx",
    "./common-adapters/icon.constants-gen.shared.tsx"
  ]
}
```

- [ ] **Step 2: Run native type-check and collect errors**

```bash
cd shared && ./node_modules/.bin/tsgo --project tsconfig.native.json 2>&1 | tee /tmp/native-ts-errors.txt | wc -l
cat /tmp/native-ts-errors.txt | head -80
```

There will be errors — some from native files accidentally using DOM APIs, and some from `.d.ts` stubs that the native paths haven't replaced yet. Note the count.

- [ ] **Step 3: Commit the config**

```bash
cd shared && git add tsconfig.native.json
git commit -m "build: add tsconfig.native.json (errors to fix in subsequent tasks)"
```

---

### Task 6: Delete .d.ts stubs covered by generated paths

Now that `@/*` imports resolve to the real platform files via paths, the corresponding `.d.ts` stubs are redundant. Delete them platform-split ones; keep any that cover non-platform-split things (e.g. `globals.d.ts`, `css.d.ts`).

**Files:**
- Delete: platform-split `.d.ts` stubs (those next to `.desktop.tsx`/`.native.tsx` pairs)
- Keep: `globals.d.ts`, `css.d.ts`, `local-debug.d.ts`, and any stub for a module with no platform files

- [ ] **Step 1: Identify which stubs to delete**

```bash
cd shared && node - <<'EOF'
import {readdirSync, existsSync} from 'fs'
import {join, dirname, basename} from 'path'
import {fileURLToPath} from 'url'
import {execSync} from 'child_process'

const files = execSync('find . -name "*.d.ts" -not -path "*/node_modules/*"', {encoding: 'utf8'})
  .trim().split('\n')

for (const f of files) {
  const base = f.replace(/\.d\.ts$/, '')
  const hasDesktop = existsSync(base + '.desktop.tsx') || existsSync(base + '.desktop.ts')
  const hasNative  = existsSync(base + '.native.tsx')  || existsSync(base + '.native.ts')
  if (hasDesktop || hasNative) console.log('DELETE:', f)
  else console.log('KEEP:  ', f)
}
EOF
```

- [ ] **Step 2: Delete the identified stubs**

Run the deletions from the output of Step 1. Example pattern:
```bash
cd shared && rm \
  styles/index.d.ts \
  engine/index.d.ts \
  engine/index.platform.d.ts \
  engine/session.d.ts \
  common-adapters/animation.d.ts \
  # ... all DELETE entries from Step 1
```

- [ ] **Step 3: Run both type-checks to see remaining errors**

```bash
cd shared && node tools/gen-ts-paths.mjs && \
  ./node_modules/.bin/tsgo --project tsconfig.desktop.json 2>&1 | tee /tmp/desktop-after-delete.txt | wc -l && \
  ./node_modules/.bin/tsgo --project tsconfig.native.json  2>&1 | tee /tmp/native-after-delete.txt  | wc -l
```

- [ ] **Step 4: Commit deletions**

```bash
cd shared && git add -A
git commit -m "build: delete .d.ts stubs replaced by generated tsconfig paths"
```

---

### Task 7: Fix remaining type errors

Work through errors in `/tmp/desktop-after-delete.txt` and `/tmp/native-after-delete.txt`.

**Files:** Whichever source files surface errors.

Two categories of errors to expect:

**A) Native file uses DOM API** — e.g. `window`, `document`, `HTMLElement`, CSS properties like `cursor`:

```tsx
// Before (in a *.native.tsx file):
const el = document.getElementById('foo')

// After: this is a native file — use the RN equivalent or remove
// Native doesn't have a DOM; find the React Native alternative
```

**B) Import of a module whose stub was deleted but paths didn't cover it** (rare: within-directory relative import of a platform-split module):

```tsx
// Before:
import Foo from './some-split-module'  // relative import — paths don't apply

// After option 1: convert to @/* alias so paths can resolve it
import Foo from '@/path/to/some-split-module'

// After option 2: keep a minimal .d.ts stub for this specific file only
```

**C) Type from a deleted stub that was platform-specific** — if the `.d.ts` stub exported types that differ between platforms, the real implementation files may expose those differences. Align the callers to the real types.

- [ ] **Step 1: Fix desktop errors from /tmp/desktop-after-delete.txt**

```bash
cat /tmp/desktop-after-delete.txt
```

Fix each error. Re-run after each file fixed:
```bash
cd shared && ./node_modules/.bin/tsgo --project tsconfig.desktop.json 2>&1 | wc -l
```

- [ ] **Step 2: Fix native errors from /tmp/native-after-delete.txt**

```bash
cat /tmp/native-after-delete.txt
```

Fix each error. Re-run after each file fixed:
```bash
cd shared && ./node_modules/.bin/tsgo --project tsconfig.native.json 2>&1 | wc -l
```

- [ ] **Step 3: Verify both pass clean**

```bash
cd shared && node tools/gen-ts-paths.mjs && \
  ./node_modules/.bin/tsgo --project tsconfig.desktop.json 2>&1 | wc -l && \
  ./node_modules/.bin/tsgo --project tsconfig.native.json  2>&1 | wc -l
```

Expected: `0` on both lines.

- [ ] **Step 4: Commit fixes**

```bash
cd shared && git add -p
git commit -m "fix: resolve type errors surfaced by per-platform tsconfig split"
```

---

### Task 8: Update tsconfig.json to be the editor fallback

Editors pick up `shared/tsconfig.json`. Point it at the desktop config (broadest types, includes `dom`).

**Files:**
- Modify: `shared/tsconfig.json`

- [ ] **Step 1: Replace the file content**

```json
{
  "extends": "./tsconfig.desktop.json"
}
```

- [ ] **Step 2: Verify**

```bash
cd shared && node tools/gen-ts-paths.mjs && ./node_modules/.bin/tsgo --project tsconfig.json 2>&1 | wc -l
```

Expected: `0`.

- [ ] **Step 3: Commit**

```bash
cd shared && git add tsconfig.json
git commit -m "build: tsconfig.json is editor fallback (extends tsconfig.desktop.json)"
```

---

### Task 9: Update package.json tsc script

`yarn tsc` must regenerate paths then check both platforms.

**Files:**
- Modify: `shared/package.json`

- [ ] **Step 1: Update the script**

Find:
```json
"tsc": "./node_modules/.bin/tsgo --project ./tsconfig.json",
```

Replace with:
```json
"tsc": "node ./tools/gen-ts-paths.mjs && ./node_modules/.bin/tsgo --project ./tsconfig.desktop.json && ./node_modules/.bin/tsgo --project ./tsconfig.native.json",
```

- [ ] **Step 2: Run the full script end-to-end**

```bash
cd shared && yarn tsc
```

Expected: exits 0, both platform checks pass after path generation.

- [ ] **Step 3: Commit**

```bash
cd shared && git add package.json
git commit -m "build: yarn tsc generates paths and checks desktop + native configs"
```

---

## Self-Review Checklist

- [x] **Generator script** scans filesystem and writes both paths files, always including `@/*`
- [x] **tsconfig.base.json** has all platform-agnostic options, no lib/types
- [x] **tsconfig.desktop.json** adds `dom`, `webpack-env`, excludes `.native.*` files
- [x] **tsconfig.native.json** drops `dom`/`webpack-env`, excludes `.desktop.*` and `./desktop/`
- [x] **Generated paths files** are gitignored
- [x] **Platform-split .d.ts stubs** deleted; non-platform stubs (`globals.d.ts` etc.) kept
- [x] **tsconfig.json** is editor fallback extending desktop
- [x] **yarn tsc** runs generator then both platform configs
- [x] **Relative-import limitation documented**: paths only intercept `@/*` imports; any within-directory relative import of a split module needs a stub or conversion to `@/*`
