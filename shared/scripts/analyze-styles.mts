import ts from 'typescript'
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'fs'
import {join, relative, dirname} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

type HelperCall = {
  name: string   // 'border', 'paddingH', 'textEllipsis', etc.
  call: string   // full source text of the expression
  args: string[] // argument source texts (empty for property helpers like textEllipsis)
}

type StyleEntry = {
  file: string
  source: 'styleSheetCreate' | 'platformStyles' | 'inline'
  name: string | null
  platform: string | null
  line: number
  props: Record<string, string>   // literal CSS props in source
  helperCalls?: HelperCall[]      // spread helper calls found in this style object
}

type ExtractOutput = {
  version: 2
  extractedAt: string
  entries: StyleEntry[]
}

// ── Helper name detection ────────────────────────────────────────────────────

const KNOWN_HELPERS = new Set([
  'border', 'padding', 'paddingH', 'paddingV',
  'marginH', 'marginV', 'size',
  'roundedBottom', 'topDivider', 'textEllipsis',
])

function getHelperName(text: string): string | null {
  const parts = text.split('.')
  const last = parts[parts.length - 1]
  return last && KNOWN_HELPERS.has(last) ? last : null
}

// ── Helper expansion for computed view ──────────────────────────────────────

function expandHelperCall(call: HelperCall): Record<string, string> {
  const a = call.args
  switch (call.name) {
    case 'border': {
      const color = a[0] ?? ''
      const width = a[1] ?? '1'
      const result: Record<string, string> = {
        borderColor: color,
        borderWidth: width,
        borderStyle: "'solid'",
      }
      if (a[2]) result['borderRadius'] = a[2]
      return result
    }
    case 'padding': {
      const t = a[0] ?? '0', r = a[1], b = a[2], l = a[3]
      if (!r) return {paddingTop: t, paddingRight: t, paddingBottom: t, paddingLeft: t}
      if (!b) return {paddingTop: t, paddingRight: r, paddingBottom: t, paddingLeft: r}
      if (!l) return {paddingTop: t, paddingRight: r, paddingBottom: b, paddingLeft: r}
      return {paddingTop: t, paddingRight: r, paddingBottom: b, paddingLeft: l}
    }
    case 'paddingH':   return {paddingLeft: a[0] ?? '0', paddingRight: a[0] ?? '0'}
    case 'paddingV':   return {paddingTop: a[0] ?? '0', paddingBottom: a[0] ?? '0'}
    case 'marginH':    return {marginLeft: a[0] ?? '0', marginRight: a[0] ?? '0'}
    case 'marginV':    return {marginTop: a[0] ?? '0', marginBottom: a[0] ?? '0'}
    case 'size':       return {height: a[0] ?? '0', width: a[0] ?? '0'}
    case 'roundedBottom': return {
      borderBottomLeftRadius: 'Kb.Styles.borderRadius',
      borderBottomRightRadius: 'Kb.Styles.borderRadius',
      overflow: "'hidden'",
    }
    case 'topDivider': return {
      borderTopColor: 'Kb.Styles.globalColors.black_10',
      borderTopWidth: '1',
      borderStyle: "'solid'",
      minHeight: '56',
    }
    case 'textEllipsis': return {
      overflow: "'hidden'",
      textOverflow: "'ellipsis'",
      whiteSpace: "'nowrap'",
    }
    default: return {}
  }
}

function computedPropsOf(entry: StyleEntry): Record<string, string> {
  const result = {...entry.props}
  for (const call of (entry.helperCalls ?? [])) {
    Object.assign(result, expandHelperCall(call))
  }
  return result
}

// ── File traversal ───────────────────────────────────────────────────────────

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

// ── Style object extraction ──────────────────────────────────────────────────

function extractStyleContents(
  node: ts.ObjectLiteralExpression,
  sf: ts.SourceFile
): {props: Record<string, string>; helperCalls: HelperCall[]} {
  const props: Record<string, string> = {}
  const helperCalls: HelperCall[] = []

  for (const prop of node.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const key = prop.name.getText(sf)
      const val = prop.initializer.getText(sf)
      props[key] = val
    } else if (ts.isSpreadAssignment(prop)) {
      const expr = prop.expression
      if (ts.isCallExpression(expr)) {
        const callText = expr.expression.getText(sf)
        const name = getHelperName(callText)
        if (name) {
          helperCalls.push({
            name,
            call: expr.getText(sf),
            args: expr.arguments.map(a => a.getText(sf)),
          })
        }
      } else {
        // Property helper like ...Kb.Styles.textEllipsis (no call parens)
        const text = expr.getText(sf)
        const name = getHelperName(text)
        if (name) {
          helperCalls.push({name, call: text, args: []})
        }
      }
    }
  }

  return {props, helperCalls}
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
              const {props, helperCalls} = extractStyleContents(prop.initializer, sf)
              if (Object.keys(props).length > 0 || helperCalls.length > 0) {
                entries.push({
                  file: rel,
                  source: 'styleSheetCreate',
                  name,
                  platform: null,
                  line: lineOf(sf, prop.getStart(sf)),
                  props,
                  helperCalls,
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
            const {props, helperCalls} = extractStyleContents(prop.initializer, sf)
            if (Object.keys(props).length > 0 || helperCalls.length > 0) {
              entries.push({
                file: rel,
                source: 'platformStyles',
                name: null,
                platform,
                line: lineOf(sf, prop.getStart(sf)),
                props,
                helperCalls,
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
          const {props, helperCalls} = extractStyleContents(expr, sf)
          if (Object.keys(props).length > 0 || helperCalls.length > 0) {
            entries.push({
              file: rel,
              source: 'inline',
              name: null,
              platform: null,
              line: lineOf(sf, node.getStart(sf)),
              props,
              helperCalls,
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
  const out: ExtractOutput = {version: 2, extractedAt: new Date().toISOString(), entries}
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
    if (rLeft !== rRight) return null
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

function isPaddingGap(props: Record<string, string>): boolean {
  return (
    'paddingTop' in props &&
    'paddingRight' in props &&
    'paddingBottom' in props &&
    'paddingLeft' in props
  )
}

function suggestPaddingCall(props: Record<string, string>): string | null {
  const t = props['paddingTop']
  const r = props['paddingRight']
  const b = props['paddingBottom']
  const l = props['paddingLeft']
  if (!t || !r || !b || !l) return null

  if (t === r && t === b && t === l) return `...Kb.Styles.padding(${t})`
  if (t === b && r === l) return `...Kb.Styles.padding(${t}, ${r})`
  if (r === l) return `...Kb.Styles.padding(${t}, ${r}, ${b})`
  return `...Kb.Styles.padding(${t}, ${r}, ${b}, ${l})`
}

function isTopDividerGap(props: Record<string, string>): boolean {
  return (
    'borderTopColor' in props &&
    'borderTopWidth' in props &&
    'borderStyle' in props &&
    'minHeight' in props &&
    (props['borderStyle'] ?? '').replace(/['"]/g, '').trim().startsWith('solid') &&
    props['borderTopWidth'] === '1' &&
    props['minHeight'] === '56'
  )
}
function suggestTopDividerCall(_props: Record<string, string>): string {
  return '...Kb.Styles.topDivider()'
}

function isRoundedBottomGap(props: Record<string, string>): boolean {
  const bl = props['borderBottomLeftRadius']
  const br = props['borderBottomRightRadius']
  return (
    'borderBottomLeftRadius' in props &&
    'borderBottomRightRadius' in props &&
    'overflow' in props &&
    (props['overflow'] ?? '').replace(/['"]/g, '') === 'hidden' &&
    bl === br &&
    (bl === 'Kb.Styles.borderRadius' || bl === 'Styles.borderRadius' || bl === 'borderRadius')
  )
}
function suggestRoundedBottomCall(_props: Record<string, string>): string {
  return '...Kb.Styles.roundedBottom()'
}

function isTextEllipsisGap(props: Record<string, string>): boolean {
  return (
    'overflow' in props &&
    'textOverflow' in props &&
    'whiteSpace' in props &&
    (props['overflow'] ?? '').replace(/['"]/g, '') === 'hidden' &&
    (props['textOverflow'] ?? '').replace(/['"]/g, '') === 'ellipsis' &&
    (props['whiteSpace'] ?? '').replace(/['"]/g, '') === 'nowrap'
  )
}
function suggestTextEllipsisCall(_props: Record<string, string>): string {
  return '...Kb.Styles.textEllipsis'
}

function isPaddingHGap(props: Record<string, string>): boolean {
  return (
    'paddingLeft' in props &&
    'paddingRight' in props &&
    !('paddingTop' in props) &&
    !('paddingBottom' in props) &&
    props['paddingLeft'] === props['paddingRight']
  )
}
function suggestPaddingHCall(props: Record<string, string>): string {
  return `...Kb.Styles.paddingH(${props['paddingLeft']})`
}

function isPaddingVGap(props: Record<string, string>): boolean {
  return (
    'paddingTop' in props &&
    'paddingBottom' in props &&
    !('paddingLeft' in props) &&
    !('paddingRight' in props) &&
    props['paddingTop'] === props['paddingBottom']
  )
}
function suggestPaddingVCall(props: Record<string, string>): string {
  return `...Kb.Styles.paddingV(${props['paddingTop']})`
}

function isMarginHGap(props: Record<string, string>): boolean {
  const v = props['marginLeft']
  return (
    'marginLeft' in props &&
    'marginRight' in props &&
    !('marginTop' in props) &&
    !('marginBottom' in props) &&
    props['marginLeft'] === props['marginRight'] &&
    v !== undefined && !v.includes("'auto'") && v !== "'auto'"
  )
}
function suggestMarginHCall(props: Record<string, string>): string {
  return `...Kb.Styles.marginH(${props['marginLeft']})`
}

function isMarginVGap(props: Record<string, string>): boolean {
  return (
    'marginTop' in props &&
    'marginBottom' in props &&
    !('marginLeft' in props) &&
    !('marginRight' in props) &&
    props['marginTop'] === props['marginBottom']
  )
}
function suggestMarginVCall(props: Record<string, string>): string {
  return `...Kb.Styles.marginV(${props['marginTop']})`
}

function isSizeGap(props: Record<string, string>): boolean {
  const v = props['height']
  return (
    'height' in props &&
    'width' in props &&
    v !== undefined &&
    v !== 'undefined' &&
    props['height'] === props['width']
  )
}
function suggestSizeCall(props: Record<string, string>): string {
  return `...Kb.Styles.size(${props['height']})`
}

// ── Pattern clustering (all props) ───────────────────────────────────────────

const HELPER_COVERED_PROP_SETS = [
  new Set(['borderColor', 'borderStyle', 'borderWidth']),
  new Set(['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']),
  new Set(['borderTopColor', 'borderTopWidth', 'borderStyle', 'minHeight']),
  new Set(['borderBottomLeftRadius', 'borderBottomRightRadius', 'overflow']),
  new Set(['overflow', 'textOverflow', 'whiteSpace']),
  new Set(['paddingLeft', 'paddingRight']),
  new Set(['paddingTop', 'paddingBottom']),
  new Set(['marginLeft', 'marginRight']),
  new Set(['marginTop', 'marginBottom']),
  new Set(['height', 'width']),
]

function isCoveredByHelper(keys: string[]): boolean {
  const keySet = new Set(keys)
  return HELPER_COVERED_PROP_SETS.some(covered => [...covered].every(k => keySet.has(k)))
}

function runAnalyze(inputPath: string, helperFilter: string | null, minCount: number) {
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`)
    console.error('Run extract first: node scripts/analyze-styles.mts extract')
    process.exit(1)
  }
  const data: ExtractOutput = JSON.parse(readFileSync(inputPath, 'utf-8'))
  console.log(`Loaded ${data.entries.length} style entries from ${inputPath} (extracted ${data.extractedAt})\n`)

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

  if (!helperFilter || helperFilter === 'padding') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isPaddingGap(e.props))
      .flatMap(e => {
        const suggestedCall = suggestPaddingCall(e.props)
        return suggestedCall ? [{...e, suggestedCall}] : []
      })
    console.log(`=== padding() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'topDivider') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isTopDividerGap(e.props))
      .map(e => ({...e, suggestedCall: suggestTopDividerCall(e.props)}))
    console.log(`=== topDivider() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'roundedBottom') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isRoundedBottomGap(e.props))
      .map(e => ({...e, suggestedCall: suggestRoundedBottomCall(e.props)}))
    console.log(`=== roundedBottom() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'textEllipsis') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isTextEllipsisGap(e.props))
      .map(e => ({...e, suggestedCall: suggestTextEllipsisCall(e.props)}))
    console.log(`=== textEllipsis gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'paddingH') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isPaddingHGap(e.props))
      .map(e => ({...e, suggestedCall: suggestPaddingHCall(e.props)}))
    console.log(`=== paddingH() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'paddingV') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isPaddingVGap(e.props))
      .map(e => ({...e, suggestedCall: suggestPaddingVCall(e.props)}))
    console.log(`=== paddingV() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'marginH') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isMarginHGap(e.props))
      .map(e => ({...e, suggestedCall: suggestMarginHCall(e.props)}))
    console.log(`=== marginH() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'marginV') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isMarginVGap(e.props))
      .map(e => ({...e, suggestedCall: suggestMarginVCall(e.props)}))
    console.log(`=== marginV() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter || helperFilter === 'size') {
    const gaps: HelperGap[] = data.entries
      .filter(e => isSizeGap(e.props))
      .map(e => ({...e, suggestedCall: suggestSizeCall(e.props)}))
    console.log(`=== size() gap detection: ${gaps.length} sites ===\n`)
    for (const g of gaps) {
      const label = g.name ? ` (${g.name})` : ''
      console.log(`  ${g.file}:${g.line}${label}`)
      console.log(`    → ${g.suggestedCall}`)
    }
    if (gaps.length === 0) console.log('  (none found)\n')
    else console.log()
  }

  if (!helperFilter) {
    type ClusterInfo = {
      count: number
      examples: Array<{file: string; line: number}>
      valueSample: Record<string, string[]>
    }
    const clusters = new Map<string, ClusterInfo>()

    for (const entry of data.entries) {
      const keys = Object.keys(entry.props)
      if (keys.length < 2) continue
      if (isCoveredByHelper(keys)) continue
      const cluster = keys.sort().join('+')
      const existing = clusters.get(cluster) ?? {count: 0, examples: [], valueSample: {}}
      existing.count++
      if (existing.examples.length < 3) existing.examples.push({file: entry.file, line: entry.line})
      for (const [k, v] of Object.entries(entry.props)) {
        existing.valueSample[k] = [...new Set([...(existing.valueSample[k] ?? []), v])].slice(0, 5)
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

// ── Report generation ─────────────────────────────────────────────────────────

const PCAT: Record<string, string> = {
  padding:'s',paddingTop:'s',paddingRight:'s',paddingBottom:'s',paddingLeft:'s',
  margin:'s',marginTop:'s',marginRight:'s',marginBottom:'s',marginLeft:'s',
  borderColor:'b',borderWidth:'b',borderStyle:'b',borderRadius:'b',
  borderTopColor:'b',borderTopWidth:'b',borderTopLeftRadius:'b',borderTopRightRadius:'b',
  borderRightColor:'b',borderRightWidth:'b',
  borderBottomColor:'b',borderBottomWidth:'b',borderBottomLeftRadius:'b',borderBottomRightRadius:'b',
  borderLeftColor:'b',borderLeftWidth:'b',
  flex:'l',flexGrow:'l',flexShrink:'l',flexDirection:'l',flexBasis:'l',flexWrap:'l',
  alignItems:'l',alignSelf:'l',alignContent:'l',justifyContent:'l',justifySelf:'l',
  position:'l',top:'l',right:'l',bottom:'l',left:'l',
  overflow:'l',overflowX:'l',overflowY:'l',zIndex:'l',display:'l',
  width:'z',height:'z',minWidth:'z',maxWidth:'z',minHeight:'z',maxHeight:'z',
  fontSize:'t',fontWeight:'t',fontFamily:'t',fontStyle:'t',
  color:'t',textAlign:'t',lineHeight:'t',letterSpacing:'t',
  textDecorationLine:'t',textOverflow:'t',whiteSpace:'t',
  backgroundColor:'v',opacity:'v',elevation:'v',
  shadowColor:'v',shadowOffset:'v',shadowRadius:'v',shadowOpacity:'v',
}
const CAT_KEYS = ['s','b','l','z','t','v','o'] as const

type ClusterRow = {key: string; count: number; examples: Array<{file: string; line: number; name: string | null}>; vals: Record<string, string[]>}

function buildClusters(propsList: Array<Record<string, string>>, examplesMeta: Array<{file: string; line: number; name: string | null}>): ClusterRow[] {
  const clusterMap = new Map<string, ClusterRow>()
  for (let i = 0; i < propsList.length; i++) {
    const props = propsList[i]!
    const meta = examplesMeta[i]!
    const keys = Object.keys(props).sort()
    if (keys.length < 2) continue
    const key = keys.join('+')
    const cr: ClusterRow = clusterMap.get(key) ?? {key, count: 0, examples: [], vals: {}}
    cr.count++
    if (cr.examples.length < 5) cr.examples.push(meta)
    for (const [k, v] of Object.entries(props)) {
      cr.vals[k] = [...new Set([...(cr.vals[k] ?? []), v])].slice(0, 4)
    }
    clusterMap.set(key, cr)
  }
  return [...clusterMap.values()].filter(c => c.count >= 3).sort((a, b) => b.count - a.count)
}

function buildTopProps(propsList: Array<Record<string, string>>): Array<[string, number]> {
  const freqMap = new Map<string, number>()
  for (const props of propsList) for (const k of Object.keys(props)) freqMap.set(k, (freqMap.get(k) ?? 0) + 1)
  return [...freqMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80)
}

function buildCatStats(propsList: Array<Record<string, string>>): Array<{cat: string; count: number}> {
  const catCounts = new Map<string, number>()
  for (const props of propsList)
    for (const k of Object.keys(props))
      catCounts.set(PCAT[k] ?? 'o', (catCounts.get(PCAT[k] ?? 'o') ?? 0) + 1)
  return CAT_KEYS.map(c => ({cat: c, count: catCounts.get(c) ?? 0}))
}

function buildComplexity(propsList: Array<Record<string, string>>): Array<{propCount: number; count: number}> {
  const complexMap = new Map<number, number>()
  for (const props of propsList) {
    const n = Object.keys(props).length
    complexMap.set(n, (complexMap.get(n) ?? 0) + 1)
  }
  return [...complexMap.entries()].sort((a, b) => a[0] - b[0]).map(([propCount, count]) => ({propCount, count}))
}

function buildCoMatrix(propsList: Array<Record<string, string>>): number[][] {
  const coMatrix = CAT_KEYS.map(() => CAT_KEYS.map(() => 0))
  for (const props of propsList) {
    const cats = new Set(Object.keys(props).map(k => PCAT[k] ?? 'o'))
    const present = CAT_KEYS.filter(c => cats.has(c))
    for (const ci of present) for (const cj of present) {
      const ri = CAT_KEYS.indexOf(ci), rj = CAT_KEYS.indexOf(cj)
      const row = coMatrix[ri]
      if (row) row[rj] = (row[rj] ?? 0) + 1
    }
  }
  return coMatrix
}

function runReport(inputPath: string, outputPath: string) {
  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}. Run extract first.`)
    process.exit(1)
  }
  const data: ExtractOutput = JSON.parse(readFileSync(inputPath, 'utf-8'))
  const {entries} = data

  // Gap detection
  type GapRow = {helper: string; file: string; line: number; name: string | null; props: Record<string, string>; call: string}
  const gaps: GapRow[] = []
  for (const entry of entries) {
    if (isBorderGap(entry.props)) {
      const call = suggestBorderCall(entry.props)
      if (call) gaps.push({helper: 'border', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call})
    }
    if (isPaddingGap(entry.props)) {
      const call = suggestPaddingCall(entry.props)
      if (call) gaps.push({helper: 'padding', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call})
    }
    if (isTopDividerGap(entry.props)) {
      gaps.push({helper: 'topDivider', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestTopDividerCall(entry.props)})
    }
    if (isRoundedBottomGap(entry.props)) {
      gaps.push({helper: 'roundedBottom', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestRoundedBottomCall(entry.props)})
    }
    if (isTextEllipsisGap(entry.props)) {
      gaps.push({helper: 'textEllipsis', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestTextEllipsisCall(entry.props)})
    }
    if (isPaddingHGap(entry.props)) {
      gaps.push({helper: 'paddingH', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestPaddingHCall(entry.props)})
    }
    if (isPaddingVGap(entry.props)) {
      gaps.push({helper: 'paddingV', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestPaddingVCall(entry.props)})
    }
    if (isMarginHGap(entry.props)) {
      gaps.push({helper: 'marginH', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestMarginHCall(entry.props)})
    }
    if (isMarginVGap(entry.props)) {
      gaps.push({helper: 'marginV', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestMarginVCall(entry.props)})
    }
    if (isSizeGap(entry.props)) {
      gaps.push({helper: 'size', file: entry.file, line: entry.line, name: entry.name, props: entry.props, call: suggestSizeCall(entry.props)})
    }
  }

  // Helper usage stats
  const helperCountMap = new Map<string, number>()
  for (const entry of entries) {
    for (const call of (entry.helperCalls ?? [])) {
      helperCountMap.set(call.name, (helperCountMap.get(call.name) ?? 0) + 1)
    }
  }
  const helperUsage = [...helperCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({name, count}))
  const totalHelperCalls = helperUsage.reduce((s, x) => s + x.count, 0)
  const entriesWithHelpers = entries.filter(e => (e.helperCalls ?? []).length > 0).length

  // Build raw datasets (from entry.props only)
  const rawPropsList = entries.map(e => e.props)
  const meta = entries.map(e => ({file: e.file, line: e.line, name: e.name}))

  const rawClusters = buildClusters(rawPropsList, meta)
  const rawTopProps = buildTopProps(rawPropsList)
  const rawCatStats = buildCatStats(rawPropsList)
  const rawComplexity = buildComplexity(rawPropsList)
  const rawCoMatrix = buildCoMatrix(rawPropsList)

  // Build computed datasets (raw props + expanded helper calls)
  const computedPropsList = entries.map(e => computedPropsOf(e))

  const computedClusters = buildClusters(computedPropsList, meta)
  const computedTopProps = buildTopProps(computedPropsList)
  const computedCatStats = buildCatStats(computedPropsList)
  const computedComplexity = buildComplexity(computedPropsList)
  const computedCoMatrix = buildCoMatrix(computedPropsList)

  // File-level stats (raw)
  const fileMap2 = new Map<string, {count: number; totalProps: number; maxProps: number; helperCalls: number}>()
  for (const entry of entries) {
    const n = Object.keys(entry.props).length
    const hc = (entry.helperCalls ?? []).length
    const fs = fileMap2.get(entry.file) ?? {count: 0, totalProps: 0, maxProps: 0, helperCalls: 0}
    fs.count++; fs.totalProps += n; fs.maxProps = Math.max(fs.maxProps, n); fs.helperCalls += hc
    fileMap2.set(entry.file, fs)
  }
  const fileStats = [...fileMap2.entries()]
    .map(([file, s]) => ({
      file,
      count: s.count,
      avgProps: Math.round(s.totalProps / s.count * 10) / 10,
      maxProps: s.maxProps,
      helperCalls: s.helperCalls,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 60)

  const html = buildHtml({
    extractedAt: data.extractedAt,
    totalEntries: entries.length,
    totalFiles: new Set(entries.map(e => e.file)).size,
    totalHelperCalls,
    entriesWithHelpers,
    helperUsage,
    gaps,
    rawClusters, rawTopProps, rawCatStats, rawComplexity, rawCoMatrix,
    computedClusters, computedTopProps, computedCatStats, computedComplexity, computedCoMatrix,
    fileStats,
  })
  writeFileSync(outputPath, html, 'utf-8')
  console.error(`Report → ${outputPath}`)
  console.error(`Open:   open ${outputPath}`)
}

type ReportInput = {
  extractedAt: string
  totalEntries: number
  totalFiles: number
  totalHelperCalls: number
  entriesWithHelpers: number
  helperUsage: Array<{name: string; count: number}>
  gaps: Array<{helper: string; file: string; line: number; name: string | null; props: Record<string, string>; call: string}>
  rawClusters: ClusterRow[]
  rawTopProps: Array<[string, number]>
  rawCatStats: Array<{cat: string; count: number}>
  rawComplexity: Array<{propCount: number; count: number}>
  rawCoMatrix: number[][]
  computedClusters: ClusterRow[]
  computedTopProps: Array<[string, number]>
  computedCatStats: Array<{cat: string; count: number}>
  computedComplexity: Array<{propCount: number; count: number}>
  computedCoMatrix: number[][]
  fileStats: Array<{file: string; count: number; avgProps: number; maxProps: number; helperCalls: number}>
}

function buildHtml(d: ReportInput): string {
  const gJ = JSON.stringify(d.gaps)
  const rcJ = JSON.stringify(d.rawClusters)
  const ccJ = JSON.stringify(d.computedClusters)
  const rpJ = JSON.stringify(d.rawTopProps)
  const cpJ = JSON.stringify(d.computedTopProps)
  const pcJ = JSON.stringify(PCAT)
  const rcsJ = JSON.stringify(d.rawCatStats)
  const ccsJ = JSON.stringify(d.computedCatStats)
  const rcxJ = JSON.stringify(d.rawComplexity)
  const ccxJ = JSON.stringify(d.computedComplexity)
  const rcmJ = JSON.stringify(d.rawCoMatrix)
  const ccmJ = JSON.stringify(d.computedCoMatrix)
  const fsJ = JSON.stringify(d.fileStats)
  const huJ = JSON.stringify(d.helperUsage)
  const ts = d.extractedAt.slice(0, 16).replace('T', ' ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Style Report – ${ts}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b}
.hdr{background:#0f172a;color:#f8fafc;padding:12px 20px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:10;flex-wrap:wrap}
.hdr h1{font-size:14px;font-weight:600;margin-right:4px}
.st{background:rgba(255,255,255,.12);padding:2px 9px;border-radius:10px;font-size:11px;color:#94a3b8}
.st b{color:#f8fafc}
.mode-wrap{margin-left:auto;display:flex;align-items:center;gap:6px}
.mode-lbl{font-size:11px;color:#64748b}
.mtb{display:flex;border:1px solid #334155;border-radius:5px;overflow:hidden}
.mt{padding:4px 12px;font-size:11px;font-weight:500;cursor:pointer;background:transparent;color:#94a3b8;border:none;transition:background .15s,color .15s}
.mt:hover{background:#1e293b;color:#cbd5e1}
.mt.on{background:#3b82f6;color:#fff}
.tabs{background:#fff;border-bottom:1px solid #e2e8f0;display:flex;padding:0 20px;position:sticky;top:41px;z-index:9}
.tab{padding:9px 14px;cursor:pointer;border-bottom:2px solid transparent;font-size:12px;color:#64748b;white-space:nowrap}
.tab:hover{color:#1e293b}
.tab.on{color:#0f172a;border-bottom-color:#3b82f6;font-weight:500}
.pane{display:none;padding:16px 20px;max-width:1600px}
.pane.on{display:block}
.tb{display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap}
.tb input[type=text]{padding:5px 10px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;width:260px;outline:none;background:#fff}
.tb input[type=text]:focus{border-color:#3b82f6}
.tb select{padding:5px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;background:#fff}
.tb input[type=number]{padding:5px 6px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;width:54px;background:#fff}
.lbl{font-size:11px;color:#64748b}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06)}
th{padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;white-space:nowrap}
td{padding:7px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:12px}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#fafafa}
code{font-family:'SF Mono',Consolas,monospace;font-size:11px;background:#f1f5f9;padding:1px 5px;border-radius:3px;color:#334155}
.sg{font-family:'SF Mono',Consolas,monospace;font-size:11px;color:#15803d;font-weight:500}
.cp{cursor:pointer;user-select:none;margin-left:4px;color:#94a3b8;font-size:11px}
.cp:hover{color:#3b82f6}
.bdg{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-family:'SF Mono',Consolas,monospace;margin:1px;line-height:1.5}
.hbdg{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-family:'SF Mono',Consolas,monospace;margin:1px;line-height:1.5;background:#fef9c3;color:#854d0e;border:1px solid #fde68a}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:10px}
.card{background:#fff;border-radius:6px;padding:12px 14px;box-shadow:0 1px 2px rgba(0,0,0,.06);border:1px solid #f1f5f9}
.chd{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.cnt{background:#0f172a;color:#f8fafc;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px}
.cv{margin-top:6px;font-size:10px;color:#64748b;font-family:'SF Mono',Consolas,monospace;line-height:1.7}
.ce{margin-top:6px;font-size:10px;color:#94a3b8;line-height:1.7}
.bars{max-width:680px}
.br{display:flex;align-items:center;gap:8px;margin-bottom:3px;height:20px}
.brl{width:220px;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.brt{flex:1;background:#f1f5f9;border-radius:2px;height:12px;overflow:hidden}
.brf{height:100%;border-radius:2px}
.brn{width:40px;font-size:11px;color:#64748b}
.empty{padding:40px;text-align:center;color:#94a3b8}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#f8fafc;padding:6px 16px;border-radius:6px;font-size:12px;pointer-events:none;opacity:0;transition:opacity .2s}
.toast.show{opacity:1}
.dgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.dgrid{grid-template-columns:1fr}}
.dcard{background:#fff;border-radius:6px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.06);border:1px solid #f1f5f9}
.dcard h2{font-size:11px;font-weight:600;color:#64748b;margin-bottom:14px;text-transform:uppercase;letter-spacing:.6px}
.mode-note{font-size:10px;color:#94a3b8;margin-bottom:12px;font-style:italic}
</style>
</head>
<body>
<div class="hdr">
  <h1>Keybase Style Report</h1>
  <span class="st"><b>${d.totalEntries}</b> style objects</span>
  <span class="st"><b>${d.totalFiles}</b> files</span>
  <span class="st"><b>${d.gaps.length}</b> gaps</span>
  <span class="st"><b>${d.totalHelperCalls}</b> helper calls</span>
  <span class="st" style="color:#475569">${ts}</span>
  <div class="mode-wrap">
    <span class="mode-lbl">View:</span>
    <div class="mtb">
      <button class="mt on" onclick="setMode(false)">Raw</button>
      <button class="mt" onclick="setMode(true)">Computed</button>
    </div>
  </div>
</div>
<div class="tabs">
  <div class="tab on" onclick="sw('gaps')">Gaps <span style="opacity:.6">(${d.gaps.length})</span></div>
  <div class="tab" onclick="sw('cands')">Candidates</div>
  <div class="tab" onclick="sw('props')">Properties</div>
  <div class="tab" onclick="sw('dist')">Distribution</div>
</div>

<div id="gaps" class="pane on">
  <p class="mode-note">Gap detection always shows raw styles — where helpers could be applied but aren't.</p>
  <div class="tb">
    <input id="gs" type="text" placeholder="Filter by file or property…" oninput="rG()">
    <select id="gh" onchange="rG()">
      <option value="">All helpers</option>
      <option value="border">border()</option>
      <option value="padding">padding()</option>
      <option value="paddingH">paddingH()</option>
      <option value="paddingV">paddingV()</option>
      <option value="marginH">marginH()</option>
      <option value="marginV">marginV()</option>
      <option value="size">size()</option>
      <option value="roundedBottom">roundedBottom()</option>
      <option value="topDivider">topDivider()</option>
      <option value="textEllipsis">textEllipsis</option>
    </select>
    <span class="lbl" id="gc"></span>
  </div>
  <table><thead><tr><th>File : Line</th><th>Helper</th><th>Name</th><th>Props</th><th>Suggested call</th></tr></thead>
  <tbody id="gb"></tbody></table>
</div>

<div id="cands" class="pane">
  <p class="mode-note" id="cands-note"></p>
  <div class="tb">
    <input id="cs" type="text" placeholder="Filter by property…" oninput="rC()">
    <label class="lbl">Min occurrences: <input id="cm" type="number" value="3" min="2" max="200" oninput="rC()"></label>
    <span class="lbl" id="cc"></span>
  </div>
  <div class="cards" id="cg"></div>
</div>

<div id="props" class="pane">
  <p class="mode-note" id="props-note"></p>
  <div class="tb">
    <input id="ps" type="text" placeholder="Filter properties…" oninput="rP()">
  </div>
  <div class="bars" id="pb"></div>
</div>

<div id="dist" class="pane">
  <p class="mode-note" id="dist-note"></p>
  <div class="dgrid">
    <div class="dcard"><h2>Category Breakdown</h2><div id="donut"></div></div>
    <div class="dcard"><h2>Object Complexity</h2><div id="complex"></div></div>
    <div class="dcard"><h2>Category Co-occurrence</h2><p style="font-size:11px;color:#94a3b8;margin-bottom:10px">How often two categories appear together in the same style object.</p><div id="heat"></div></div>
    <div class="dcard"><h2>Helper Usage</h2><div id="helpers"></div></div>
    <div class="dcard" style="grid-column:1/-1;padding:0;overflow:hidden"><div style="padding:16px 16px 12px"><h2 style="margin:0">Files by Style Count</h2></div><div id="files"></div></div>
  </div>
</div>

<div class="toast" id="toast"></div>
<script>
var G=${gJ};
var CRaw=${rcJ};
var CComp=${ccJ};
var PRaw=${rpJ};
var PComp=${cpJ};
var PC=${pcJ};
var CATSRaw=${rcsJ};
var CATSComp=${ccsJ};
var COMPLEXRaw=${rcxJ};
var COMPLEXComp=${ccxJ};
var COMATRaw=${rcmJ};
var COMATComp=${ccmJ};
var FSTATS=${fsJ};
var HUSAGE=${huJ};
var CS={s:{bg:'#dcfce7',fg:'#15803d'},b:{bg:'#dbeafe',fg:'#1d4ed8'},l:{bg:'#ede9fe',fg:'#6d28d9'},z:{bg:'#fef3c7',fg:'#b45309'},t:{bg:'#fce7f3',fg:'#9d174d'},v:{bg:'#ffedd5',fg:'#c2410c'},o:{bg:'#f1f5f9',fg:'#475569'}};
var CLABELS={s:'Spacing',b:'Border',l:'Layout',z:'Size',t:'Typography',v:'Visual',o:'Other'};
var CKEYS=['s','b','l','z','t','v','o'];
var isComp=false;
var C=CRaw,P=PRaw,CATS=CATSRaw,COMPLEX=COMPLEXRaw,COMAT=COMATRaw;
function setMode(computed){
  isComp=computed;
  C=computed?CComp:CRaw;
  P=computed?PComp:PRaw;
  CATS=computed?CATSComp:CATSRaw;
  COMPLEX=computed?COMPLEXComp:COMPLEXRaw;
  COMAT=computed?COMATComp:COMATRaw;
  document.querySelectorAll('.mt').forEach(function(b,i){b.classList.toggle('on',i===(computed?1:0));});
  var rawNote='Raw mode: shows literal CSS props in source only. Helper calls are not expanded.';
  var compNote='Computed mode: helper calls are expanded to their constituent CSS props. Reveals true property usage.';
  var note=computed?compNote:rawNote;
  ['cands-note','props-note','dist-note'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=note;});
  render();
}
function h(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function ct(p){return PC[p]||'o';}
function bd(p){var c=CS[ct(p)];return '<span class="bdg" style="background:'+c.bg+';color:'+c.fg+'">'+h(p)+'</span>';}
function hbd(name){return '<span class="hbdg">'+h(name)+'()</span>';}
function cfg(p){return CS[ct(p)].fg;}
function cpBtn(txt){return '<span class="cp" data-cp="'+h(txt)+'" onclick="doCp(this.dataset.cp)" title="Copy">⧉</span>';}
function doCp(txt){if(navigator.clipboard)navigator.clipboard.writeText(txt);var t=document.getElementById('toast');t.textContent='Copied!';t.classList.add('show');setTimeout(function(){t.classList.remove('show');},1400);}
var TAB='gaps';
function sw(id){TAB=id;document.querySelectorAll('.tab').forEach(function(t,i){t.classList.toggle('on',['gaps','cands','props','dist'][i]===id);});document.querySelectorAll('.pane').forEach(function(p){p.classList.toggle('on',p.id===id);});render();}
function render(){if(TAB==='gaps')rG();else if(TAB==='cands')rC();else if(TAB==='props')rP();else rD();}
function v(id){var el=document.getElementById(id);return el?el.value:'';}

var HCOLORS={border:'#1d4ed8',padding:'#15803d',paddingH:'#0d9488',paddingV:'#0d9488',marginH:'#7c3aed',marginV:'#7c3aed',size:'#b45309',roundedBottom:'#be185d',topDivider:'#475569',textEllipsis:'#475569'};
var HBGS={border:'#dbeafe',padding:'#dcfce7',paddingH:'#ccfbf1',paddingV:'#ccfbf1',marginH:'#ede9fe',marginV:'#ede9fe',size:'#fef3c7',roundedBottom:'#fce7f3',topDivider:'#f1f5f9',textEllipsis:'#f1f5f9'};
function helperBadge(name){
  var fg=HCOLORS[name]||'#475569',bg=HBGS[name]||'#f1f5f9';
  return '<span class="bdg" style="background:'+bg+';color:'+fg+'">'+h(name)+'()</span>';
}

function rG(){
  var q=(v('gs')||'').toLowerCase(),hf=v('gh');
  var rows=G.filter(function(g){return(!hf||g.helper===hf)&&(!q||g.file.toLowerCase().indexOf(q)>=0||Object.keys(g.props).some(function(k){return k.toLowerCase().indexOf(q)>=0;}));});
  var lbl=document.getElementById('gc');if(lbl)lbl.textContent=rows.length+' of '+G.length;
  var tb=document.getElementById('gb');if(!tb)return;
  if(!rows.length){tb.innerHTML='<tr><td colspan="5" class="empty">No matches</td></tr>';return;}
  tb.innerHTML=rows.map(function(g){
    var ks=Object.keys(g.props);
    var pb=ks.slice(0,5).map(bd).join('')+(ks.length>5?'<span style="color:#94a3b8;font-size:10px"> +'+(ks.length-5)+' more</span>':'');
    return '<tr><td><code>'+h(g.file)+':'+g.line+'</code></td><td>'+helperBadge(g.helper)+'</td><td>'+(g.name?'<code>'+h(g.name)+'</code>':'<span style="color:#94a3b8">—</span>')+'</td><td>'+pb+'</td><td><span class="sg">'+h(g.call)+'</span>'+cpBtn(g.call)+'</td></tr>';
  }).join('');
}

function rC(){
  var q=(v('cs')||'').toLowerCase(),mn=parseInt(v('cm'))||3;
  var items=C.filter(function(c){return c.count>=mn&&(!q||c.key.toLowerCase().indexOf(q)>=0);});
  var lbl=document.getElementById('cc');if(lbl)lbl.textContent=items.length+' shown';
  var g=document.getElementById('cg');if(!g)return;
  if(!items.length){g.innerHTML='<div class="empty">No candidates match</div>';return;}
  g.innerHTML=items.map(function(c){
    var props=c.key.split('+');
    var badges=props.map(bd).join('');
    var vals=Object.keys(c.vals).map(function(k){return '<div><span style="color:'+cfg(k)+'">'+h(k)+'</span>: '+c.vals[k].map(h).join(' | ')+'</div>';}).join('');
    var exs=c.examples.map(function(x){return '<div>'+h(x.file)+':'+x.line+(x.name?' <span style="color:#94a3b8">('+h(x.name)+')</span>':'')+'</div>';}).join('');
    var more=c.count-c.examples.length;
    return '<div class="card"><div class="chd"><span class="cnt">'+c.count+'\xd7</span>'+badges+'</div><div class="cv">'+vals+'</div><div class="ce">'+exs+(more>0?'<div>+'+more+' more</div>':'')+'</div></div>';
  }).join('');
}

function rP(){
  var q=(v('ps')||'').toLowerCase();
  var items=P.filter(function(pr){return !q||pr[0].toLowerCase().indexOf(q)>=0;});
  var mx=items.length?items[0][1]:1;
  var b=document.getElementById('pb');if(!b)return;
  b.innerHTML=items.map(function(pr){
    var c=CS[ct(pr[0])];
    return '<div class="br"><div class="brl">'+bd(pr[0])+'</div><div class="brt"><div class="brf" style="width:'+Math.round(pr[1]/mx*100)+'%;background:'+c.fg+'"></div></div><div class="brn">'+pr[1]+'</div></div>';
  }).join('');
}

function rD(){rDonut();rComplex();rHeat();rHelpers();rFiles();}

function rDonut(){
  var el=document.getElementById('donut');if(!el)return;
  var total=CATS.reduce(function(s,x){return s+x.count;},0)||1;
  var cx=90,cy=90,R=72,ri=42,a=0,paths='',legend='';
  CATS.forEach(function(x){
    if(!x.count)return;
    var slice=x.count/total*360;
    var sa=(a-90)*Math.PI/180,ea=(a+slice-90)*Math.PI/180;
    var x1=cx+R*Math.cos(sa),y1=cy+R*Math.sin(sa);
    var x2=cx+R*Math.cos(ea),y2=cy+R*Math.sin(ea);
    var x3=cx+ri*Math.cos(ea),y3=cy+ri*Math.sin(ea);
    var x4=cx+ri*Math.cos(sa),y4=cy+ri*Math.sin(sa);
    var lg=slice>180?1:0;
    paths+='<path d="M '+x1.toFixed(1)+' '+y1.toFixed(1)+' A '+R+' '+R+' 0 '+lg+' 1 '+x2.toFixed(1)+' '+y2.toFixed(1)+' L '+x3.toFixed(1)+' '+y3.toFixed(1)+' A '+ri+' '+ri+' 0 '+lg+' 0 '+x4.toFixed(1)+' '+y4.toFixed(1)+' Z" fill="'+CS[x.cat].fg+'"><title>'+CLABELS[x.cat]+': '+x.count+' ('+Math.round(x.count/total*100)+'%)</title></path>';
    legend+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="width:10px;height:10px;border-radius:2px;background:'+CS[x.cat].fg+';flex-shrink:0"></span><span style="font-size:11px;color:#475569;flex:1">'+CLABELS[x.cat]+'</span><span style="font-size:12px;color:#1e293b;font-weight:600">'+x.count+'</span><span style="font-size:10px;color:#94a3b8;width:34px;text-align:right">'+Math.round(x.count/total*100)+'%</span></div>';
    a+=slice;
  });
  el.innerHTML='<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 180 180" width="180" height="180" style="flex-shrink:0">'+paths+'<text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" fill="#1e293b" font-size="13" font-weight="600">'+total+'</text><text x="'+cx+'" y="'+(cy+17)+'" text-anchor="middle" fill="#94a3b8" font-size="9">prop usages</text></svg><div style="flex:1;min-width:140px">'+legend+'</div></div>';
}

function rComplex(){
  var el=document.getElementById('complex');if(!el)return;
  var mx=COMPLEX.reduce(function(m,x){return Math.max(m,x.count);},0)||1;
  var total=COMPLEX.reduce(function(s,x){return s+x.count;},0)||1;
  el.innerHTML='<div style="max-width:420px">'+COMPLEX.map(function(x){
    var pct=Math.round(x.count/mx*100);
    return '<div class="br"><div class="brl" style="font-size:11px;color:#64748b;width:72px">'+x.propCount+' prop'+(x.propCount===1?'':'s')+'</div><div class="brt"><div class="brf" style="width:'+pct+'%;background:#3b82f6"></div></div><div class="brn" style="font-size:11px">'+x.count+'</div><div style="font-size:10px;color:#94a3b8;width:34px">'+Math.round(x.count/total*100)+'%</div></div>';
  }).join('')+'</div><p style="font-size:11px;color:#94a3b8;margin-top:10px">'+total+' total style objects</p>';
}

function rHeat(){
  var el=document.getElementById('heat');if(!el)return;
  var labs=CKEYS.map(function(c){return CLABELS[c];});
  var mx=0;
  COMAT.forEach(function(row,i){row.forEach(function(val,j){if(i!==j&&val>mx)mx=val;});});
  if(!mx)mx=1;
  function hexRgb(hex){var n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255].join(',');}
  var out='<div style="overflow-x:auto"><table style="border-collapse:separate;border-spacing:3px"><thead><tr><td style="font-size:0;width:80px"></td>';
  CKEYS.forEach(function(c,i){out+='<th style="font-size:9px;font-weight:600;color:'+CS[c].fg+';text-align:center;padding:2px 3px;white-space:nowrap">'+labs[i].slice(0,5)+'</th>';});
  out+='</tr></thead><tbody>';
  COMAT.forEach(function(row,i){
    out+='<tr><td style="font-size:9px;font-weight:600;color:'+CS[CKEYS[i]].fg+';padding:2px 4px;text-align:right;white-space:nowrap">'+labs[i]+'</td>';
    row.forEach(function(val,j){
      var diag=i===j;
      var alpha=diag?0.1:Math.round(val/mx*80)/100;
      var bg=diag?'#f1f5f9':'rgba('+hexRgb(CS[CKEYS[i]].fg)+','+alpha+')';
      var fc=alpha>0.45?'#fff':'#1e293b';
      out+='<td style="width:50px;height:34px;background:'+bg+';border-radius:4px;text-align:center;font-size:10px;color:'+fc+';cursor:default" title="'+labs[i]+' ↔ '+labs[j]+': '+val+'">'+val+'</td>';
    });
    out+='</tr>';
  });
  out+='</tbody></table></div>';
  el.innerHTML=out;
}

function rHelpers(){
  var el=document.getElementById('helpers');if(!el)return;
  if(!HUSAGE.length){el.innerHTML='<div class="empty" style="padding:20px">No helper calls found — run extract on fresh snapshot</div>';return;}
  var mx=HUSAGE[0].count||1;
  el.innerHTML='<div style="max-width:420px">'+HUSAGE.map(function(x){
    var fg=HCOLORS[x.name]||'#475569',bg=HBGS[x.name]||'#f1f5f9';
    var pct=Math.round(x.count/mx*100);
    return '<div class="br"><div class="brl"><span class="bdg" style="background:'+bg+';color:'+fg+'">'+h(x.name)+'()</span></div><div class="brt"><div class="brf" style="width:'+pct+'%;background:'+fg+'"></div></div><div class="brn">'+x.count+'</div></div>';
  }).join('')+'</div>';
}

function rFiles(){
  var el=document.getElementById('files');if(!el)return;
  el.innerHTML='<table><thead><tr><th>File</th><th style="text-align:right">Objects</th><th style="text-align:right">Avg props</th><th style="text-align:right">Max props</th><th style="text-align:right">Helper calls</th></tr></thead><tbody>'+FSTATS.map(function(f){
    var hc=f.helperCalls>0?'<b style="color:#854d0e">'+f.helperCalls+'</b>':'<span style="color:#94a3b8">0</span>';
    return '<tr><td><code>'+h(f.file)+'</code></td><td style="text-align:right">'+f.count+'</td><td style="text-align:right">'+f.avgProps+'</td><td style="text-align:right">'+f.maxProps+'</td><td style="text-align:right">'+hc+'</td></tr>';
  }).join('')+'</tbody></table>';
}

setMode(false);
rG();document.getElementById('gc').textContent=G.length+' total';
</script>
</body>
</html>`
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
} else if (cmd === 'report') {
  const input = (flags['input'] as string | undefined) ?? '/tmp/keybase-styles.json'
  const output = (flags['output'] as string | undefined) ?? '/tmp/keybase-styles.html'
  runReport(input, output)
} else {
  console.error('Usage: node scripts/analyze-styles.mts extract [--output /tmp/keybase-styles.json]')
  console.error('       node scripts/analyze-styles.mts analyze [--input /tmp/keybase-styles.json] [--helper border|padding|...] [--min-count 3]')
  console.error('       node scripts/analyze-styles.mts report  [--input /tmp/keybase-styles.json] [--output /tmp/keybase-styles.html]')
  process.exit(1)
}
