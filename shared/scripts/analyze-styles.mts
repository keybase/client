import ts from 'typescript'
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'fs'
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

function suggestBorderCall(props: Record<string, string>): string | null {
  const color = props['borderColor']
  if (!color) return null
  const width = props['borderWidth'] ?? '1'
  const hasRadius = 'borderRadius' in props
  const hasBottomLeft = 'borderBottomLeftRadius' in props
  const hasBottomRight = 'borderBottomRightRadius' in props

  if (hasBottomLeft && hasBottomRight) {
    const rLeft = props['borderBottomLeftRadius']
    const rRight = props['borderBottomRightRadius']
    if (rLeft !== rRight) return null  // asymmetric — border() can't represent this
    return `...Kb.Styles.border(${color}, ${width}, ${rLeft}, true)`
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
      .flatMap(e => {
        const suggestedCall = suggestBorderCall(e.props)
        return suggestedCall ? [{...e, suggestedCall}] : []
      })

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

// ── CLI dispatch ─────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv
const flags: Record<string, string | true> = {}
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a?.startsWith('--')) {
    const eqIdx = a.indexOf('=')
    if (eqIdx !== -1) {
      flags[a.slice(2, eqIdx)] = a.slice(eqIdx + 1)
    } else if (i + 1 < args.length && !args[i + 1]!.startsWith('--')) {
      flags[a.slice(2)] = args[i + 1]!
      i++
    } else {
      flags[a.slice(2)] = true
    }
  }
}

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
