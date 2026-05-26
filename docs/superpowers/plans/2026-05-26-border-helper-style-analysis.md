# Border Helper + Style Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Kb.Styles.border()` helper to encode the dominant 4-property border pattern, and build a two-phase style analysis script + skill for ongoing pattern discovery.

**Architecture:** `border()` is a pure function added alongside `padding()` in `shared/styles/shared.tsx`. The analysis script (`shared/scripts/analyze-styles.mts`) uses the TypeScript compiler API to walk ASTs and extract style objects, writing structured JSON that persists across conversations. A skill file orchestrates the workflow.

**Tech Stack:** TypeScript (`.mts`, Node v25 native), TypeScript compiler API (`import ts from 'typescript'`), existing `shared/styles/shared.tsx` export chain.

---

## Files

| Action | Path | Purpose |
|---|---|---|
| Modify | `shared/styles/shared.tsx` | Add `border()` alongside `padding()` |
| Create | `shared/scripts/analyze-styles.mts` | Extract + analyze CLI |
| Create | `skill/keybase-style-analysis/SKILL.md` | Skill that orchestrates the workflow |

---

### Task 1: Add `border()` to shared/styles/shared.tsx

**Files:**
- Modify: `shared/styles/shared.tsx` (find the `padding` export, ~line 127)

- [ ] **Step 1: Add the border() function after padding()**

Open `shared/styles/shared.tsx`. Find the `padding` export and add `border` immediately after it:

```ts
export const border = (color: string, width = 1, radius?: number, justBottom?: boolean) => ({
  borderColor: color,
  borderStyle: 'solid' as const,
  borderWidth: width,
  ...(radius !== undefined
    ? justBottom
      ? {borderBottomLeftRadius: radius, borderBottomRightRadius: radius}
      : {borderRadius: radius}
    : {}),
})
```

- [ ] **Step 2: Verify lint and types pass**

```bash
cd shared && yarn lint-specific styles/shared.tsx && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/styles/shared.tsx
git commit -m "feat: add Kb.Styles.border() helper"
```

---

### Task 2: Create analyze-styles.mts — extract phase

**Files:**
- Create: `shared/scripts/analyze-styles.mts`

- [ ] **Step 1: Create the scripts directory and scaffold the file**

```bash
mkdir -p shared/scripts
```

Create `shared/scripts/analyze-styles.mts` with this full content:

```ts
import ts from 'typescript'
import {readFileSync, writeFileSync, readdirSync, statSync} from 'fs'
import {join, relative, dirname} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

type StyleEntry = {
  file: string
  source: 'styleSheetCreate' | 'platformStyles' | 'inline'
  name: string | null
  platform: string | null
  line: number
  props: Record<string, string>
}

type ExtractOutput = {
  version: 1
  extractedAt: string
  entries: StyleEntry[]
}

function findTsxFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...findTsxFiles(full))
    } else if (entry.endsWith('.tsx')) {
      results.push(full)
    }
  }
  return results
}

function lineOf(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1
}

function extractObjectProps(
  node: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile
): Record<string, string> {
  const props: Record<string, string> = {}
  for (const prop of node.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const key = prop.name.getText(sourceFile)
      const val = prop.initializer.getText(sourceFile)
      props[key] = val
    }
  }
  return props
}

function extractFromFile(filePath: string): StyleEntry[] {
  const rel = relative(ROOT, filePath)
  const source = readFileSync(filePath, 'utf-8')
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
  const entries: StyleEntry[] = []

  function visit(node: ts.Node) {
    // styleSheetCreate(() => ({ name: {...}, ... }))
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sf).endsWith('styleSheetCreate')
    ) {
      const arg = node.arguments[0]
      if (arg && ts.isArrowFunction(arg)) {
        const body = arg.body
        // body is either a ParenthesizedExpression wrapping an ObjectLiteralExpression
        // or a block — we only handle the arrow => ({...}) form
        const objNode =
          ts.isParenthesizedExpression(body) && ts.isObjectLiteralExpression(body.expression)
            ? body.expression
            : ts.isObjectLiteralExpression(body)
              ? body
              : null
        if (objNode) {
          for (const prop of objNode.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isObjectLiteralExpression(prop.initializer)) {
              const name = prop.name.getText(sf)
              const props = extractObjectProps(prop.initializer, sf)
              if (Object.keys(props).length > 0) {
                entries.push({
                  file: rel,
                  source: 'styleSheetCreate',
                  name,
                  platform: null,
                  line: lineOf(sf, prop.getStart(sf)),
                  props,
                })
              }
            }
          }
        }
      }
    }

    // platformStyles({common: {...}, isElectron: {...}, ...})
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sf).endsWith('platformStyles')
    ) {
      const arg = node.arguments[0]
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isObjectLiteralExpression(prop.initializer)) {
            const platform = prop.name.getText(sf)
            const props = extractObjectProps(prop.initializer, sf)
            if (Object.keys(props).length > 0) {
              entries.push({
                file: rel,
                source: 'platformStyles',
                name: null,
                platform,
                line: lineOf(sf, prop.getStart(sf)),
                props,
              })
            }
          }
        }
      }
    }

    // JSX style={...} attributes
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sf)
      if (attrName === 'style' && node.initializer && ts.isJsxExpression(node.initializer)) {
        const expr = node.initializer.expression
        if (expr && ts.isObjectLiteralExpression(expr)) {
          const props = extractObjectProps(expr, sf)
          if (Object.keys(props).length > 0) {
            entries.push({
              file: rel,
              source: 'inline',
              name: null,
              platform: null,
              line: lineOf(sf, node.getStart(sf)),
              props,
            })
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return entries
}

function runExtract(outputPath: string) {
  const files = findTsxFiles(ROOT)
  console.error(`Scanning ${files.length} TSX files...`)
  const entries: StyleEntry[] = []
  let count = 0
  for (const f of files) {
    try {
      const found = extractFromFile(f)
      entries.push(...found)
      count++
      if (count % 50 === 0) process.stderr.write(`  ${count}/${files.length}\r`)
    } catch {
      // skip unparseable files silently
    }
  }
  const out: ExtractOutput = {version: 1, extractedAt: new Date().toISOString(), entries}
  writeFileSync(outputPath, JSON.stringify(out, null, 2))
  console.error(`\nExtracted ${entries.length} style objects from ${files.length} files → ${outputPath}`)
}

// ── Analyze phase placeholder (Task 3) ──────────────────────────────────────

function runAnalyze(_inputPath: string, _helperFilter: string | null, _minCount: number) {
  console.log('analyze: not yet implemented (Task 3)')
}

// ── CLI dispatch ─────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=')
    return [k, v ?? true]
  })
)

if (cmd === 'extract') {
  const output = (flags['output'] as string | undefined) ?? '/tmp/keybase-styles.json'
  runExtract(output)
} else if (cmd === 'analyze') {
  const input = (flags['input'] as string | undefined) ?? '/tmp/keybase-styles.json'
  const helper = (flags['helper'] as string | undefined) ?? null
  const minCount = Number(flags['min-count'] ?? 3)
  runAnalyze(input, helper, minCount)
} else {
  console.error('Usage: node scripts/analyze-styles.mts extract [--output /tmp/keybase-styles.json]')
  console.error('       node scripts/analyze-styles.mts analyze [--input /tmp/keybase-styles.json] [--helper border] [--min-count 3]')
  process.exit(1)
}
```

- [ ] **Step 2: Run extract and verify output**

```bash
cd shared && node scripts/analyze-styles.mts extract --output /tmp/keybase-styles.json
```

Expected stderr: `Extracted NNN style objects from MMM files → /tmp/keybase-styles.json`  
Expected: `/tmp/keybase-styles.json` exists, is valid JSON with `version`, `extractedAt`, `entries` array.

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/keybase-styles.json','utf8')); console.log('entries:', d.entries.length, 'sample:', JSON.stringify(d.entries[0], null, 2))"
```

Expected: entries count > 200, sample shows a valid `StyleEntry` with `file`, `source`, `props` keys.

- [ ] **Step 3: Commit**

```bash
git add shared/scripts/analyze-styles.mts
git commit -m "feat: add style analysis script (extract phase)"
```

---

### Task 3: Add analyze phase to analyze-styles.mts

**Files:**
- Modify: `shared/scripts/analyze-styles.mts`

- [ ] **Step 1: Replace the runAnalyze stub with the full implementation**

Replace the `runAnalyze` function (the `// ── Analyze phase placeholder` section through the end of `runAnalyze`) with:

```ts
// ── Known helper signatures (for gap detection) ──────────────────────────────

type HelperGap = {
  file: string
  line: number
  source: string
  name: string | null
  props: Record<string, string>
  suggestedCall: string
}

function isBorderGap(props: Record<string, string>): boolean {
  const keys = Object.keys(props)
  return (
    keys.includes('borderColor') &&
    keys.includes('borderWidth') &&
    keys.includes('borderStyle') &&
    props['borderStyle']?.replace(/['"]/g, '') === 'solid'
  )
}

function suggestBorderCall(props: Record<string, string>): string {
  const color = props['borderColor'] ?? 'unknown'
  const width = props['borderWidth'] ?? '1'
  const hasRadius = 'borderRadius' in props
  const hasBottomLeft = 'borderBottomLeftRadius' in props
  const hasBottomRight = 'borderBottomRightRadius' in props

  if (hasBottomLeft && hasBottomRight) {
    const r = props['borderBottomLeftRadius'] ?? props['borderBottomRightRadius']
    return `...Kb.Styles.border(${color}, ${width}, ${r}, true)`
  }
  if (hasRadius) {
    return `...Kb.Styles.border(${color}, ${width}, ${props['borderRadius']})`
  }
  if (width === '1') {
    return `...Kb.Styles.border(${color})`
  }
  return `...Kb.Styles.border(${color}, ${width})`
}

// ── Pattern clustering ────────────────────────────────────────────────────────

const BORDER_PROPS = new Set([
  'borderColor', 'borderStyle', 'borderWidth', 'borderRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  'borderTopLeftRadius', 'borderTopRightRadius',
])

function borderCluster(props: Record<string, string>): string {
  return Object.keys(props)
    .filter(k => BORDER_PROPS.has(k))
    .sort()
    .join('+')
}

function runAnalyze(inputPath: string, helperFilter: string | null, minCount: number) {
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`)
    console.error('Run extract first: node scripts/analyze-styles.mts extract')
    process.exit(1)
  }
  const data: ExtractOutput = JSON.parse(readFileSync(inputPath, 'utf-8'))
  console.log(`Loaded ${data.entries.length} style entries from ${inputPath} (extracted ${data.extractedAt})\n`)

  // ── Gap detection: border() ──────────────────────────────────────────────
  if (!helperFilter || helperFilter === 'border') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isBorderGap(e.props))
      .map(e => ({...e, suggestedCall: suggestBorderCall(e.props)}))

    console.log(`=== border() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  // ── Pattern detection: new helper candidates ─────────────────────────────
  if (!helperFilter) {
    type ClusterInfo = {count: number; examples: Array<{file: string; line: number; props: Record<string, string>}>; valueSample: Record<string, string[]>}
    const clusters = new Map<string, ClusterInfo>()

    for (const entry of data.entries) {
      const cluster = borderCluster(entry.props)
      if (!cluster) continue
      const existing = clusters.get(cluster) ?? {count: 0, examples: [], valueSample: {}}
      existing.count++
      if (existing.examples.length < 3) existing.examples.push({file: entry.file, line: entry.line, props: entry.props})
      for (const [k, v] of Object.entries(entry.props)) {
        if (BORDER_PROPS.has(k)) {
          existing.valueSample[k] = [...new Set([...(existing.valueSample[k] ?? []), v])].slice(0, 5)
        }
      }
      clusters.set(cluster, existing)
    }

    const candidates = [...clusters.entries()]
      .filter(([, info]) => info.count >= minCount)
      .sort((a, b) => b[1].count - a[1].count)

    console.log(`=== New helper candidates (>= ${minCount} occurrences) ===\n`)
    for (const [cluster, info] of candidates) {
      console.log(`  [${info.count}x]  ${cluster}`)
      for (const [k, vals] of Object.entries(info.valueSample)) {
        console.log(`      ${k}: ${vals.join(' | ')}`)
      }
      for (const ex of info.examples) {
        console.log(`      e.g. ${ex.file}:${ex.line}`)
      }
      console.log()
    }
    if (candidates.length === 0) console.log(`  (none meeting threshold of ${minCount})\n`)
  }
}
```

Also add `existsSync` to the imports at the top — change:
```ts
import {readFileSync, writeFileSync, readdirSync, statSync} from 'fs'
```
to:
```ts
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'fs'
```

- [ ] **Step 2: Run analyze and verify output**

First ensure the extract file exists (re-run extract if needed):
```bash
cd shared && node scripts/analyze-styles.mts extract --output /tmp/keybase-styles.json
```

Then run analyze:
```bash
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json
```

Expected output includes two sections:
1. `=== border() gap detection: NN sites ===` with file:line entries and `→ ...Kb.Styles.border(...)` suggestions
2. `=== New helper candidates ===` showing property clusters and counts

Check border-specific gaps only:
```bash
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json --helper border
```

Expected: only the gap section, no pattern section.

- [ ] **Step 3: Lint and type-check**

```bash
cd shared && yarn lint-specific scripts/analyze-styles.mts && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add shared/scripts/analyze-styles.mts
git commit -m "feat: add analyze phase to style analysis script"
```

---

### Task 4: Create keybase-style-analysis skill

**Files:**
- Create: `skill/keybase-style-analysis/SKILL.md`

- [ ] **Step 1: Create the skill directory and file**

```bash
mkdir -p /Users/chrisnojima/go/src/github.com/keybase/client/skill/keybase-style-analysis
```

Create `skill/keybase-style-analysis/SKILL.md`:

```markdown
---
name: keybase-style-analysis
description: Use when auditing Keybase client styles for helper opportunities, finding border/padding refactor sites, or discovering new style helper candidates.
---

# Keybase Style Analysis

Extracts and analyzes style objects from all TSX source files. Two phases: extract (slow, produces a persistent JSON snapshot) and analyze (fast, reads the snapshot).

## When to use extract

Re-run extract when:
- The snapshot file doesn't exist yet (`/tmp/keybase-styles.json`)
- You've made significant style changes and want fresh data
- User passes `--fresh`

Skip extract when:
- The snapshot already exists and changes since extraction are minor

## Workflow

### Phase 1: Extract (run from shared/)

```bash
cd /Users/chrisnojima/go/src/github.com/keybase/client/shared
node scripts/analyze-styles.mts extract --output /tmp/keybase-styles.json
```

Takes ~10–30 seconds. Writes structured JSON with one entry per style object (styleSheetCreate, platformStyles, and inline JSX style props).

### Phase 2: Analyze

Full audit — gaps + new candidates:
```bash
cd /Users/chrisnojima/go/src/github.com/keybase/client/shared
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json
```

Border gaps only:
```bash
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json --helper border
```

Raise the minimum count threshold (default 3):
```bash
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json --min-count 5
```

## Interpreting output

### Gap detection output

Each line shows a file and line number where an existing helper could be used but isn't, plus the suggested replacement call:

```
chat/audio/audio-player.tsx:123 (container)
  → ...Kb.Styles.border(Kb.Styles.globalColors.grey, 1, Kb.Styles.borderRadius)
```

When showing these to the user, group by file and present the top 10–15 highest-value sites. Ask which files they want to migrate first.

### New helper candidates output

Shows clusters of border properties that co-occur frequently:

```
[12x]  borderColor+borderRadius+borderStyle+borderWidth
    borderColor: Kb.Styles.globalColors.black_10 | globalColors.grey
    ...
```

When recommending a new helper, include: what it would be named, its signature, the number of call sites it would clean up, and 2–3 example current usages vs. the proposed call.

## After analysis

- For gap sites: offer to migrate them file-by-file or all at once
- For new helper candidates: present the proposed helper signature and get approval before adding it
- After migrating, run `yarn lint && yarn tsc` from `shared/` to verify
```

- [ ] **Step 2: Verify the skill appears in system context**

Restart Claude Code (or open a new session) and verify `keybase-style-analysis` appears in the available skills list in the session start reminder.

- [ ] **Step 3: Commit**

```bash
git add skill/keybase-style-analysis/SKILL.md
git commit -m "feat: add keybase-style-analysis skill"
```
