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

// padding(top, right?, bottom?, left?) matches CSS shorthand logic:
//   1 arg:  all sides equal
//   2 args: top/bottom = first, left/right = second
//   3 args: top, left/right, bottom
//   4 args: top, right, bottom, left
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

  // 1 arg: all equal
  if (t === r && t === b && t === l) return `...Kb.Styles.padding(${t})`
  // 2 args: top===bottom, right===left
  if (t === b && r === l) return `...Kb.Styles.padding(${t}, ${r})`
  // 3 args: right===left
  if (r === l) return `...Kb.Styles.padding(${t}, ${r}, ${b})`
  // 4 args
  return `...Kb.Styles.padding(${t}, ${r}, ${b}, ${l})`
}

// topDivider() — borderStyle:'solid', borderTopColor:black_10, borderTopWidth:1, minHeight:56
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

// roundedBottom() — borderBottomLeftRadius:borderRadius, borderBottomRightRadius:borderRadius, overflow:'hidden'
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

// textEllipsis — overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
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

// paddingH(n) — paddingLeft === paddingRight, no paddingTop/Bottom
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

// paddingV(n) — paddingTop === paddingBottom, no paddingLeft/Right
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

// marginH(n) — marginLeft === marginRight, no marginTop/Bottom
function isMarginHGap(props: Record<string, string>): boolean {
  return (
    'marginLeft' in props &&
    'marginRight' in props &&
    !('marginTop' in props) &&
    !('marginBottom' in props) &&
    props['marginLeft'] === props['marginRight']
  )
}
function suggestMarginHCall(props: Record<string, string>): string {
  return `...Kb.Styles.marginH(${props['marginLeft']})`
}

// marginV(n) — marginTop === marginBottom, no marginLeft/Right
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

// size(n) — height === width
function isSizeGap(props: Record<string, string>): boolean {
  return (
    'height' in props &&
    'width' in props &&
    props['height'] === props['width']
  )
}
function suggestSizeCall(props: Record<string, string>): string {
  return `...Kb.Styles.size(${props['height']})`
}

// ── Pattern clustering (all props) ───────────────────────────────────────────

// Props already covered by existing helpers — suppress from candidate output
// since gap detection handles them.
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

function allPropsCluster(props: Record<string, string>): string {
  return Object.keys(props).sort().join('+')
}

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

  // ── Gap detection: padding() ─────────────────────────────────────────────
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

  // ── Gap detection: topDivider() ─────────────────────────────────────────
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

  // ── Gap detection: roundedBottom() ──────────────────────────────────────
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

  // ── Gap detection: textEllipsis ──────────────────────────────────────────
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

  // ── Gap detection: paddingH() ────────────────────────────────────────────
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

  // ── Gap detection: paddingV() ────────────────────────────────────────────
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

  // ── Gap detection: marginH() ─────────────────────────────────────────────
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

  // ── Gap detection: marginV() ─────────────────────────────────────────────
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

  // ── Gap detection: size() ────────────────────────────────────────────────
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

  // ── Pattern detection: new helper candidates (all props) ─────────────────
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
      const cluster = allPropsCluster(entry.props)
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

  // Exact-key clustering across all style props
  type CRow = {key: string; count: number; examples: Array<{file: string; line: number; name: string | null}>; vals: Record<string, string[]>}
  const clusterMap = new Map<string, CRow>()
  for (const entry of entries) {
    const keys = Object.keys(entry.props).sort()
    if (keys.length < 2) continue
    const key = keys.join('+')
    const cr: CRow = clusterMap.get(key) ?? {key, count: 0, examples: [], vals: {}}
    cr.count++
    if (cr.examples.length < 5) cr.examples.push({file: entry.file, line: entry.line, name: entry.name})
    for (const [k, v] of Object.entries(entry.props)) {
      cr.vals[k] = [...new Set([...(cr.vals[k] ?? []), v])].slice(0, 4)
    }
    clusterMap.set(key, cr)
  }
  const clusters = [...clusterMap.values()]
    .filter(c => c.count >= 3)
    .sort((a, b) => b.count - a.count)

  // Property frequency
  const freqMap = new Map<string, number>()
  for (const entry of entries) for (const k of Object.keys(entry.props)) freqMap.set(k, (freqMap.get(k) ?? 0) + 1)
  const topProps = [...freqMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80)

  // Category usage counts
  const catCounts = new Map<string, number>()
  for (const entry of entries)
    for (const k of Object.keys(entry.props))
      catCounts.set(PCAT[k] ?? 'o', (catCounts.get(PCAT[k] ?? 'o') ?? 0) + 1)
  const catStats = CAT_KEYS.map(c => ({cat: c, count: catCounts.get(c) ?? 0}))

  // Object complexity histogram (how many style objects have N props)
  const complexMap = new Map<number, number>()
  for (const entry of entries) {
    const n = Object.keys(entry.props).length
    complexMap.set(n, (complexMap.get(n) ?? 0) + 1)
  }
  const complexity = [...complexMap.entries()].sort((a, b) => a[0] - b[0]).map(([propCount, count]) => ({propCount, count}))

  // Category co-occurrence matrix
  const coMatrix = CAT_KEYS.map(() => CAT_KEYS.map(() => 0))
  for (const entry of entries) {
    const cats = new Set(Object.keys(entry.props).map(k => PCAT[k] ?? 'o'))
    const present = CAT_KEYS.filter(c => cats.has(c))
    for (const ci of present) for (const cj of present) {
      const ri = CAT_KEYS.indexOf(ci), rj = CAT_KEYS.indexOf(cj)
      const row = coMatrix[ri]
      if (row) row[rj] = (row[rj] ?? 0) + 1
    }
  }

  // File-level stats
  const fileMap2 = new Map<string, {count: number; totalProps: number; maxProps: number}>()
  for (const entry of entries) {
    const n = Object.keys(entry.props).length
    const fs = fileMap2.get(entry.file) ?? {count: 0, totalProps: 0, maxProps: 0}
    fs.count++; fs.totalProps += n; fs.maxProps = Math.max(fs.maxProps, n)
    fileMap2.set(entry.file, fs)
  }
  const fileStats = [...fileMap2.entries()]
    .map(([file, s]) => ({file, count: s.count, avgProps: Math.round(s.totalProps / s.count * 10) / 10, maxProps: s.maxProps}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 60)

  const html = buildHtml({
    extractedAt: data.extractedAt,
    totalEntries: entries.length,
    totalFiles: new Set(entries.map(e => e.file)).size,
    gaps, clusters, topProps, catStats, complexity, coMatrix, fileStats,
  })
  writeFileSync(outputPath, html, 'utf-8')
  console.error(`Report → ${outputPath}`)
  console.error(`Open:   open ${outputPath}`)
}

type ReportInput = {
  extractedAt: string
  totalEntries: number
  totalFiles: number
  gaps: Array<{helper: string; file: string; line: number; name: string | null; props: Record<string, string>; call: string}>
  clusters: Array<{key: string; count: number; examples: Array<{file: string; line: number; name: string | null}>; vals: Record<string, string[]>}>
  topProps: Array<[string, number]>
  catStats: Array<{cat: string; count: number}>
  complexity: Array<{propCount: number; count: number}>
  coMatrix: number[][]
  fileStats: Array<{file: string; count: number; avgProps: number; maxProps: number}>
}

function buildHtml(d: ReportInput): string {
  const gJ = JSON.stringify(d.gaps)
  const cJ = JSON.stringify(d.clusters)
  const pJ = JSON.stringify(d.topProps)
  const pcJ = JSON.stringify(PCAT)
  const csJ = JSON.stringify(d.catStats)
  const cxJ = JSON.stringify(d.complexity)
  const cmJ = JSON.stringify(d.coMatrix)
  const fsJ = JSON.stringify(d.fileStats)
  const ts = d.extractedAt.slice(0, 16).replace('T', ' ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Style Report – ${ts}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b}
.hdr{background:#0f172a;color:#f8fafc;padding:12px 20px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:10}
.hdr h1{font-size:14px;font-weight:600;margin-right:4px}
.st{background:rgba(255,255,255,.12);padding:2px 9px;border-radius:10px;font-size:11px;color:#94a3b8}
.st b{color:#f8fafc}
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
</style>
</head>
<body>
<div class="hdr">
  <h1>Keybase Style Report</h1>
  <span class="st"><b>${d.totalEntries}</b> style objects</span>
  <span class="st"><b>${d.totalFiles}</b> files</span>
  <span class="st"><b>${d.gaps.length}</b> gaps</span>
  <span class="st"><b>${d.clusters.length}</b> candidates</span>
  <span class="st" style="color:#475569">${ts}</span>
</div>
<div class="tabs">
  <div class="tab on" onclick="sw('gaps')">Gaps <span style="opacity:.6">(${d.gaps.length})</span></div>
  <div class="tab" onclick="sw('cands')">Candidates <span style="opacity:.6">(${d.clusters.length})</span></div>
  <div class="tab" onclick="sw('props')">Properties</div>
  <div class="tab" onclick="sw('dist')">Distribution</div>
</div>
<div id="gaps" class="pane on">
  <div class="tb">
    <input id="gs" type="text" placeholder="Filter by file or property…" oninput="rG()">
    <select id="gh" onchange="rG()">
      <option value="">All helpers</option>
      <option value="border">border()</option>
      <option value="padding">padding()</option>
    </select>
    <span class="lbl" id="gc"></span>
  </div>
  <table><thead><tr><th>File : Line</th><th>Helper</th><th>Name</th><th>Props</th><th>Suggested call</th></tr></thead>
  <tbody id="gb"></tbody></table>
</div>
<div id="cands" class="pane">
  <div class="tb">
    <input id="cs" type="text" placeholder="Filter by property…" oninput="rC()">
    <label class="lbl">Min occurrences: <input id="cm" type="number" value="3" min="2" max="200" oninput="rC()"></label>
    <span class="lbl" id="cc"></span>
  </div>
  <div class="cards" id="cg"></div>
</div>
<div id="props" class="pane">
  <div class="tb">
    <input id="ps" type="text" placeholder="Filter properties…" oninput="rP()">
  </div>
  <div class="bars" id="pb"></div>
</div>
<div id="dist" class="pane">
  <div class="dgrid">
    <div class="dcard"><h2>Category Breakdown</h2><div id="donut"></div></div>
    <div class="dcard"><h2>Object Complexity</h2><div id="complex"></div></div>
    <div class="dcard"><h2>Category Co-occurrence</h2><p style="font-size:11px;color:#94a3b8;margin-bottom:10px">How often two categories appear together in the same style object. Hover a cell for details.</p><div id="heat"></div></div>
    <div class="dcard" style="padding:0;overflow:hidden"><div style="padding:16px 16px 12px"><h2 style="margin:0">Files by Style Count</h2></div><div id="files"></div></div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
var G=${gJ};
var C=${cJ};
var P=${pJ};
var PC=${pcJ};
var CATS=${csJ};
var COMPLEX=${cxJ};
var COMAT=${cmJ};
var FSTATS=${fsJ};
var CS={s:{bg:'#dcfce7',fg:'#15803d'},b:{bg:'#dbeafe',fg:'#1d4ed8'},l:{bg:'#ede9fe',fg:'#6d28d9'},z:{bg:'#fef3c7',fg:'#b45309'},t:{bg:'#fce7f3',fg:'#9d174d'},v:{bg:'#ffedd5',fg:'#c2410c'},o:{bg:'#f1f5f9',fg:'#475569'}};
var CLABELS={s:'Spacing',b:'Border',l:'Layout',z:'Size',t:'Typography',v:'Visual',o:'Other'};
var CKEYS=['s','b','l','z','t','v','o'];
function h(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function ct(p){return PC[p]||'o';}
function bd(p){var c=CS[ct(p)];return '<span class="bdg" style="background:'+c.bg+';color:'+c.fg+'">'+h(p)+'</span>';}
function cfg(p){return CS[ct(p)].fg;}
function cpBtn(txt){return '<span class="cp" data-cp="'+h(txt)+'" onclick="doCp(this.dataset.cp)" title="Copy">⧉</span>';}
function doCp(txt){if(navigator.clipboard)navigator.clipboard.writeText(txt);var t=document.getElementById('toast');t.textContent='Copied!';t.classList.add('show');setTimeout(function(){t.classList.remove('show');},1400);}
var TAB='gaps';
function sw(id){TAB=id;document.querySelectorAll('.tab').forEach(function(t,i){t.classList.toggle('on',['gaps','cands','props','dist'][i]===id);});document.querySelectorAll('.pane').forEach(function(p){p.classList.toggle('on',p.id===id);});render();}
function render(){if(TAB==='gaps')rG();else if(TAB==='cands')rC();else if(TAB==='props')rP();else rD();}
function v(id){var el=document.getElementById(id);return el?el.value:'';}
function rG(){
  var q=(v('gs')||'').toLowerCase(),hf=v('gh');
  var rows=G.filter(function(g){return(!hf||g.helper===hf)&&(!q||g.file.toLowerCase().indexOf(q)>=0||Object.keys(g.props).some(function(k){return k.toLowerCase().indexOf(q)>=0;}));});
  var lbl=document.getElementById('gc');if(lbl)lbl.textContent=rows.length+' of '+G.length;
  var tb=document.getElementById('gb');if(!tb)return;
  if(!rows.length){tb.innerHTML='<tr><td colspan="5" class="empty">No matches</td></tr>';return;}
  tb.innerHTML=rows.map(function(g){
    var ks=Object.keys(g.props);
    var pb=ks.slice(0,5).map(bd).join('')+(ks.length>5?'<span style="color:#94a3b8;font-size:10px"> +'+(ks.length-5)+' more</span>':'');
    var hb=g.helper==='border'?'<span class="bdg" style="background:#dbeafe;color:#1d4ed8">border()</span>':'<span class="bdg" style="background:#dcfce7;color:#15803d">padding()</span>';
    return '<tr><td><code>'+h(g.file)+':'+g.line+'</code></td><td>'+hb+'</td><td>'+(g.name?'<code>'+h(g.name)+'</code>':'<span style="color:#94a3b8">—</span>')+'</td><td>'+pb+'</td><td><span class="sg">'+h(g.call)+'</span>'+cpBtn(g.call)+'</td></tr>';
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
function rD(){rDonut();rComplex();rHeat();rFiles();}
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
function rFiles(){
  var el=document.getElementById('files');if(!el)return;
  el.innerHTML='<table><thead><tr><th>File</th><th style="text-align:right">Objects</th><th style="text-align:right">Avg props</th><th style="text-align:right">Max props</th></tr></thead><tbody>'+FSTATS.map(function(f){
    return '<tr><td><code>'+h(f.file)+'</code></td><td style="text-align:right">'+f.count+'</td><td style="text-align:right">'+f.avgProps+'</td><td style="text-align:right">'+f.maxProps+'</td></tr>';
  }).join('')+'</tbody></table>';
}
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
  console.error('       node scripts/analyze-styles.mts analyze [--input /tmp/keybase-styles.json] [--helper border|padding] [--min-count 3]')
  console.error('       node scripts/analyze-styles.mts report  [--input /tmp/keybase-styles.json] [--output /tmp/keybase-styles.html]')
  process.exit(1)
}
