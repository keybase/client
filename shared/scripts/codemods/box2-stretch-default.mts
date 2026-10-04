// Box2 and ClickableBox center themselves (alignSelf: 'center') when neither fullWidth nor fullHeight
// is set. Before that default is removed, `pin` mode writes the centering out at every call site
// that relied on it, so removing the default changes no pixels.
//
//   node scripts/codemods/box2-stretch-default.mts pin [--write] [--report <file>]
//
// Without --write it only reports. Sites with a spread prop are never edited (the spread may carry
// fullWidth, fullHeight or alignSelf); they are listed for pinning by hand. Sites the codemod cannot
// classify are listed as unresolved with a reason.
import * as babel from '@babel/core'
import {parse} from '@babel/parser'
import MagicString from 'magic-string'
import {readFileSync, readdirSync, writeFileSync} from 'fs'
import {dirname, join, relative, resolve} from 'path'
import {fileURLToPath} from 'url'

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
      const exprs = axes.flatMap(a => (a.kind === 'expr' ? [`(${a.text})`] : []))
      const pin = exprs.length ? ` alignSelf={${exprs.join(' || ')} ? undefined : 'center'}` : ' alignSelf="center"'
      const typeArgs = (node as {typeArguments?: babel.types.Node | null}).typeArguments ?? node.typeParameters
      ms.appendLeft((typeArgs ?? node.name).end ?? 0, pin)
      pinned.push({line})
    },
  })
  return {code: ms.toString(), pinned, spreads, unresolved}
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

const main = (argv: Array<string>) => {
  const [mode, ...rest] = argv
  if (mode !== 'pin') {
    console.error('usage: box2-stretch-default.mts pin [--write] [--report <file>]')
    process.exit(2)
  }
  const write = rest.includes('--write')
  const ri = rest.indexOf('--report')
  const reportFile = ri >= 0 ? rest[ri + 1] : undefined
  if (ri >= 0 && !reportFile) {
    console.error('--report needs a file')
    process.exit(2)
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
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
