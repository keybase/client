// Box2 and ClickableBox center themselves (alignSelf: 'center') when neither fullWidth nor fullHeight
// is set. Before that default is removed, `pin` mode writes the centering out at every call site
// that relied on it, so removing the default changes no pixels.
//
//   node scripts/codemods/box2-stretch-default.mts pin [--write] [--report <file>]
//
// Without --write it only reports. Sites with a spread prop are never edited (the spread may carry
// fullWidth, fullHeight or alignSelf); they are listed for pinning by hand. Sites the codemod cannot
// classify are listed as unresolved with a reason.
//
//   node scripts/codemods/box2-stretch-default.mts cleanup --coverage-from <base sha> [--write] [--report <file>]
//
// Once the default is gone, `cleanup` removes props that only restate the stretch (rules below),
// at call sites the visual gate's coverage base for <base sha> mounted.
import * as babel from '@babel/core'
import {parse, parseExpression} from '@babel/parser'
import MagicString from 'magic-string'
import {execFileSync} from 'child_process'
import {readFileSync, readdirSync, writeFileSync} from 'fs'
import {dirname, join, relative, resolve} from 'path'
import {fileURLToPath} from 'url'
import {
  callSiteRanges,
  parseDiffHunks,
  unmarkedFile,
  unmountedChanged,
  type Hunk,
} from '../../tests/e2e/visual/coverage/changed-sites.mts'
import {readBaseCoverage} from '../../tests/e2e/visual/store.mts'

type Site = {line: number}
type Unresolved = {line: number; reason: string}
export type PinResult = {code: string; pinned: Array<Site>; spreads: Array<Site>; unresolved: Array<Unresolved>}

const t = babel.types
const targetNames = new Set(['Box2', 'ClickableBox'])
const aliasSources = new Set(['@/common-adapters', '@/common-adapters/index', '@/common-adapters/box'])
const resolvedSuffixes = ['/common-adapters', '/common-adapters/index', '/common-adapters/box']

const isCommonAdaptersSource = (source: string, filename: string) => {
  if (aliasSources.has(source)) return true
  if (!source.startsWith('.')) return false
  const abs = resolve(dirname(filename), source)
  return resolvedSuffixes.some(s => abs.endsWith(s))
}

type Classified = {kind: 'target'} | {kind: 'none'} | {kind: 'unresolved'; reason: string}

const importOf = (binding: babel.NodePath | undefined) => {
  if (!binding) return undefined
  const decl = binding.parentPath
  if (!decl?.isImportDeclaration()) return undefined
  return {decl: decl.node, spec: binding.node}
}

// Whether a variable initializer is (or wraps, e.g. createAnimatedComponent(Kb.Box2)) the component
// itself. Function bodies that merely render one are not aliases.
const refersToTarget = (e: babel.types.Node | null | undefined): boolean => {
  if (!e) return false
  if (t.isIdentifier(e)) return targetNames.has(e.name)
  if (t.isMemberExpression(e)) return t.isIdentifier(e.property) && targetNames.has(e.property.name)
  if (t.isConditionalExpression(e)) return refersToTarget(e.consequent) || refersToTarget(e.alternate)
  if (t.isLogicalExpression(e)) return refersToTarget(e.left) || refersToTarget(e.right)
  if (t.isCallExpression(e)) return e.arguments.some(a => refersToTarget(a))
  if (t.isTSAsExpression(e) || t.isTSNonNullExpression(e) || t.isTSSatisfiesExpression(e)) {
    return refersToTarget(e.expression)
  }
  return false
}

const classifyName = (path: babel.NodePath<babel.types.JSXOpeningElement>, filename: string): Classified => {
  const name = path.node.name
  if (t.isJSXIdentifier(name)) {
    const binding = path.scope.getBinding(name.name)
    if (!binding) return {kind: 'none'}
    const imp = importOf(binding.path)
    if (imp) {
      if (!isCommonAdaptersSource(imp.decl.source.value, filename)) return {kind: 'none'}
      if (t.isImportSpecifier(imp.spec)) {
        const imported = t.isIdentifier(imp.spec.imported) ? imp.spec.imported.name : imp.spec.imported.value
        return targetNames.has(imported) ? {kind: 'target'} : {kind: 'none'}
      }
      if (t.isImportDefaultSpecifier(imp.spec)) {
        return {kind: 'unresolved', reason: `default import "${name.name}" from ${imp.decl.source.value}`}
      }
      return {kind: 'none'}
    }
    if (binding.path.isVariableDeclarator() && refersToTarget(binding.path.node.init)) {
      return {kind: 'unresolved', reason: `"${name.name}" is a local alias of Box2/ClickableBox`}
    }
    return {kind: 'none'}
  }
  if (t.isJSXMemberExpression(name)) {
    if (!targetNames.has(name.property.name)) return {kind: 'none'}
    if (!t.isJSXIdentifier(name.object)) {
      return {kind: 'unresolved', reason: 'member expression deeper than one level'}
    }
    const obj = name.object.name
    if (obj === 'Kb') return {kind: 'target'}
    const objBinding = path.scope.getBinding(obj)?.path
    const imp = importOf(objBinding)
    if (imp && isCommonAdaptersSource(imp.decl.source.value, filename)) {
      if (t.isImportNamespaceSpecifier(imp.spec)) return {kind: 'target'}
      return {kind: 'unresolved', reason: `"${obj}" is a non-namespace import from ${imp.decl.source.value}`}
    }
    if (objBinding?.isVariableDeclarator()) {
      return {kind: 'unresolved', reason: `"${obj}" is a local object other than Kb`}
    }
    return {kind: 'none'}
  }
  return {kind: 'none'}
}

type AxisValue = {kind: 'absent'} | {kind: 'true'} | {kind: 'expr'; text: string} | {kind: 'unresolved'; reason: string}

// Identifiers and member expressions bind tighter than || and ?:, so they need no parens.
const operand = (text: string) => {
  const e = parseExpression(text, {plugins: ['jsx', 'typescript']})
  return t.isIdentifier(e) || t.isMemberExpression(e) || t.isOptionalMemberExpression(e) ? text : `(${text})`
}

const readAxis = (attr: babel.types.JSXAttribute | undefined, code: string): AxisValue => {
  if (!attr) return {kind: 'absent'}
  const v = attr.value
  if (v === null || v === undefined) return {kind: 'true'}
  if (t.isStringLiteral(v)) {
    return v.value === '' ? {kind: 'unresolved', reason: 'empty string value is falsy'} : {kind: 'true'}
  }
  if (t.isJSXExpressionContainer(v)) {
    const e = v.expression
    if (t.isJSXEmptyExpression(e)) return {kind: 'unresolved', reason: 'empty expression'}
    if (t.isBooleanLiteral(e)) return e.value ? {kind: 'true'} : {kind: 'absent'}
    if (t.isNullLiteral(e) || (t.isIdentifier(e) && e.name === 'undefined')) return {kind: 'absent'}
    return {kind: 'expr', text: code.slice(e.start ?? 0, e.end ?? 0)}
  }
  return {kind: 'unresolved', reason: `unsupported ${attr.name.type === 'JSXIdentifier' ? attr.name.name : ''} value`}
}

// The old default applied whenever alignSelf was unset at runtime, so alignSelf only replaces the
// default when every value it can take is a non-empty string.
const alwaysNonEmptyString = (e: babel.types.Node): boolean => {
  if (t.isStringLiteral(e)) return e.value !== ''
  if (t.isConditionalExpression(e)) return alwaysNonEmptyString(e.consequent) && alwaysNonEmptyString(e.alternate)
  if (t.isLogicalExpression(e)) return alwaysNonEmptyString(e.left) && alwaysNonEmptyString(e.right)
  if (t.isTSAsExpression(e) || t.isTSSatisfiesExpression(e) || t.isParenthesizedExpression(e)) {
    return alwaysNonEmptyString(e.expression)
  }
  return false
}

const alignSelfCovers = (attr: babel.types.JSXAttribute) => {
  const v = attr.value
  if (t.isStringLiteral(v)) return v.value !== ''
  return t.isJSXExpressionContainer(v) && alwaysNonEmptyString(v.expression)
}

const findAttr = (node: babel.types.JSXOpeningElement, name: string) => {
  let found: babel.types.JSXAttribute | undefined
  for (const a of node.attributes) {
    if (t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name) found = a
  }
  return found
}

export const pinSource = (code: string, filename: string): PinResult => {
  const pinned: Array<Site> = []
  const spreads: Array<Site> = []
  const unresolved: Array<Unresolved> = []
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {plugins: ['jsx', 'typescript'], sourceFilename: filename, sourceType: 'module'})
  } catch (e) {
    return {code, pinned, spreads, unresolved: [{line: 0, reason: `parse error: ${String(e)}`}]}
  }
  const ms = new MagicString(code)
  babel.traverse(ast as babel.types.File, {
    JSXOpeningElement(path) {
      const node = path.node
      const line = node.loc?.start.line ?? 0
      const c = classifyName(path, filename)
      if (c.kind === 'none') return
      if (c.kind === 'unresolved') {
        unresolved.push({line, reason: c.reason})
        return
      }
      if (node.attributes.some(a => t.isJSXSpreadAttribute(a))) {
        spreads.push({line})
        return
      }
      const alignSelf = findAttr(node, 'alignSelf')
      if (alignSelf && alignSelfCovers(alignSelf)) return
      const axes = [readAxis(findAttr(node, 'fullWidth'), code), readAxis(findAttr(node, 'fullHeight'), code)]
      if (axes.some(a => a.kind === 'true')) return
      if (alignSelf) {
        unresolved.push({line, reason: 'alignSelf expression may be undefined'})
        return
      }
      const bad = axes.find(a => a.kind === 'unresolved')
      if (bad?.kind === 'unresolved') {
        unresolved.push({line, reason: bad.reason})
        return
      }
      const exprs = [...new Set(axes.flatMap(a => (a.kind === 'expr' ? [a.text] : [])))]
      const pin = exprs.length
        ? ` alignSelf={${exprs.map(operand).join(' || ')} ? undefined : 'center'}`
        : ' alignSelf="center"'
      const typeArgs = (node as {typeArguments?: babel.types.Node | null}).typeArguments ?? node.typeParameters
      ms.appendLeft((typeArgs ?? node.name).end ?? 0, pin)
      pinned.push({line})
    },
  })
  return {code: ms.toString(), pinned, spreads, unresolved}
}

// ---------------------------------------------------------------- cleanup
//
// With the default gone, a child of a Box2/ClickableBox stretches across its parent's cross axis
// unless it sets alignSelf, so some props only restate that:
//   C1  fullWidth on a child of a vertical parent whose alignItems is absent or stretch
//   C2  fullHeight on a child of a horizontal parent, same alignItems condition
//   C3  a literal alignSelf on a fullWidth child of a vertical parent: a 100%-wide child has no
//       horizontal position to choose
// The parent is the nearest enclosing JSX element, holding the child among its children. A child
// with a style, a className or a spread is never touched, nor a child of a parent with a className,
// a spread or a style that may set its alignment or direction: those can set width, margins,
// alignment or direction that the rules cannot see. C1 needs a child without alignSelf (it would
// place the child once fullWidth is gone), so a fullWidth child with a literal alignSelf gets only
// C3: one prop per site per pass.

export type CleanupRule = 'C1' | 'C2' | 'C3'
export type CleanupCandidate = {
  line: number
  rule: CleanupRule
  attr: 'fullWidth' | 'fullHeight' | 'alignSelf'
  start: number
  end: number
}

const alignSelfLiterals = new Set(['stretch', 'center', 'flex-start', 'flex-end'])

const stringValue = (attr: babel.types.JSXAttribute | undefined) => {
  const v = attr?.value
  if (t.isStringLiteral(v)) return v.value
  if (t.isJSXExpressionContainer(v) && t.isStringLiteral(v.expression)) return v.expression.value
  return undefined
}

const isTrue = (attr: babel.types.JSXAttribute | undefined) => {
  if (!attr) return false
  const v = attr.value
  return v === null || v === undefined || (t.isJSXExpressionContainer(v) && t.isBooleanLiteral(v.expression, {value: true}))
}

const opaque = (node: babel.types.JSXOpeningElement) =>
  node.attributes.some(a => t.isJSXSpreadAttribute(a)) || !!findAttr(node, 'style') || !!findAttr(node, 'className')

// A parent style may stand when it provably leaves the parent's cross-axis layout alone: it
// resolves, in this file, to object literals without these keys (any platform branch included).
const crossAxisKeys = new Set(['alignItems', 'display', 'flexDirection', 'flexWrap'])
const platformKeys = new Set(['common', 'isAndroid', 'isElectron', 'isIOS', 'isMobile', 'isPhone', 'isTablet'])

const calleeName = (e: babel.types.Node) =>
  t.isMemberExpression(e) && t.isIdentifier(e.property) ? e.property.name : t.isIdentifier(e) ? e.name : ''

const styleSheetEntry = (
  scope: babel.NodePath['scope'],
  e: babel.types.MemberExpression
): babel.types.Node | undefined => {
  if (!t.isIdentifier(e.object) || e.computed || !t.isIdentifier(e.property)) return undefined
  const init = (name: string) => {
    const decl = scope.getBinding(name)?.path.node
    return t.isVariableDeclarator(decl) && t.isCallExpression(decl.init) ? decl.init : undefined
  }
  // `styles = Kb.Styles.styleSheetCreate(fn)`, or `styles = useStyles()` with
  // `useStyles = Kb.Styles.createStyleHook(fn)`
  let sheet = init(e.object.name)
  if (sheet && t.isIdentifier(sheet.callee) && !sheet.arguments.length) {
    const hook = init(sheet.callee.name)
    sheet = hook && calleeName(hook.callee) === 'createStyleHook' ? hook : undefined
  } else if (sheet && calleeName(sheet.callee) !== 'styleSheetCreate') {
    sheet = undefined
  }
  const fn = sheet?.arguments[0]
  if (!t.isArrowFunctionExpression(fn)) return undefined
  const body = t.isTSAsExpression(fn.body) ? fn.body.expression : fn.body
  if (!t.isObjectExpression(body)) return undefined
  const name = e.property.name
  for (const p of body.properties) {
    if (t.isObjectProperty(p) && !p.computed && t.isIdentifier(p.key, {name})) return p.value
  }
  return undefined
}

const styleKeepsCrossAxis = (scope: babel.NodePath['scope'], e: babel.types.Node | null | undefined, depth = 0): boolean => {
  if (!e || depth > 8) return false
  const recur = (x: babel.types.Node | null | undefined) => styleKeepsCrossAxis(scope, x, depth + 1)
  if (t.isNullLiteral(e) || t.isBooleanLiteral(e, {value: false}) || t.isIdentifier(e, {name: 'undefined'})) return true
  if (t.isTSAsExpression(e) || t.isTSSatisfiesExpression(e) || t.isParenthesizedExpression(e)) return recur(e.expression)
  if (t.isConditionalExpression(e)) return recur(e.consequent) && recur(e.alternate)
  // `a && style`: a falsy `a` adds nothing to the style
  if (t.isLogicalExpression(e)) return (e.operator === '&&' || recur(e.left)) && recur(e.right)
  if (t.isArrayExpression(e)) return e.elements.every(x => recur(x))
  if (t.isObjectExpression(e)) {
    return e.properties.every(p => {
      if (t.isSpreadElement(p)) return recur(p.argument)
      if (!t.isObjectProperty(p) || p.computed) return false
      const key = t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : undefined
      if (key === undefined || crossAxisKeys.has(key)) return false
      return platformKeys.has(key) ? recur(p.value) : true
    })
  }
  if (t.isCallExpression(e)) {
    const name = calleeName(e.callee)
    if (name === 'collapseStyles' || name === 'platformStyles') return e.arguments.length === 1 && recur(e.arguments[0])
    return name === 'padding'
  }
  if (t.isMemberExpression(e)) return recur(styleSheetEntry(scope, e))
  return false
}

const styleAttrKeepsCrossAxis = (scope: babel.NodePath['scope'], attr: babel.types.JSXAttribute) =>
  t.isJSXExpressionContainer(attr.value) &&
  !t.isJSXEmptyExpression(attr.value.expression) &&
  styleKeepsCrossAxis(scope, attr.value.expression)

// The nearest JSX element whose children contain this one; undefined when the nearest one holds it
// in an attribute, or there is none.
const parentElement = (path: babel.NodePath<babel.types.JSXElement>) => {
  let last: babel.NodePath = path
  let p: babel.NodePath | null = path.parentPath
  while (p) {
    if (p.isJSXElement()) return last.listKey === 'children' ? p : undefined
    last = p
    p = p.parentPath
  }
  return undefined
}

export const cleanupCandidates = (code: string, filename: string): Array<CleanupCandidate> => {
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {plugins: ['jsx', 'typescript'], sourceFilename: filename, sourceType: 'module'})
  } catch {
    return []
  }
  const out: Array<CleanupCandidate> = []
  // the attribute and the whitespace before it, so an attribute on its own line takes the line along
  const removal = (attr: babel.types.JSXAttribute) => {
    let start = attr.start ?? 0
    while (start > 0 && /\s/.test(code[start - 1] ?? '')) start--
    return {end: attr.end ?? 0, start}
  }
  babel.traverse(ast as babel.types.File, {
    JSXElement(path) {
      const child = path.node.openingElement
      if (classifyName(path.get('openingElement'), filename).kind !== 'target' || opaque(child)) return
      const parentPath = parentElement(path)
      if (!parentPath || classifyName(parentPath.get('openingElement'), filename).kind !== 'target') return
      const parent = parentPath.node.openingElement
      if (parent.attributes.some(a => t.isJSXSpreadAttribute(a)) || findAttr(parent, 'className')) return
      const parentStyle = findAttr(parent, 'style')
      if (parentStyle && !styleAttrKeepsCrossAxis(parentPath.scope, parentStyle)) return
      const direction = stringValue(findAttr(parent, 'direction'))
      const line = child.loc?.start.line ?? 0
      const fullWidth = findAttr(child, 'fullWidth')
      const fullHeight = findAttr(child, 'fullHeight')
      const alignSelf = findAttr(child, 'alignSelf')
      if (alignSelf) {
        if (direction === 'vertical' && isTrue(fullWidth) && alignSelfLiterals.has(stringValue(alignSelf) ?? '')) {
          out.push({attr: 'alignSelf', line, rule: 'C3', ...removal(alignSelf)})
        }
        return
      }
      const alignItems = findAttr(parent, 'alignItems')
      if ((alignItems && stringValue(alignItems) !== 'stretch') || findAttr(parent, 'centerChildren')) return
      if (direction === 'vertical' && fullWidth && isTrue(fullWidth) && !fullHeight) {
        out.push({attr: 'fullWidth', line, rule: 'C1', ...removal(fullWidth)})
      } else if (direction === 'horizontal' && fullHeight && isTrue(fullHeight) && !fullWidth) {
        out.push({attr: 'fullHeight', line, rule: 'C2', ...removal(fullHeight)})
      }
    },
  })
  return out.sort((a, b) => a.start - b.start)
}

export const applyCleanup = (code: string, candidates: ReadonlyArray<CleanupCandidate>) => {
  const ms = new MagicString(code)
  for (const c of candidates) ms.remove(c.start, c.end)
  return ms.toString()
}

const skipDirs = new Set(['node_modules', '.tsOuts', 'dist', '.git'])

const walk = (dir: string, out: Array<string>) => {
  for (const ent of readdirSync(dir, {withFileTypes: true})) {
    if (ent.isDirectory()) {
      if (!skipDirs.has(ent.name)) walk(join(dir, ent.name), out)
    } else if (ent.isFile() && ent.name.endsWith('.tsx')) {
      out.push(join(dir, ent.name))
    }
  }
  return out
}

const git = (cwd: string, args: ReadonlyArray<string>) =>
  execFileSync('git', [...args], {cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024})

// Only candidates whose call site a base capture (desktop or iOS) mounted are kept. Coverage ids are
// base-tree `file:line`, carried forward to HEAD through the base..HEAD diff.
const runCleanup = (root: string, opts: {base: string; write: boolean; reportFile: string | undefined}) => {
  if (git(root, ['status', '--porcelain', '--', '*.tsx']).trim()) {
    throw new Error('cleanup reads the tree as HEAD and maps coverage over base..HEAD: commit or stash .tsx changes first')
  }
  const sha = git(root, ['rev-parse', '--verify', `${opts.base}^{commit}`]).trim()
  const mounted = readBaseCoverage(sha)
  if (!mounted.length) throw new Error(`no coverage stored for base ${sha}`)
  const repoHunks = parseDiffHunks(git(root, ['diff', '--no-ext-diff', '-U0', sha, 'HEAD', '--', '*.tsx']))
  const baseHunks = new Map<string, ReadonlyArray<Hunk>>()
  for (const [p, h] of repoHunks) baseHunks.set(relative('shared', p), h)
  type Row = {site: string; rule: CleanupRule; attr: string}
  const covered: Array<Row> = []
  const uncovered: Array<Row & {why: string}> = []
  const before: Record<CleanupRule, number> = {C1: 0, C2: 0, C3: 0}
  const after: Record<CleanupRule, number> = {C1: 0, C2: 0, C3: 0}
  for (const file of walk(root, []).sort()) {
    const src = readFileSync(file, 'utf8')
    const cands = cleanupCandidates(src, file)
    if (!cands.length) continue
    const rel = relative(root, file)
    const ranges = callSiteRanges(src)
    const keep: Array<CleanupCandidate> = []
    for (const c of cands) {
      before[c.rule]++
      const row = {attr: c.attr, rule: c.rule, site: `${rel}:${c.line}`}
      const range = ranges.find(r => r.start === c.line)
      const why = unmarkedFile(rel)
        ? 'file not marked by coverage'
        : !range
          ? 'call site not marked by coverage'
          : unmountedChanged({baseHunks, changed: new Map([[rel, [range]]]), mounted}).length
            ? 'never mounted by the base tour'
            : undefined
      if (why) {
        uncovered.push({...row, why})
      } else {
        after[c.rule]++
        covered.push(row)
        keep.push(c)
      }
    }
    if (opts.write && keep.length) writeFileSync(file, applyCleanup(src, keep))
  }
  if (opts.reportFile) {
    writeFileSync(opts.reportFile, JSON.stringify({base: sha, before, after, covered, uncovered}, null, 2) + '\n')
  }
  const counts = (r: Record<CleanupRule, number>) => `C1 ${r.C1}, C2 ${r.C2}, C3 ${r.C3}`
  console.log(`candidates: ${counts(before)}`)
  console.log(`covered by base ${sha.slice(0, 10)}: ${counts(after)}${opts.write ? ' (written)' : ' (report only)'}`)
}

const main = (argv: Array<string>) => {
  const [mode, ...rest] = argv
  const write = rest.includes('--write')
  const ri = rest.indexOf('--report')
  const reportFile = ri >= 0 ? rest[ri + 1] : undefined
  if (ri >= 0 && !reportFile) {
    console.error('--report needs a file')
    process.exit(2)
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  if (mode === 'cleanup') {
    const bi = rest.indexOf('--coverage-from')
    const base = bi >= 0 ? rest[bi + 1] : undefined
    if (!base) {
      console.error('cleanup needs --coverage-from <base sha>')
      process.exit(2)
    }
    runCleanup(root, {base, reportFile, write})
    return
  }
  if (mode !== 'pin') {
    console.error(
      'usage: box2-stretch-default.mts pin [--write] [--report <file>]\n' +
        '       box2-stretch-default.mts cleanup --coverage-from <base sha> [--write] [--report <file>]'
    )
    process.exit(2)
  }
  const report = {
    pinned: [] as Array<string>,
    spreads: [] as Array<string>,
    unresolved: [] as Array<{site: string; reason: string}>,
  }
  for (const file of walk(root, []).sort()) {
    const src = readFileSync(file, 'utf8')
    const r = pinSource(src, file)
    const rel = relative(root, file)
    report.pinned.push(...r.pinned.map(s => `${rel}:${s.line}`))
    report.spreads.push(...r.spreads.map(s => `${rel}:${s.line}`))
    report.unresolved.push(...r.unresolved.map(u => ({reason: u.reason, site: `${rel}:${u.line}`})))
    if (write && r.code !== src) writeFileSync(file, r.code)
  }
  if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n')
  console.log(
    `pinned ${report.pinned.length}, spreads ${report.spreads.length}, unresolved ${report.unresolved.length}${write ? ' (written)' : ' (report only)'}`
  )
  for (const u of report.unresolved) console.log(`unresolved ${u.site}: ${u.reason}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
