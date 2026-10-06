// `pin` applies only to a tree whose Box2 and ClickableBox still center themselves (alignSelf:
// 'center') when neither fullWidth nor fullHeight is set. It writes that centering out at every call
// site that relies on it, so removing the default afterwards changes no pixels. On a tree without the
// default, a pin would center boxes that now stretch, so --write refuses to run there.
//
//   node scripts/codemods/box2-stretch-default.mts pin [--write] [--report <file>]
//
// Without --write it only reports. Sites with a spread prop are never edited (the spread may carry
// fullWidth, fullHeight or alignSelf); they are listed for pinning by hand. Sites the codemod cannot
// classify are listed as unresolved with a reason.
//
//   node scripts/codemods/box2-stretch-default.mts cleanup --coverage-from <base sha> [--at <ref>] [--write] [--report <file>]
//
// Once the default is gone, `cleanup` removes props that only restate the stretch (rules below),
// at call sites that the visual gate's coverage base for <base sha> drew in a capture on every gate
// platform the site renders on (siteGateNeed).
//
//   node scripts/codemods/box2-stretch-default.mts unpin [--write] [--report <file>]
//
// Also once the default is gone, `unpin` removes the pins whose centering the parent already
// provides (rules below). It reads the working tree and needs no coverage: each removal is
// equivalent by construction against the stretch default, so --write refuses a tree that still
// centers by default.
//
//   node scripts/codemods/box2-stretch-default.mts unpin --coverage-from <base sha> [--at <ref>] [--write] [--report <file>]
//
// With a coverage base, `unpin` instead removes every pin the gate renders on every gate platform
// the site renders on, except those on the skip list (U4 below). The gate run on the result decides.
import * as babel from '@babel/core'
import {parse, parseExpression} from '@babel/parser'
import MagicString from 'magic-string'
import {execFileSync} from 'child_process'
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'fs'
import {basename, dirname, join, posix, relative, resolve} from 'path'
import {fileURLToPath} from 'url'
import {
  callSiteRanges,
  outOfScopeFile,
  parseDiffHunks,
  unmarkedFile,
  unmountedChanged,
  type Hunk,
  type Range,
} from '../../tests/e2e/visual/coverage/changed-sites.mts'
import {basePlatformDir, parseCoverageFile, type RunPlatform} from '../../tests/e2e/visual/store.mts'

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

export const readAxis = (attr: babel.types.JSXAttribute | undefined, code: string): AxisValue => {
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

export const findAttr = (node: babel.types.JSXOpeningElement, name: string) => {
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

// Whether common-adapters/box.tsx still centers a box that sets neither fullWidth nor fullHeight:
// the native style list uses `nativeStyles.centered`, or the desktop class list has `box2_centered`.
export const hasImplicitCenter = (boxSource: string) => {
  const ast = parse(boxSource, {plugins: ['jsx', 'typescript'], sourceType: 'module'})
  let found = false
  babel.traverse(ast as babel.types.File, {
    MemberExpression(path) {
      const {object, property} = path.node
      if (t.isIdentifier(object, {name: 'nativeStyles'}) && t.isIdentifier(property, {name: 'centered'})) found = true
    },
    ObjectProperty(path) {
      if (t.isIdentifier(path.node.key, {name: 'box2_centered'})) found = true
    },
  })
  return found
}

export const assertPinWritable = (boxSource: string) => {
  if (!hasImplicitCenter(boxSource)) {
    throw new Error('pin --write needs common-adapters/box.tsx to still center by default; this tree stretches')
  }
}

// ---------------------------------------------------------------- cleanup
//
// With the default gone, a child of a Box2/ClickableBox stretches across its parent's cross axis
// unless it sets alignSelf, so some props only restate that:
//   C1  fullWidth on a child of a vertical parent whose alignItems is absent or stretch
//   C2  fullHeight on a child of a horizontal parent, same alignItems condition
//   C3  a literal alignSelf on a fullWidth child of a vertical parent: a 100%-wide child has no
//       horizontal position to choose
// The parent is the nearest enclosing JSX element, holding the child among its children, and it must
// itself be fullWidth (C1, C3) or fullHeight (C2): a parent sized to its content on that axis gives a
// 100% child nothing definite to fill, so 100% and stretch can differ there. A child
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
  need: GateNeed
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

// A style may stand when it provably leaves some keys alone: every object literal it can resolve to
// lacks them, on any platform branch. It resolves through in-file consts, style sheet entries, and
// the shared/styles module (read from its source): globalStyles / desktopStyles members, the style
// helpers it exports as arrows with an expression body (padding, paddingH, size, …), and
// collapseStyles / platformStyles. Anything else is not provable. A parent style must leave its
// cross-axis layout alone.
const crossAxisKeys = new Set(['alignItems', 'display', 'flexDirection', 'flexWrap'])
const platformKeys = new Set(['common', 'isAndroid', 'isElectron', 'isIOS', 'isMobile', 'isPhone', 'isTablet'])

type Scope = babel.NodePath['scope']
// a node and the scope its names resolve in, in `filename`
type At = {node: babel.types.Node; scope: Scope; filename: string}

export const calleeName = (e: babel.types.Node) =>
  t.isMemberExpression(e) && t.isIdentifier(e.property) ? e.property.name : t.isIdentifier(e) ? e.name : ''

const styleSheetEntryAt = (scope: Scope, e: babel.types.MemberExpression, filename: string): At | undefined => {
  if (!t.isIdentifier(e.object) || e.computed || !t.isIdentifier(e.property)) return undefined
  const init = (name: string) => {
    const decl = scope.getBinding(name)?.path
    return decl?.isVariableDeclarator() && t.isCallExpression(decl.node.init)
      ? (decl.get('init') as babel.NodePath<babel.types.CallExpression>)
      : undefined
  }
  // `styles = Kb.Styles.styleSheetCreate(fn)`, or `styles = useStyles()` with
  // `useStyles = Kb.Styles.createStyleHook(fn)`
  let sheet = init(e.object.name)
  if (sheet && t.isIdentifier(sheet.node.callee) && !sheet.node.arguments.length) {
    const hook = init(sheet.node.callee.name)
    sheet = hook && calleeName(hook.node.callee) === 'createStyleHook' ? hook : undefined
  } else if (sheet && calleeName(sheet.node.callee) !== 'styleSheetCreate') {
    sheet = undefined
  }
  const fn = sheet?.get('arguments')[0]
  if (!fn?.isArrowFunctionExpression()) return undefined
  const body = t.isTSAsExpression(fn.node.body) ? fn.node.body.expression : fn.node.body
  if (!t.isObjectExpression(body)) return undefined
  const name = e.property.name
  // a later duplicate key wins, as in the object at runtime
  let found: babel.types.Node | undefined
  for (const p of body.properties) {
    if (t.isObjectProperty(p) && !p.computed && t.isIdentifier(p.key, {name})) found = p.value
  }
  return found && {filename, node: found, scope: fn.scope}
}

export const styleSheetEntry = (scope: Scope, e: babel.types.MemberExpression): babel.types.Node | undefined =>
  styleSheetEntryAt(scope, e, '')?.node

// The value of a `const x = init` binding (not a destructure), where it was declared.
const constInit = (scope: Scope, name: string, filename: string): At | undefined => {
  const b = scope.getBinding(name)
  if (b?.kind !== 'const' || !b.path.isVariableDeclarator() || !t.isIdentifier(b.path.node.id)) return undefined
  const init = b.path.get('init')
  return init.node ? {filename, node: init.node, scope: init.scope} : undefined
}

const stylesFile = join(dirname(fileURLToPath(import.meta.url)), '../../styles/index.tsx')
let stylesProgram: babel.NodePath<babel.types.Program> | undefined
const stylesModule = () => {
  if (!stylesProgram) {
    const ast = parse(readFileSync(stylesFile, 'utf8'), {plugins: ['jsx', 'typescript'], sourceType: 'module'})
    babel.traverse(ast as babel.types.File, {
      Program(p) {
        stylesProgram = p
        p.stop()
      },
    })
  }
  return stylesProgram!
}

const isStylesSource = (source: string, filename: string) => {
  if (source === '@/styles' || source === '@/styles/index') return true
  if (!source.startsWith('.')) return false
  const abs = resolve(dirname(filename), source)
  return abs.endsWith('/shared/styles') || abs.endsWith('/shared/styles/index')
}

// The shared/styles export a reference names (`Kb.Styles.x`, `Styles.x`, or an `x` imported from
// it), with its declaration there.
const stylesExport = (scope: Scope, e: babel.types.Node, filename: string) => {
  const namespaceOf = (name: string, fromSource: (source: string) => boolean) => {
    const imp = importOf(scope.getBinding(name)?.path)
    return !!imp && t.isImportNamespaceSpecifier(imp.spec) && fromSource(imp.decl.source.value)
  }
  let name: string | undefined
  if (t.isIdentifier(e)) {
    const imp = importOf(scope.getBinding(e.name)?.path)
    if (imp && t.isImportSpecifier(imp.spec) && isStylesSource(imp.decl.source.value, filename)) {
      name = t.isIdentifier(imp.spec.imported) ? imp.spec.imported.name : imp.spec.imported.value
    }
  } else if (t.isMemberExpression(e) && !e.computed && t.isIdentifier(e.property)) {
    const o = e.object
    const viaStyles = t.isIdentifier(o) && namespaceOf(o.name, s => isStylesSource(s, filename))
    const viaKb =
      t.isMemberExpression(o) &&
      !o.computed &&
      t.isIdentifier(o.property, {name: 'Styles'}) &&
      t.isIdentifier(o.object) &&
      // an unbound Kb is taken as the common-adapters namespace, as classifyName does
      ((o.object.name === 'Kb' && !scope.getBinding('Kb')) ||
        namespaceOf(o.object.name, s => isCommonAdaptersSource(s, filename)))
    if (viaStyles || viaKb) name = e.property.name
  }
  if (!name) return undefined
  const decl = stylesModule().scope.getBinding(name)?.path
  const exported = decl?.isVariableDeclarator()
    ? !!decl.parentPath.parentPath?.isExportNamedDeclaration()
    : !!decl?.parentPath?.isExportNamedDeclaration()
  return exported ? {decl: decl!, name} : undefined
}

// What `<obj>.<name>` can be, for an object built from literals, spreads, consts, ternaries and
// getters: each value it may take, or 'absent'. Undefined when that cannot be read.
const memberValues = (at: At, name: string, depth = 0): Array<At | 'absent'> | undefined => {
  if (depth > 12) return undefined
  const recur = (node: babel.types.Node, scope = at.scope) => memberValues({...at, node, scope}, name, depth + 1)
  const e = at.node
  if (t.isTSAsExpression(e) || t.isTSSatisfiesExpression(e) || t.isParenthesizedExpression(e)) return recur(e.expression)
  if (t.isIdentifier(e)) {
    const c = constInit(at.scope, e.name, at.filename)
    return c && memberValues(c, name, depth + 1)
  }
  if (t.isConditionalExpression(e)) {
    const a = recur(e.consequent)
    const b = recur(e.alternate)
    return a && b && [...a, ...b]
  }
  if (!t.isObjectExpression(e)) return undefined
  const out: Array<At | 'absent'> = []
  for (const p of [...e.properties].reverse()) {
    if (t.isSpreadElement(p)) {
      const sub = recur(p.argument)
      if (!sub) return undefined
      out.push(...sub.filter(x => x !== 'absent'))
      if (!sub.includes('absent')) return out
      continue
    }
    if (p.computed) return undefined
    const key = t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : undefined
    if (key === undefined) return undefined
    if (key !== name) continue
    if (t.isObjectProperty(p)) return [...out, {...at, node: p.value}]
    // a getter with a lone return and no parameters: its value is that expression
    const only = t.isObjectMethod(p) && p.kind === 'get' && p.body.body.length === 1 ? p.body.body[0] : undefined
    return t.isReturnStatement(only) && only.argument ? [...out, {...at, node: only.argument}] : undefined
  }
  return [...out, 'absent']
}

const styleLeaves = (at: At, keys: ReadonlySet<string>, depth = 0): boolean => {
  const e = at.node
  if (depth > 16) return false
  const recur = (x: babel.types.Node | null | undefined, to: Partial<At> = {}) =>
    !!x && styleLeaves({...at, ...to, node: x}, keys, depth + 1)
  if (t.isNullLiteral(e) || t.isBooleanLiteral(e, {value: false}) || (t.isIdentifier(e) && e.name === 'undefined')) return true
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
      if (key === undefined || keys.has(key)) return false
      return platformKeys.has(key) ? recur(p.value) : true
    })
  }
  if (t.isIdentifier(e)) {
    const c = constInit(at.scope, e.name, at.filename)
    return !!c && recur(c.node, c)
  }
  if (t.isCallExpression(e)) {
    const ref = stylesExport(at.scope, e.callee, at.filename)
    if (!ref) return false
    if (ref.name === 'collapseStyles' || ref.name === 'platformStyles') {
      return e.arguments.length === 1 && recur(e.arguments[0])
    }
    // a helper's arguments only fill in values, so its body decides the keys
    const fn = ref.decl.isVariableDeclarator() ? ref.decl.get('init') : undefined
    if (!fn?.isArrowFunctionExpression()) return false
    return recur(fn.node.body, {filename: stylesFile, scope: fn.scope})
  }
  if (t.isMemberExpression(e)) {
    const entry = styleSheetEntryAt(at.scope, e, at.filename)
    if (entry) return recur(entry.node, entry)
    if (e.computed || !t.isIdentifier(e.property)) return false
    const obj = stylesExport(at.scope, e.object, at.filename)
    if (obj?.name !== 'globalStyles' && obj?.name !== 'desktopStyles') return false
    const init = obj.decl.isVariableDeclarator() ? obj.decl.get('init') : undefined
    if (!init?.node) return false
    const values = memberValues({filename: stylesFile, node: init.node, scope: init.scope}, e.property.name)
    return !!values && values.every(v => v !== 'absent' && recur(v.node, v))
  }
  return false
}

const styleAttrLeaves = (
  scope: Scope,
  attr: babel.types.JSXAttribute,
  keys: ReadonlySet<string>,
  filename: string
) =>
  t.isJSXExpressionContainer(attr.value) &&
  !t.isJSXEmptyExpression(attr.value.expression) &&
  styleLeaves({filename, node: attr.value.expression, scope}, keys)

export const isMapCall = (p: babel.NodePath | null) =>
  !!p?.isCallExpression() &&
  t.isMemberExpression(p.node.callee) &&
  !p.node.callee.computed &&
  t.isIdentifier(p.node.callee.property, {name: 'map'})

// Whether `child` renders in place inside `p`: JSX children and fragments, `{…}`, either branch of a
// ternary or logical expression, and the callback of a `.map(…)` (expression body, or a top-level
// return of its block body).
const rendersInPlace = (p: babel.NodePath, child: babel.NodePath) => {
  if (p.isJSXFragment()) return child.listKey === 'children'
  if (p.isJSXExpressionContainer() || p.isParenthesizedExpression() || p.isTSAsExpression()) return true
  if (p.isConditionalExpression()) return child.key === 'consequent' || child.key === 'alternate'
  if (p.isLogicalExpression()) return true
  if (p.isReturnStatement()) return true
  // only a function's own block: a return nested in an if or a loop is not followed
  if (p.isBlockStatement()) return p.parentPath.isFunction()
  if (p.isArrowFunctionExpression() || p.isFunctionExpression()) {
    return child.key === 'body' && p.listKey === 'arguments' && p.key === 0 && isMapCall(p.parentPath)
  }
  if (p.isCallExpression()) return isMapCall(p) && child.listKey === 'arguments'
  return false
}

// The nearest JSX element whose children render this one in place; undefined when it is held in an
// attribute, passed through anything else (a helper call, a variable), or there is none.
const parentElement = (path: babel.NodePath<babel.types.JSXElement>) => {
  let last: babel.NodePath = path
  let p: babel.NodePath | null = path.parentPath
  while (p) {
    if (p.isJSXElement()) return last.listKey === 'children' ? p : undefined
    if (!rendersInPlace(p, last)) return undefined
    last = p
    p = p.parentPath
  }
  return undefined
}

// The attribute and the whitespace before it, so an attribute on its own line takes the line along.
const removalRange = (code: string, attr: babel.types.JSXAttribute) => {
  let start = attr.start ?? 0
  while (start > 0 && /\s/.test(code[start - 1] ?? '')) start--
  return {end: attr.end ?? 0, start}
}

export const cleanupCandidates = (code: string, filename: string, project?: Project): Array<CleanupCandidate> => {
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {plugins: ['jsx', 'typescript'], sourceFilename: filename, sourceType: 'module'})
  } catch {
    return []
  }
  const out: Array<CleanupCandidate> = []
  const removal = (attr: babel.types.JSXAttribute) => removalRange(code, attr)
  babel.traverse(ast as babel.types.File, {
    JSXElement(path) {
      const child = path.node.openingElement
      if (classifyName(path.get('openingElement'), filename).kind !== 'target' || opaque(child)) return
      const parentPath = parentElement(path)
      if (!parentPath || classifyName(parentPath.get('openingElement'), filename).kind !== 'target') return
      const parent = parentPath.node.openingElement
      if (parent.attributes.some(a => t.isJSXSpreadAttribute(a)) || findAttr(parent, 'className')) return
      const parentStyle = findAttr(parent, 'style')
      if (parentStyle && !styleAttrLeaves(parentPath.scope, parentStyle, crossAxisKeys, filename)) return
      const direction = stringValue(findAttr(parent, 'direction'))
      const line = child.loc?.start.line ?? 0
      const fullWidth = findAttr(child, 'fullWidth')
      const fullHeight = findAttr(child, 'fullHeight')
      const alignSelf = findAttr(child, 'alignSelf')
      const parentFullWidth = isTrue(findAttr(parent, 'fullWidth'))
      const parentFullHeight = isTrue(findAttr(parent, 'fullHeight'))
      if (alignSelf) {
        if (direction === 'vertical' && parentFullWidth && isTrue(fullWidth) && alignSelfLiterals.has(stringValue(alignSelf) ?? '')) {
          out.push({attr: 'alignSelf', line, need: siteGateNeed(path, filename, project), rule: 'C3', ...removal(alignSelf)})
        }
        return
      }
      const alignItems = findAttr(parent, 'alignItems')
      if ((alignItems && stringValue(alignItems) !== 'stretch') || findAttr(parent, 'centerChildren')) return
      if (direction === 'vertical' && parentFullWidth && fullWidth && isTrue(fullWidth) && !fullHeight) {
        out.push({attr: 'fullWidth', line, need: siteGateNeed(path, filename, project), rule: 'C1', ...removal(fullWidth)})
      } else if (direction === 'horizontal' && parentFullHeight && fullHeight && isTrue(fullHeight) && !fullWidth) {
        out.push({attr: 'fullHeight', line, need: siteGateNeed(path, filename, project), rule: 'C2', ...removal(fullHeight)})
      }
    },
  })
  return out.sort((a, b) => a.start - b.start)
}

export const applyCleanup = (code: string, candidates: ReadonlyArray<{start: number; end: number}>) => {
  const ms = new MagicString(code)
  for (const c of candidates) ms.remove(c.start, c.end)
  return ms.toString()
}

// ---------------------------------------------------------------- unpin
//
// `pin` wrote alignSelf="center", or alignSelf={test ? undefined : 'center'}, wherever the old default
// centered a box. `unpin` removes the pins that change nothing:
//   U1  alignSelf="center" on a child of a parent that centers its children
//   U2  alignSelf={test ? undefined : 'center'} on such a child: neither branch moves it
//   U3  either pin on a child whose own style sets alignSelf on every platform
// U1, U2: a box without alignSelf takes its parent's align-items, on Yoga and in CSS, so centering
// from the parent places the child exactly where its own alignSelf="center" did. A parent centers
// its children when it has a literal alignItems="center", or centerChildren and no alignItems:
// alignItems overrides centerChildren on both platforms (box.tsx lists the alignItems style after
// the centerChildren one; box.css puts box2_alignItems_* after box2_centeredChildren), so a parent
// that sets both centers only when alignItems is "center". The parent is found as in cleanup, must
// be a Box2/ClickableBox without a spread or className, and its style must provably leave its
// cross-axis layout alone. The child must have no spread or className, and its style must provably
// not set position: CSS aligns an absolutely positioned box with align-self auto as normal, not as
// its parent's align-items.
// U3: the style prop wins over the alignSelf prop on both platforms (box.tsx collapses the style
// last on native and sets it inline on desktop, over the box2_alignSelf_* class), so the pin never
// applies. The child must have no spread, which could replace the style.
// A conditional pin's test must be free of side effects, since removing the attribute stops
// evaluating it.

export type UnpinRule = 'U1' | 'U2' | 'U3'
export type UnpinCandidate = {line: number; rule: UnpinRule; start: number; end: number}
export type UnpinResult = {candidates: Array<UnpinCandidate>; skipped: Array<Unresolved>}

const positionKeys = new Set(['position'])

const pinRule = (attr: babel.types.JSXAttribute): UnpinRule | undefined => {
  if (stringValue(attr) === 'center') return 'U1'
  const v = attr.value
  if (!t.isJSXExpressionContainer(v)) return undefined
  const e = v.expression
  return t.isConditionalExpression(e) &&
    t.isIdentifier(e.consequent, {name: 'undefined'}) &&
    t.isStringLiteral(e.alternate, {value: 'center'})
    ? 'U2'
    : undefined
}

const pureTest = (e: babel.types.Node): boolean => {
  if (t.isIdentifier(e) || t.isThisExpression(e) || t.isLiteral(e)) return !t.isTemplateLiteral(e)
  if (t.isMemberExpression(e) || t.isOptionalMemberExpression(e)) {
    return pureTest(e.object) && (!e.computed || t.isLiteral(e.property))
  }
  if (t.isLogicalExpression(e)) return pureTest(e.left) && pureTest(e.right)
  if (t.isUnaryExpression(e, {operator: '!'})) return pureTest(e.argument)
  if (t.isParenthesizedExpression(e) || t.isTSNonNullExpression(e) || t.isTSAsExpression(e)) return pureTest(e.expression)
  return false
}

const pureExpr = (e: babel.types.Node): boolean =>
  t.isConditionalExpression(e) ? pureTest(e.test) && pureExpr(e.consequent) && pureExpr(e.alternate) : pureTest(e)

const alignSelfKeys = new Set(['alignSelf'])

// Whether a style sets a non-empty literal alignSelf on every platform, provably from this file.
// Later entries must leave alignSelf alone. In platformStyles only common and isMobile count as
// setting it on native, since isIOS, isAndroid, isPhone and isTablet apply on some devices only.
const styleSetsAlignSelf = (
  scope: Scope,
  e: babel.types.Node | null | undefined,
  filename: string,
  depth = 0
): boolean => {
  if (!e || depth > 8) return false
  const recur = (x: babel.types.Node | null | undefined) => styleSetsAlignSelf(scope, x, filename, depth + 1)
  const leaves = (x: babel.types.Node | null | undefined) => !!x && styleLeaves({filename, node: x, scope}, alignSelfKeys)
  const lastSets = (xs: ReadonlyArray<babel.types.Node | null | undefined>) =>
    xs.some((x, i) => recur(x) && xs.slice(i + 1).every(leaves))
  if (t.isTSAsExpression(e) || t.isTSSatisfiesExpression(e) || t.isParenthesizedExpression(e)) return recur(e.expression)
  if (t.isConditionalExpression(e)) return recur(e.consequent) && recur(e.alternate)
  if (t.isArrayExpression(e)) return lastSets(e.elements)
  if (t.isObjectExpression(e)) {
    const props = e.properties
    const keyOf = (p: (typeof props)[number]) =>
      t.isObjectProperty(p) && !p.computed
        ? t.isIdentifier(p.key)
          ? p.key.name
          : t.isStringLiteral(p.key)
            ? p.key.value
            : undefined
        : undefined
    const later = (q: (typeof props)[number]) =>
      t.isSpreadElement(q) ? leaves(q.argument) : keyOf(q) !== undefined && keyOf(q) !== 'alignSelf'
    return props.some(
      (p, i) =>
        keyOf(p) === 'alignSelf' &&
        t.isObjectProperty(p) &&
        t.isStringLiteral(p.value) &&
        p.value.value !== '' &&
        props.slice(i + 1).every(later)
    )
  }
  if (t.isCallExpression(e)) {
    const name = calleeName(e.callee)
    if (e.arguments.length !== 1) return false
    if (name === 'collapseStyles') return recur(e.arguments[0])
    const o = e.arguments[0]
    if (name !== 'platformStyles' || !t.isObjectExpression(o)) return false
    const branch: Record<string, babel.types.Node> = {}
    for (const p of o.properties) {
      if (!t.isObjectProperty(p) || p.computed || !t.isIdentifier(p.key) || !platformKeys.has(p.key.name)) return false
      branch[p.key.name] = p.value
    }
    const desktop = [branch['common'], branch['isElectron']]
    const native = [branch['common'], branch['isMobile']]
    const deviceBranches = ['isIOS', 'isAndroid', 'isPhone', 'isTablet'].map(k => branch[k])
    return (
      desktop.some((x, i) => x && recur(x) && desktop.slice(i + 1).every(y => !y || leaves(y))) &&
      native.some((x, i) => x && recur(x) && native.slice(i + 1).every(y => !y || leaves(y))) &&
      deviceBranches.every(y => !y || leaves(y))
    )
  }
  if (t.isMemberExpression(e)) return recur(styleSheetEntry(scope, e))
  return false
}

// undefined when the parent centers its children, else why it may not
const parentNotCentering = (parent: babel.types.JSXOpeningElement) => {
  const alignItems = findAttr(parent, 'alignItems')
  if (alignItems) {
    const v = stringValue(alignItems)
    return v === 'center' ? undefined : v === undefined ? 'parent alignItems is not a literal' : 'parent does not center'
  }
  const centerChildren = findAttr(parent, 'centerChildren')
  if (!centerChildren || isTrue(centerChildren)) return centerChildren ? undefined : 'parent does not center'
  const v = centerChildren.value
  const e = t.isJSXExpressionContainer(v) ? v.expression : undefined
  return t.isBooleanLiteral(e, {value: false}) || t.isNullLiteral(e) || t.isIdentifier(e, {name: 'undefined'})
    ? 'parent does not center'
    : 'parent centerChildren is not a literal'
}

export const unpinCandidates = (code: string, filename: string): UnpinResult => {
  const candidates: Array<UnpinCandidate> = []
  const skipped: Array<Unresolved> = []
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {plugins: ['jsx', 'typescript'], sourceFilename: filename, sourceType: 'module'})
  } catch (e) {
    return {candidates, skipped: [{line: 0, reason: `parse error: ${String(e)}`}]}
  }
  babel.traverse(ast as babel.types.File, {
    JSXElement(path) {
      const child = path.node.openingElement
      if (classifyName(path.get('openingElement'), filename).kind !== 'target') return
      const alignSelf = findAttr(child, 'alignSelf')
      const shape = alignSelf && pinRule(alignSelf)
      if (!alignSelf || !shape) return
      const line = child.loc?.start.line ?? 0
      const childSpread = child.attributes.some(a => t.isJSXSpreadAttribute(a))
      const childStyle = findAttr(child, 'style')
      const childStyleExpr =
        t.isJSXExpressionContainer(childStyle?.value) && !t.isJSXEmptyExpression(childStyle.value.expression)
          ? childStyle.value.expression
          : undefined
      const rule: UnpinRule = !childSpread && styleSetsAlignSelf(path.scope, childStyleExpr, filename) ? 'U3' : shape
      const v = alignSelf.value
      const test = t.isJSXExpressionContainer(v) && t.isConditionalExpression(v.expression) ? v.expression.test : undefined
      const why = (() => {
        if (test && !pureTest(test)) return 'conditional pin test may have side effects'
        if (rule === 'U3') return undefined
        const parentPath = parentElement(path)
        if (!parentPath) return 'no in-place parent element'
        if (classifyName(parentPath.get('openingElement'), filename).kind !== 'target') {
          return 'parent is not Box2/ClickableBox'
        }
        const parent = parentPath.node.openingElement
        if (parent.attributes.some(a => t.isJSXSpreadAttribute(a))) return 'parent has a spread'
        if (findAttr(parent, 'className')) return 'parent has a className'
        const parentStyle = findAttr(parent, 'style')
        if (parentStyle && !styleAttrLeaves(parentPath.scope, parentStyle, crossAxisKeys, filename)) {
          return 'parent style may change its cross axis'
        }
        const notCentering = parentNotCentering(parent)
        if (notCentering) return notCentering
        if (childSpread) return 'child has a spread'
        if (findAttr(child, 'className')) return 'child has a className'
        if (childStyle && !styleAttrLeaves(path.scope, childStyle, positionKeys, filename)) return 'child style may set position'
        return undefined
      })()
      if (why) skipped.push({line, reason: why})
      else candidates.push({line, rule, ...removalRange(code, alignSelf)})
    },
  })
  return {candidates: candidates.sort((a, b) => a.start - b.start), skipped}
}

export const assertUnpinWritable = (boxSource: string) => {
  if (hasImplicitCenter(boxSource)) {
    throw new Error('unpin --write needs common-adapters/box.tsx to stretch by default; this tree still centers')
  }
}

const runUnpin = (root: string, opts: {write: boolean; reportFile: string | undefined}) => {
  if (opts.write) assertUnpinWritable(readFileSync(join(root, 'common-adapters/box.tsx'), 'utf8'))
  const removed: Record<UnpinRule, Array<string>> = {U1: [], U2: [], U3: []}
  const skipped: Array<{site: string; reason: string}> = []
  for (const file of walk(root, []).sort()) {
    const src = readFileSync(file, 'utf8')
    const r = unpinCandidates(src, file)
    const rel = relative(root, file)
    for (const c of r.candidates) removed[c.rule].push(`${rel}:${c.line}`)
    skipped.push(...r.skipped.map(s => ({reason: s.reason, site: `${rel}:${s.line}`})))
    if (opts.write && r.candidates.length) writeFileSync(file, applyCleanup(src, r.candidates))
  }
  const reasons: Record<string, number> = {}
  for (const s of skipped) reasons[s.reason] = (reasons[s.reason] ?? 0) + 1
  if (opts.reportFile) {
    writeFileSync(opts.reportFile, JSON.stringify({reasons, removed, skipped}, null, 2) + '\n')
  }
  console.log(`U1 ${removed.U1.length}, U2 ${removed.U2.length}, U3 ${removed.U3.length}${opts.write ? ' (written)' : ' (report only)'}`)
  for (const [reason, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`skipped ${n}: ${reason}`)
}

// ---------------------------------------------------------------- noop
//
// Props and style keys that restate what the box already does, on both platforms, by construction:
//   N1  alignSelf="stretch" on a child of an in-file Box2/ClickableBox parent without alignItems or
//       centerChildren, whose style provably leaves alignItems alone: the parent stretches its
//       children (vbox/hbox natively, box2_vertical/box2_horizontal on desktop), and a child without
//       alignSelf takes that. The child must have no spread or className, and its style must
//       provably not set position (an absolutely positioned box aligns as normal in CSS).
//   N2  alignItems="stretch" without centerChildren: the base already stretches. No spread or
//       className, which could bring centerChildren or an align-items rule the class outranks.
//   N3  a style flexDirection equal to the one `direction` sets (a literal direction, or none:
//       vertical). The key must be a top-level property of an object literal that is the element's
//       style, or a style sheet entry every use of which is such a style, with nothing before it in
//       the object that may set flexDirection. No spread or className on any of those elements.
//   N4  an alignSelf prop on a box whose own style sets alignSelf on every platform: the style is
//       collapsed last natively and set inline on desktop, so the prop never applies (U3 for any
//       value). No spread; an expression value must be free of side effects.

export type NoopRule = 'N1' | 'N2' | 'N3' | 'N4'
export type NoopCandidate = {line: number; rule: NoopRule; start: number; end: number}

const alignItemsKeys = new Set(['alignItems'])
const flexDirectionKeys = new Set(['flexDirection'])
const directionFlex: Readonly<Record<string, string>> = {
  horizontal: 'row',
  horizontalReverse: 'row-reverse',
  vertical: 'column',
  verticalReverse: 'column-reverse',
}

// The flexDirection a box's `direction` prop sets, when it is a literal or absent.
const directionOf = (node: babel.types.JSXOpeningElement) => {
  const attr = findAttr(node, 'direction')
  if (!attr) return directionFlex['vertical']
  const v = stringValue(attr)
  return v === undefined ? undefined : directionFlex[v]
}

const keyName = (p: babel.types.Node) =>
  t.isObjectProperty(p) && !p.computed
    ? t.isIdentifier(p.key)
      ? p.key.name
      : t.isStringLiteral(p.key)
        ? p.key.value
        : undefined
    : undefined

// The removal range of an object property: up to the next property, or back to the previous one
// when last, or the whole inside of the braces when alone.
const propertyRange = (obj: babel.types.ObjectExpression, i: number) => {
  const p = obj.properties[i]!
  const next = obj.properties[i + 1]
  if (next) return {end: next.start ?? 0, start: p.start ?? 0}
  const prev = obj.properties[i - 1]
  if (prev) return {end: p.end ?? 0, start: prev.end ?? 0}
  return {end: (obj.end ?? 1) - 1, start: (obj.start ?? 0) + 1}
}

// The index of a removable `flexDirection: <want>` in an object literal, or -1.
const flexDirectionKey = (at: At, obj: babel.types.ObjectExpression, want: string) => {
  const i = obj.properties.findIndex(p => keyName(p) === 'flexDirection')
  if (i < 0) return -1
  const p = obj.properties[i]
  if (!t.isObjectProperty(p) || !t.isStringLiteral(p.value, {value: want})) return -1
  const before = obj.properties.slice(0, i)
  const quiet = before.every(q =>
    t.isSpreadElement(q) ? styleLeaves({...at, node: q.argument}, flexDirectionKeys) : keyName(q) !== undefined
  )
  return quiet ? i : -1
}

export const noopCandidates = (code: string, filename: string): Array<NoopCandidate> => {
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {plugins: ['jsx', 'typescript'], sourceFilename: filename, sourceType: 'module'})
  } catch {
    return []
  }
  const out: Array<NoopCandidate> = []
  const plain = (node: babel.types.JSXOpeningElement) =>
    !node.attributes.some(a => t.isJSXSpreadAttribute(a)) && !findAttr(node, 'className')
  // style sheet entries used as a box's whole style: entry node → each use, or undefined once any
  // use is something else
  const entryUses = new Map<babel.types.Node, Array<string | undefined>>()
  const entryAt = new Map<babel.types.Node, At>()
  babel.traverse(ast as babel.types.File, {
    MemberExpression(path) {
      const entry = styleSheetEntryAt(path.scope, path.node, filename)
      if (!entry) return
      const attr = path.parentPath.parentPath
      const el = attr?.parentPath
      const use =
        path.parentPath.isJSXExpressionContainer() &&
        attr?.isJSXAttribute() &&
        t.isJSXIdentifier(attr.node.name, {name: 'style'}) &&
        el?.isJSXOpeningElement() &&
        classifyName(el, filename).kind === 'target' &&
        plain(el.node)
          ? directionOf(el.node)
          : undefined
      entryUses.set(entry.node, [...(entryUses.get(entry.node) ?? []), use])
      entryAt.set(entry.node, entry)
    },
  })
  // A sheet can be followed only when every read of it is a plain `holder.key`: the holder (or the
  // hook that returns it) is not exported, and is never passed whole or read by a computed key.
  const escaped = new Set<babel.types.Node>()
  const onlyMembers = (b: ReturnType<babel.NodePath['scope']['getBinding']>): boolean =>
    !!b &&
    !b.path.parentPath?.parentPath?.isExportNamedDeclaration() &&
    b.referencePaths.every(r => {
      const m = r.parentPath
      return !!m?.isMemberExpression() && m.node.object === r.node && !m.node.computed
    })
  babel.traverse(ast as babel.types.File, {
    VariableDeclarator(path) {
      const init = path.get('init')
      if (!init.isCallExpression() || !t.isIdentifier(path.node.id)) return
      const name = calleeName(init.node.callee)
      if (name !== 'styleSheetCreate' && name !== 'createStyleHook') return
      const fn = init.node.arguments[0]
      const body = t.isArrowFunctionExpression(fn) ? (t.isTSAsExpression(fn.body) ? fn.body.expression : fn.body) : undefined
      if (!t.isObjectExpression(body)) return
      const b = path.scope.getBinding(path.node.id.name)
      const ok =
        name === 'styleSheetCreate'
          ? onlyMembers(b)
          : !!b &&
            !b.path.parentPath?.parentPath?.isExportNamedDeclaration() &&
            b.referencePaths.every(r => {
              const call = r.parentPath
              const decl = call?.parentPath
              return (
                !!call?.isCallExpression() &&
                call.node.callee === r.node &&
                !!decl?.isVariableDeclarator() &&
                t.isIdentifier(decl.node.id) &&
                onlyMembers(decl.scope.getBinding(decl.node.id.name))
              )
            })
      if (!ok) for (const p of body.properties) if (t.isObjectProperty(p)) escaped.add(p.value)
    },
  })
  babel.traverse(ast as babel.types.File, {
    JSXElement(path) {
      const node = path.node.openingElement
      if (classifyName(path.get('openingElement'), filename).kind !== 'target') return
      const line = node.loc?.start.line ?? 0
      const add = (rule: NoopRule, r: {start: number; end: number}) => out.push({line, rule, ...r})
      const spread = node.attributes.some(a => t.isJSXSpreadAttribute(a))
      const style = findAttr(node, 'style')
      const styleExpr =
        t.isJSXExpressionContainer(style?.value) && !t.isJSXEmptyExpression(style.value.expression)
          ? style.value.expression
          : undefined
      const alignSelf = findAttr(node, 'alignSelf')
      const v = alignSelf?.value
      const test = t.isJSXExpressionContainer(v) && !t.isJSXEmptyExpression(v.expression) ? v.expression : undefined
      if (alignSelf && !spread && (!test || pureExpr(test)) && styleSetsAlignSelf(path.scope, styleExpr, filename)) {
        add('N4', removalRange(code, alignSelf))
      } else if (alignSelf && stringValue(alignSelf) === 'stretch' && plain(node)) {
        const parentPath = parentElement(path)
        const parent = parentPath?.node.openingElement
        const parentStyle = parent && findAttr(parent, 'style')
        if (
          parentPath &&
          parent &&
          classifyName(parentPath.get('openingElement'), filename).kind === 'target' &&
          plain(parent) &&
          !findAttr(parent, 'alignItems') &&
          !findAttr(parent, 'centerChildren') &&
          (!parentStyle || styleAttrLeaves(parentPath.scope, parentStyle, alignItemsKeys, filename)) &&
          (!style || styleAttrLeaves(path.scope, style, positionKeys, filename))
        ) {
          add('N1', removalRange(code, alignSelf))
        }
      }
      const alignItems = findAttr(node, 'alignItems')
      if (alignItems && stringValue(alignItems) === 'stretch' && !findAttr(node, 'centerChildren') && plain(node)) {
        add('N2', removalRange(code, alignItems))
      }
      const want = directionOf(node)
      if (!want || !style || !styleExpr || !plain(node)) return
      if (t.isObjectExpression(styleExpr)) {
        const i = flexDirectionKey({filename, node: styleExpr, scope: path.scope}, styleExpr, want)
        if (i < 0) return
        add('N3', styleExpr.properties.length === 1 ? removalRange(code, style) : propertyRange(styleExpr, i))
      } else if (t.isMemberExpression(styleExpr)) {
        const entry = styleSheetEntryAt(path.scope, styleExpr, filename)
        if (!entry || !t.isObjectExpression(entry.node)) return
        // judged once, at the first use; every use must agree
        const uses = entryUses.get(entry.node) ?? []
        if (entryAt.get(entry.node) === undefined || uses.some(u => u !== want) || escaped.has(entry.node)) return
        entryAt.delete(entry.node)
        const i = flexDirectionKey(entry, entry.node, want)
        if (i >= 0) add('N3', propertyRange(entry.node, i))
      }
    },
  })
  return out.sort((a, b) => a.start - b.start)
}

const runNoop = (root: string, opts: {write: boolean; reportFile: string | undefined}) => {
  if (opts.write) assertUnpinWritable(readFileSync(join(root, 'common-adapters/box.tsx'), 'utf8'))
  const removed: Record<NoopRule, Array<string>> = {N1: [], N2: [], N3: [], N4: []}
  for (const file of walk(root, []).sort()) {
    const src = readFileSync(file, 'utf8')
    const cands = noopCandidates(src, file)
    for (const c of cands) removed[c.rule].push(`${relative(root, file)}:${c.line}`)
    if (opts.write && cands.length) writeFileSync(file, applyCleanup(src, cands))
  }
  if (opts.reportFile) writeFileSync(opts.reportFile, JSON.stringify({removed}, null, 2) + '\n')
  const n = (r: NoopRule) => `${r} ${removed[r].length}`
  console.log(`${(['N1', 'N2', 'N3', 'N4'] as const).map(n).join(', ')}${opts.write ? ' (written)' : ' (report only)'}`)
}

export const skipDirs = new Set(['node_modules', '.tsOuts', 'dist', '.git'])

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

// ---------------------------------------------------------------- per-site platforms
//
// A call site inside a platform branch can only mount where that branch runs, so it needs coverage
// only from the gate platforms that stand for those devices. The gate captures a Mac and an iPhone;
// the iPhone stands for every mobile device a site reaches only when the site reaches an iPhone,
// and the Mac for every desktop only when the site reaches a Mac. A site whose mobile devices
// exclude the iPhone (iPad only, Android only, or iPad and desktop as in `isPhone ? … : <site>`), or
// whose desktops exclude the Mac (Linux and Windows window buttons), has devices no capture sees,
// and is never covered.
//
// Branches followed: either arm of a ternary, the right side of && and ||, an if's consequent and
// alternate, and the statements after `if (test) return|throw` (or after an if whose alternate
// exits) in the same block. Tests are evaluated per device in three values, so `isMobile && x`
// narrows and `x` alone does not; a const whose initializer is such a test reads as its initializer.
// Closures (arrows, function expressions, methods) are followed outwards, since one created in a
// branch only exists on that branch's devices; a function declaration is hoisted above any guard, so
// it stops the walk. The flags are the platform globals (isMobile, isElectron, isIOS, isAndroid;
// never when shadowed) and isPhone/isTablet/isDarwin/isMac/isLinux/isWindows imported from
// @/constants, its platform module or @/styles, by name or through a namespace (`C.isTablet`,
// `Kb.Styles.isPhone`).
//
// With a Project, a site also narrows to the devices its enclosing component renders on. Code in a
// function runs only where something reads that function, so a component (a const, function or
// class holding the site's outermost function, through object and array literals, JSX and React's
// memo, forwardRef and lazy) reaches the union of the devices of every read of its binding: each
// read is a site of its own, narrowed the same way, and an exported binding adds every read of the
// export across the project (imports, namespace members, re-exports, dynamic import() and require()).
// A component with no reader in the project (an entry point) reaches every device, as does one held
// in anything else (a call that may invoke it at load time, a destructuring). Reads in type
// positions, closing tags and property writes (`X.displayName = …`) run nothing. Recursion settles
// at the least fixpoint: a read inside the component itself adds nothing.

type Device = 'mac' | 'linux' | 'windows' | 'iPhone' | 'iPad' | 'android'
const desktopDevices: ReadonlyArray<Device> = ['mac', 'linux', 'windows']
const mobileDevices: ReadonlyArray<Device> = ['iPhone', 'iPad', 'android']
const allDevices: ReadonlyArray<Device> = [...desktopDevices, ...mobileDevices]
// constants/platform.tsx: isTablet is an iPad; isPhone is any other mobile device; isDarwin and isMac
// are a Mac desktop, never iOS
const flagDevices: Readonly<Record<string, ReadonlyArray<Device>>> = {
  isAndroid: ['android'],
  isDarwin: ['mac'],
  isElectron: desktopDevices,
  isIOS: ['iPhone', 'iPad'],
  isLinux: ['linux'],
  isMac: ['mac'],
  isMobile: mobileDevices,
  isPhone: ['iPhone', 'android'],
  isTablet: ['iPad'],
  isWindows: ['windows'],
}
const globalFlags = new Set(['isMobile', 'isElectron', 'isIOS', 'isAndroid'])
const moduleFlags = new Set(['isPhone', 'isTablet', 'isDarwin', 'isMac', 'isLinux', 'isWindows'])
const flagModules = ['constants', 'constants/index', 'constants/platform', 'styles', 'styles/index']

// Reviewed reachability the analysis cannot prove, by file under shared/. `devices` narrows every
// site in the file; `unreachable` names why the gate never renders the file (a site there is
// reported as unreachable by the gate, never as covered).
export const platformOnly: Readonly<Record<string, {devices: ReadonlyArray<Device>; reason: string}>> = {
  'fs/banner/system-file-manager-integration-banner/kext-permission-popup.tsx': {
    devices: desktopDevices,
    reason: 'the kextPermission route is pushed by name only from the desktop FUSE install (fs/common/sfmi.tsx, settings/files)',
  },
}
export const gateUnreachable: Readonly<Record<string, string>> = {
  'settings/make-icons.page.tsx': 'a developer tool that renders icon sheets for export, not an app screen',
}

const isFlagModule = (source: string, filename: string) => {
  if (source.startsWith('@/')) return flagModules.includes(source.slice(2))
  if (!source.startsWith('.')) return false
  const abs = resolve(dirname(filename), source)
  return flagModules.some(m => abs.endsWith(`/${m}`))
}

const fileDevices = (filename: string): ReadonlyArray<Device> =>
  filename.endsWith('.desktop.tsx')
    ? desktopDevices
    : filename.endsWith('.native.tsx')
      ? mobileDevices
      : filename.endsWith('.ios.tsx')
        ? ['iPhone', 'iPad']
        : filename.endsWith('.android.tsx')
          ? ['android']
          : allDevices

// Which flag a test operand reads, when it provably is one.
const flagOf = (scope: babel.NodePath['scope'], e: babel.types.Node, filename: string): string | undefined => {
  if (t.isIdentifier(e)) {
    const binding = scope.getBinding(e.name)
    if (!binding) return globalFlags.has(e.name) ? e.name : undefined
    const imp = importOf(binding.path)
    if (!imp || !moduleFlags.has(e.name) || !t.isImportSpecifier(imp.spec)) return undefined
    const imported = t.isIdentifier(imp.spec.imported) ? imp.spec.imported.name : imp.spec.imported.value
    return imported === e.name && isFlagModule(imp.decl.source.value, filename) ? e.name : undefined
  }
  if (!t.isMemberExpression(e) || e.computed || !t.isIdentifier(e.property) || !moduleFlags.has(e.property.name)) {
    return undefined
  }
  const name = e.property.name
  // Kb.Styles.isPhone, with Kb a namespace import of common-adapters
  if (t.isMemberExpression(e.object)) {
    const o = e.object
    if (o.computed || !t.isIdentifier(o.property, {name: 'Styles'}) || !t.isIdentifier(o.object)) return undefined
    const imp = importOf(scope.getBinding(o.object.name)?.path)
    return imp && t.isImportNamespaceSpecifier(imp.spec) && isCommonAdaptersSource(imp.decl.source.value, filename)
      ? name
      : undefined
  }
  if (!t.isIdentifier(e.object)) return undefined
  const imp = importOf(scope.getBinding(e.object.name)?.path)
  return imp && t.isImportNamespaceSpecifier(imp.spec) && isFlagModule(imp.decl.source.value, filename) ? name : undefined
}

// A test's truthiness on a device: true, false, or undefined when it is not known statically.
export const truthOn = (
  scope: babel.NodePath['scope'],
  e: babel.types.Node,
  device: Device,
  filename: string,
  project?: Project,
  depth = 0
): boolean | undefined => {
  const recur = (x: babel.types.Node) => truthOn(scope, x, device, filename, project, depth)
  if (t.isParenthesizedExpression(e) || t.isTSAsExpression(e) || t.isTSNonNullExpression(e)) return recur(e.expression)
  if (t.isBooleanLiteral(e)) return e.value
  if (t.isUnaryExpression(e, {operator: '!'})) {
    const v = recur(e.argument)
    return v === undefined ? undefined : !v
  }
  if (t.isLogicalExpression(e) && e.operator !== '??') {
    const l = recur(e.left)
    const r = recur(e.right)
    if (e.operator === '&&') return l === false || r === false ? false : l && r ? true : undefined
    return l === true || r === true ? true : l === false && r === false ? false : undefined
  }
  const flag = flagOf(scope, e, filename)
  if (flag) return flagDevices[flag]!.includes(device)
  if (depth >= 8) return undefined
  // a const holds its initializer's value, in this module or (with a project) the one exporting it
  const b = t.isIdentifier(e) ? scope.getBinding(e.name) : undefined
  const decl = b?.kind === 'const' ? b.path : undefined
  if (decl?.isVariableDeclarator() && t.isIdentifier(decl.node.id) && decl.node.init) {
    return truthOn(decl.scope, decl.node.init, device, filename, project, depth + 1)
  }
  const found = project && indexOf(project).importedConst(scope, e, filename)
  return found ? truthOn(found.scope, found.init, device, join(project.root, found.rel), project, depth + 1) : undefined
}

// Whether a statement never completes normally, so the statements after it in its block do not run
// when it does: return, throw, break or continue, a block ending in one, or an if whose branches
// both are. A jump inside the block that skips its last statement still leaves the block abruptly,
// since only a label on the block itself could catch it, and an unlabeled block has none.
const exits = (s: babel.types.Node | null | undefined): boolean => {
  if (t.isReturnStatement(s) || t.isThrowStatement(s) || t.isBreakStatement(s) || t.isContinueStatement(s)) return true
  if (t.isIfStatement(s)) return exits(s.consequent) && exits(s.alternate)
  return t.isBlockStatement(s) && exits(s.body[s.body.length - 1])
}

// The sources of a project: every .ts/.tsx/.js file under shared/ that the app can load, by path
// relative to `root` (stories and tests are left out: they render components outside the app).
export type Project = {root: string; files: ReadonlyMap<string, string>}

// The devices a call site can mount on.
export const siteDevices = (path: babel.NodePath, filename: string, project?: Project): Array<Device> => {
  const rel = project ? relative(project.root, filename) : undefined
  const reviewed = rel === undefined ? undefined : platformOnly[rel]?.devices
  let devices = fileDevices(filename).filter(d => !reviewed || reviewed.includes(d))
  const narrow = (test: babel.types.Node, scope: babel.NodePath['scope'], when: boolean) => {
    devices = devices.filter(d => truthOn(scope, test, d, filename, project) !== !when)
  }
  let last: babel.NodePath = path
  let p: babel.NodePath | null = path.parentPath
  while (p && !p.isProgram() && !p.isFunctionDeclaration()) {
    if (p.isConditionalExpression() && (last.key === 'consequent' || last.key === 'alternate')) {
      narrow(p.node.test, p.scope, last.key === 'consequent')
    } else if (p.isLogicalExpression() && last.key === 'right' && p.node.operator !== '??') {
      narrow(p.node.left, p.scope, p.node.operator === '&&')
    } else if (p.isIfStatement() && (last.key === 'consequent' || last.key === 'alternate')) {
      narrow(p.node.test, p.scope, last.key === 'consequent')
    } else if (p.isBlockStatement() && last.listKey === 'body' && typeof last.key === 'number') {
      for (const s of p.node.body.slice(0, last.key)) {
        if (!t.isIfStatement(s)) continue
        if (exits(s.consequent)) narrow(s.test, p.scope, false)
        else if (exits(s.alternate)) narrow(s.test, p.scope, true)
      }
    }
    last = p
    p = p.parentPath
  }
  if (!project || rel === undefined || !devices.length || !p) return devices
  const reach = indexOf(project).holderDevices(p, path, rel)
  return reach ? devices.filter(d => reach.includes(d)) : devices
}

// ------------------------------------------------ project reachability

type Binding = NonNullable<ReturnType<babel.NodePath['scope']['getBinding']>>
type ConstInit = {init: babel.types.Expression; rel: string; scope: babel.NodePath['scope']}
type Edge =
  | {kind: 'import'; from: string; imported: string; local: string}
  | {kind: 'namespace'; from: string; local: string}
  | {kind: 'reexport'; from: string; imported: string; exported: string}
  | {kind: 'all'; from: string}
  | {kind: 'namespace-export'; from: string; exported: string}
  | {kind: 'dynamic'; from: string; start: number}

const parseModule = (code: string, filename: string) =>
  parse(code, {plugins: ['jsx', 'typescript'], sourceFilename: filename, sourceType: 'module'})

// Every file a module specifier may load, platform variants included: an import of `./x` reads
// x.desktop.tsx on desktop and x.native.tsx on a phone, so it is a read of both.
const specExts = ['', '.tsx', '.ts', '.js', '.desktop.tsx', '.native.tsx', '.ios.tsx', '.android.tsx', '.desktop.ts', '.native.ts']
export const resolveSpecifier = (files: ReadonlyMap<string, string>, fromRel: string, source: string) => {
  let base: string
  if (source.startsWith('@/')) base = posix.normalize(source.slice(2))
  else if (source.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(fromRel), source))
  else return []
  if (base.startsWith('..')) return []
  return [...specExts.map(e => base + e), ...specExts.slice(1).map(e => `${base}/index${e}`)].filter(f => files.has(f))
}

const specName = (n: babel.types.Identifier | babel.types.StringLiteral) => (t.isIdentifier(n) ? n.name : n.value)

// React's memo, forwardRef and lazy call their argument only when the component they return renders.
const deferringCall = (call: babel.NodePath<babel.types.CallExpression>) => {
  const callee = call.node.callee
  const fromReact = (name: string) => importOf(call.scope.getBinding(name)?.path)?.decl.source.value === 'react'
  const wrappers = new Set(['memo', 'forwardRef', 'lazy'])
  if (t.isIdentifier(callee)) {
    const imp = importOf(call.scope.getBinding(callee.name)?.path)
    return (
      !!imp &&
      imp.decl.source.value === 'react' &&
      t.isImportSpecifier(imp.spec) &&
      wrappers.has(specName(imp.spec.imported))
    )
  }
  return (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object) &&
    t.isIdentifier(callee.property) &&
    wrappers.has(callee.property.name) &&
    fromReact(callee.object.name)
  )
}

// Whether a function held at `child` stays uncalled while its parent `q` evaluates, and reachable
// only through what holds `q`.
const holdsUncalled = (q: babel.NodePath, child: babel.NodePath) => {
  if (q.isObjectProperty() || q.isClassProperty()) return child.key === 'value'
  if (q.isConditionalExpression()) return child.key === 'consequent' || child.key === 'alternate'
  if (q.isCallExpression()) return child.listKey === 'arguments' && deferringCall(q)
  return (
    q.isObjectExpression() ||
    q.isArrayExpression() ||
    q.isSpreadElement() ||
    q.isLogicalExpression() ||
    q.isParenthesizedExpression() ||
    q.isTSAsExpression() ||
    q.isTSSatisfiesExpression() ||
    q.isTSNonNullExpression() ||
    q.isClassBody() ||
    q.isClassExpression() ||
    q.isJSXExpressionContainer() ||
    q.isJSXAttribute() ||
    q.isJSXSpreadAttribute() ||
    q.isJSXOpeningElement() ||
    q.isJSXElement() ||
    q.isJSXFragment()
  )
}

class ProjectIndex {
  private programs = new Map<string, babel.NodePath<babel.types.Program>>()
  private edges: Map<string, Array<Edge>> | undefined
  private bindingMemo = new Map<Binding, ReadonlyArray<Device>>()
  private exportMemo = new Map<string, ReadonlyArray<Device>>()
  private inProgress = new Map<unknown, number>()
  private lowest = Infinity

  private project: Project

  constructor(project: Project) {
    this.project = project
  }

  private program(rel: string) {
    let prog = this.programs.get(rel)
    if (!prog) {
      const ast = parseModule(this.project.files.get(rel) ?? '', join(this.project.root, rel))
      babel.traverse(ast as babel.types.File, {
        Program(p) {
          prog = p
          p.stop()
        },
      })
      this.programs.set(rel, prog!)
    }
    return prog!
  }

  // The initializer of `export const <name> = …` that a module exports as `name`, through
  // re-exports, or undefined when it is anything else or several files may provide it.
  private exportedConst(rel: string, name: string, depth = 0): ConstInit | undefined {
    if (depth > 8) return undefined
    const follow = (source: string, imported: string) => {
      const targets = resolveSpecifier(this.project.files, rel, source)
      return targets.length === 1 ? this.exportedConst(targets[0]!, imported, depth + 1) : undefined
    }
    const prog = this.program(rel)
    const local = (l: string): ConstInit | undefined => {
      const b = prog.scope.getBinding(l)
      if (!b) return undefined
      const imp = importOf(b.path)
      if (imp) return t.isImportSpecifier(imp.spec) ? follow(imp.decl.source.value, specName(imp.spec.imported)) : undefined
      const d = b.kind === 'const' ? b.path : undefined
      return d?.isVariableDeclarator() && t.isIdentifier(d.node.id) && d.node.init ? {init: d.node.init, rel, scope: d.scope} : undefined
    }
    for (const s of prog.get('body')) {
      if (s.isExportNamedDeclaration()) {
        const decl = s.node.declaration
        if (t.isVariableDeclaration(decl) && decl.declarations.some(d => t.isIdentifier(d.id, {name}))) return local(name)
        for (const spec of s.node.specifiers) {
          if (!t.isExportSpecifier(spec) || specName(spec.exported) !== name) continue
          return s.node.source ? follow(s.node.source.value, spec.local.name) : local(spec.local.name)
        }
      }
    }
    for (const s of prog.node.body) {
      if (t.isExportAllDeclaration(s) && name !== 'default') {
        const found = follow(s.source.value, name)
        if (found) return found
      }
    }
    return undefined
  }

  // The const a test operand imports from a project module: `x` from `import {x} from …`, or
  // `M.x` from `import * as M from …`.
  importedConst(scope: babel.NodePath['scope'], e: babel.types.Node, filename: string): ConstInit | undefined {
    const rel = relative(this.project.root, filename)
    const from = (local: string) => importOf(scope.getBinding(local)?.path)
    let imp: ReturnType<typeof importOf>
    let name: string
    if (t.isIdentifier(e)) {
      imp = from(e.name)
      if (!imp || !t.isImportSpecifier(imp.spec)) return undefined
      name = specName(imp.spec.imported)
    } else if (t.isMemberExpression(e) && !e.computed && t.isIdentifier(e.object) && t.isIdentifier(e.property)) {
      imp = from(e.object.name)
      if (!imp || !t.isImportNamespaceSpecifier(imp.spec)) return undefined
      name = e.property.name
    } else return undefined
    const targets = resolveSpecifier(this.project.files, rel, imp.decl.source.value)
    return targets.length === 1 ? this.exportedConst(targets[0]!, name) : undefined
  }

  // Who reads each module, by the module's path.
  private importers(rel: string): ReadonlyArray<Edge> {
    if (!this.edges) {
      const edges = new Map<string, Array<Edge>>()
      const add = (fromRel: string, source: string, e: Edge) => {
        for (const target of resolveSpecifier(this.project.files, fromRel, source)) {
          edges.set(target, [...(edges.get(target) ?? []), e])
        }
      }
      for (const [from, src] of this.project.files) {
        const ast = parseModule(src, join(this.project.root, from))
        for (const s of ast.program.body) {
          if (t.isImportDeclaration(s) && s.importKind !== 'type') {
            for (const spec of s.specifiers) {
              if (t.isImportNamespaceSpecifier(spec)) add(from, s.source.value, {from, kind: 'namespace', local: spec.local.name})
              else if (!(t.isImportSpecifier(spec) && spec.importKind === 'type')) {
                const imported = t.isImportDefaultSpecifier(spec) ? 'default' : specName(spec.imported)
                add(from, s.source.value, {from, imported, kind: 'import', local: spec.local.name})
              }
            }
          } else if (t.isExportNamedDeclaration(s) && s.source && s.exportKind !== 'type') {
            for (const spec of s.specifiers) {
              const exported = specName(spec.exported)
              if (t.isExportNamespaceSpecifier(spec)) add(from, s.source.value, {exported, from, kind: 'namespace-export'})
              else if (t.isExportSpecifier(spec) && spec.exportKind !== 'type') {
                add(from, s.source.value, {exported, from, imported: specName(spec.local), kind: 'reexport'})
              }
            }
          } else if (t.isExportAllDeclaration(s) && s.exportKind !== 'type') {
            add(from, s.source.value, {from, kind: 'all'})
          }
        }
        if (!/\b(import|require)\s*\(/.test(src)) continue
        this.program(from).traverse({
          CallExpression(c) {
            const [arg] = c.node.arguments
            const dynamic =
              t.isImport(c.node.callee) ||
              (t.isIdentifier(c.node.callee, {name: 'require'}) && !c.scope.getBinding('require'))
            if (dynamic && t.isStringLiteral(arg)) add(from, arg.value, {from, kind: 'dynamic', start: c.node.start ?? -1})
          },
        })
      }
      this.edges = edges
    }
    return this.edges.get(rel) ?? []
  }

  // Memoized with least-fixpoint recursion: a key read again while it is being computed adds
  // nothing, and a result that leaned on an outer key still in progress is not kept.
  private settle(memo: Map<never, ReadonlyArray<Device>>, key: unknown, compute: () => ReadonlyArray<Device>) {
    const m = memo as Map<unknown, ReadonlyArray<Device>>
    const known = m.get(key)
    if (known) return known
    const at = this.inProgress.get(key)
    if (at !== undefined) {
      this.lowest = Math.min(this.lowest, at)
      return []
    }
    const depth = this.inProgress.size
    this.inProgress.set(key, depth)
    const outer = this.lowest
    this.lowest = Infinity
    const out = compute()
    this.inProgress.delete(key)
    if (this.lowest >= depth) m.set(key, out)
    this.lowest = Math.min(outer, this.lowest >= depth ? Infinity : this.lowest)
    return out
  }

  private union(parts: Iterable<ReadonlyArray<Device>>) {
    const out = new Set<Device>()
    for (const p of parts) for (const d of p) out.add(d)
    return allDevices.filter(d => out.has(d))
  }

  // The devices on which code reads a binding.
  bindingDevices(b: Binding, rel: string): ReadonlyArray<Device> {
    return this.settle(this.bindingMemo as Map<never, ReadonlyArray<Device>>, b, () => {
      const parts: Array<ReadonlyArray<Device>> = []
      const decl = b.path.parentPath
      if ((b.path.isFunctionDeclaration() || b.path.isClassDeclaration()) && decl?.isExportDefaultDeclaration()) {
        parts.push(this.exportDevices(rel, 'default'))
      }
      for (const r of b.referencePaths) {
        const parent = r.parentPath
        if (parent?.isJSXClosingElement()) continue
        if (r.findParent(x => x.isTSType() || x.isTSTypeAliasDeclaration() || x.isTSInterfaceDeclaration())) continue
        if (parent?.isMemberExpression() && r.key === 'object' && parent.parentPath.isAssignmentExpression() && parent.key === 'left') {
          continue
        }
        if (r.isExportNamedDeclaration()) parts.push(this.exportDevices(rel, b.identifier.name))
        else if (parent?.isExportSpecifier()) parts.push(this.exportDevices(rel, specName(parent.node.exported)))
        else if (parent?.isExportDefaultDeclaration()) parts.push(this.exportDevices(rel, 'default'))
        else parts.push(siteDevices(r, join(this.project.root, rel), this.project))
      }
      return this.union(parts)
    })
  }

  // The devices on which code reads one member of a namespace import, or the namespace whole.
  private namespaceDevices(b: Binding, rel: string, name: string) {
    const parts: Array<ReadonlyArray<Device>> = []
    for (const r of b.referencePaths) {
      const parent = r.parentPath
      if (r.findParent(x => x.isTSType())) continue
      const member =
        (parent?.isMemberExpression() && r.key === 'object' && !parent.node.computed && t.isIdentifier(parent.node.property)
          ? parent.node.property.name
          : undefined) ??
        (parent?.isJSXMemberExpression() && r.key === 'object' ? parent.node.property.name : undefined)
      if (member !== undefined && member !== name) continue
      if (parent?.parentPath?.isJSXClosingElement()) continue
      parts.push(siteDevices(member === undefined ? r : parent!, join(this.project.root, rel), this.project))
    }
    return this.union(parts)
  }

  // The devices on which code reads a module's export.
  exportDevices(rel: string, name: string): ReadonlyArray<Device> {
    return this.settle(this.exportMemo as Map<never, ReadonlyArray<Device>>, `${rel}#${name}`, () => {
      const edges = this.importers(rel)
      if (!edges.length) return allDevices
      const parts: Array<ReadonlyArray<Device>> = []
      for (const e of edges) {
        const binding = (local: string) => this.program(e.from).scope.getBinding(local)
        if (e.kind === 'import') {
          if (e.imported !== name) continue
          const b = binding(e.local)
          parts.push(b ? this.bindingDevices(b, e.from) : allDevices)
        } else if (e.kind === 'namespace') {
          const b = binding(e.local)
          parts.push(b ? this.namespaceDevices(b, e.from, name) : allDevices)
        } else if (e.kind === 'reexport') {
          if (e.imported === name) parts.push(this.exportDevices(e.from, e.exported))
        } else if (e.kind === 'all') {
          if (name !== 'default') parts.push(this.exportDevices(e.from, name))
        } else if (e.kind === 'dynamic') {
          let call: babel.NodePath | undefined
          this.program(e.from).traverse({
            CallExpression(c) {
              if (c.node.start === e.start) {
                call = c
                c.stop()
              }
            },
          })
          parts.push(call ? siteDevices(call, join(this.project.root, e.from), this.project) : allDevices)
        } else {
          parts.push(this.exportDevices(e.from, e.exported))
        }
      }
      return this.union(parts)
    })
  }

  // The devices on which the component holding a site renders, or undefined when that is not known.
  // `stop` is where siteDevices' walk ended: a function declaration, or the program.
  holderDevices(stop: babel.NodePath, site: babel.NodePath, rel: string): ReadonlyArray<Device> | undefined {
    if (stop.isFunctionDeclaration()) {
      const id = stop.node.id
      if (!id) return stop.parentPath.isExportDefaultDeclaration() ? this.exportDevices(rel, 'default') : undefined
      const b = stop.parentPath.scope.getBinding(id.name)
      return b ? this.bindingDevices(b, rel) : undefined
    }
    let fn: babel.NodePath | undefined
    for (let q: babel.NodePath | null = site; q && !q.isProgram(); q = q.parentPath) if (q.isFunction()) fn = q
    // code outside any function runs when its module loads
    if (!fn) return undefined
    let child = fn
    for (let q = fn.parentPath; q && !q.isProgram(); q = q.parentPath) {
      if (q.isVariableDeclarator()) {
        if (child.key !== 'init' || !t.isIdentifier(q.node.id)) return undefined
        const b = q.scope.getBinding(q.node.id.name)
        return b ? this.bindingDevices(b, rel) : undefined
      }
      if (q.isClassDeclaration()) {
        if (q.node.id) {
          const b = q.parentPath.scope.getBinding(q.node.id.name)
          return b ? this.bindingDevices(b, rel) : undefined
        }
        return q.parentPath.isExportDefaultDeclaration() ? this.exportDevices(rel, 'default') : undefined
      }
      if (q.isExportDefaultDeclaration()) return this.exportDevices(rel, 'default')
      if (!holdsUncalled(q, child)) return undefined
      child = q
    }
    return undefined
  }
}

const indexes = new WeakMap<Project, ProjectIndex>()
const indexOf = (project: Project) => {
  let ix = indexes.get(project)
  if (!ix) {
    ix = new ProjectIndex(project)
    indexes.set(project, ix)
  }
  return ix
}

// A project read from the tree at a commit.
export const projectAt = (root: string, sha: string): Project => {
  const rels = git(root, ['ls-tree', '-r', '--name-only', sha, '--', '.'])
    .split('\n')
    .filter(f => /\.(tsx?|js)$/.test(f) && !f.endsWith('.d.ts') && !f.split('/').some(seg => skipDirs.has(seg)) && !outOfScopeFile(f))
  const files = new Map<string, string>()
  const out = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: rels.map(r => `${sha}:./${r}`).join('\n') + '\n',
    maxBuffer: 1024 * 1024 * 1024,
  })
  let at = 0
  for (const rel of rels) {
    const nl = out.indexOf(10, at)
    const header = out.subarray(at, nl).toString('utf8').split(' ')
    const size = Number(header[2])
    files.set(rel, out.subarray(nl + 1, nl + 1 + size).toString('utf8'))
    at = nl + 1 + size + 1
  }
  return {files, root}
}

// The gate platforms a site needs coverage from, or why no coverage can stand for it.
export type GateNeed = {platforms: Array<RunPlatform>} | {why: string}

export const gateNeed = (devices: ReadonlyArray<Device>): GateNeed => {
  if (!devices.length) return {why: 'reachable on no device'}
  const mobile = devices.filter(d => mobileDevices.includes(d))
  const desktop = devices.filter(d => desktopDevices.includes(d))
  const unseen = [
    ...(mobile.length && !mobile.includes('iPhone') ? [`${mobile.join(' or ')} among mobile devices`] : []),
    ...(desktop.length && !desktop.includes('mac') ? [`${desktop.join(' or ')} among desktops`] : []),
  ]
  if (unseen.length) return {why: `unreachable by the gate: only on ${unseen.join(', and ')}`}
  const platforms: Array<RunPlatform> = []
  if (desktop.length) platforms.push('desktop')
  if (mobile.length) platforms.push('ios')
  return {platforms}
}

export const siteGateNeed = (path: babel.NodePath, filename: string, project?: Project): GateNeed => {
  const rel = project ? relative(project.root, filename) : undefined
  const unreachable = rel === undefined ? undefined : gateUnreachable[rel]
  return unreachable ? {why: `unreachable by the gate: ${unreachable}`} : gateNeed(siteDevices(path, filename, project))
}

// The gate platforms whose base coverage misses a call site. Coverage ids are base-tree
// `file:line`, carried forward through `hunks` (the base..tree diff of that file).
export const unmountedPlatforms = (opts: {
  rel: string
  platforms: ReadonlyArray<RunPlatform>
  range: Range
  hunks: ReadonlyArray<Hunk>
  mounted: Readonly<Record<RunPlatform, ReadonlyArray<string>>>
}): Array<RunPlatform> =>
  opts.platforms.filter(
    platform =>
      unmountedChanged({
        baseHunks: new Map([[opts.rel, opts.hunks]]),
        changed: new Map([[opts.rel, [opts.range]]]),
        mounted: opts.mounted[platform],
      }).length > 0
  )

// Why the base's coverage cannot stand for a call site, or undefined when it can.
const coverageGap = (o: {
  rel: string
  line: number
  need: GateNeed
  ranges: ReadonlyArray<Range>
  baseHunks: ReadonlyMap<string, ReadonlyArray<Hunk>>
  mounted: Readonly<Record<RunPlatform, ReadonlyArray<string>>>
}) => {
  if (unmarkedFile(o.rel)) return 'file not marked by coverage'
  const range = o.ranges.find(r => r.start === o.line)
  if (!range) return 'call site not marked by coverage'
  if ('why' in o.need) return o.need.why
  const missing = unmountedPlatforms({
    hunks: o.baseHunks.get(o.rel) ?? [],
    mounted: o.mounted,
    platforms: o.need.platforms,
    range,
    rel: o.rel,
  })
  return missing.length ? `never mounted on ${missing.join(' or ')}` : undefined
}

// The call sites a platform's base captures drew. A masked entry counts for nothing: its sites
// may sit under a mask the compare never sees. A file without the masked or visible flag is
// refused rather than trusted (parseCoverageFile).
export const platformCoverage = (sha: string, platform: RunPlatform) => {
  const out = new Set<string>()
  const walkCoverage = (dir: string) => {
    if (!existsSync(dir)) return
    for (const d of readdirSync(dir, {withFileTypes: true})) {
      const p = join(dir, d.name)
      if (d.isDirectory()) walkCoverage(p)
      else if (basename(dir) === 'coverage' && d.name.endsWith('.json')) {
        const file = parseCoverageFile(JSON.parse(readFileSync(p, 'utf8')), p)
        if (!file.masked) for (const id of file.ids) out.add(id)
      }
    }
  }
  walkCoverage(basePlatformDir(sha, platform))
  return [...out]
}

// Candidates are computed on the tree at `at` (HEAD by default; --write needs HEAD and a clean tree)
// and kept only where every gate platform the site needs (siteGateNeed) mounted it.
const runCleanup = (
  root: string,
  opts: {base: string; at: string; write: boolean; reportFile: string | undefined}
) => {
  const atSha = git(root, ['rev-parse', '--verify', `${opts.at}^{commit}`]).trim()
  if (opts.write) {
    if (atSha !== git(root, ['rev-parse', 'HEAD']).trim()) throw new Error('--write needs --at HEAD')
    if (git(root, ['status', '--porcelain', '--', '*.tsx']).trim()) {
      throw new Error('cleanup --write reads the tree as HEAD: commit or stash .tsx changes first')
    }
  }
  const sha = git(root, ['rev-parse', '--verify', `${opts.base}^{commit}`]).trim()
  const mounted = {desktop: platformCoverage(sha, 'desktop'), ios: platformCoverage(sha, 'ios')}
  if (!mounted.desktop.length || !mounted.ios.length) {
    throw new Error(`base ${sha} needs stored coverage for both desktop and iOS`)
  }
  const repoHunks = parseDiffHunks(git(root, ['diff', '--no-ext-diff', '-U0', sha, atSha, '--', '*.tsx']))
  const baseHunks = new Map<string, ReadonlyArray<Hunk>>()
  for (const [p, h] of repoHunks) baseHunks.set(relative('shared', p), h)
  type Row = {site: string; rule: CleanupRule; attr: string}
  const covered: Array<Row> = []
  const uncovered: Array<Row & {why: string}> = []
  const before: Record<CleanupRule, number> = {C1: 0, C2: 0, C3: 0}
  const after: Record<CleanupRule, number> = {C1: 0, C2: 0, C3: 0}
  const project = projectAt(root, atSha)
  const tracked = [...project.files.keys()].filter(f => f.endsWith('.tsx')).sort()
  for (const rel of tracked) {
    const file = join(root, rel)
    const src = project.files.get(rel)!
    const cands = cleanupCandidates(src, file, project)
    if (!cands.length) continue
    const ranges = callSiteRanges(src)
    const keep: Array<CleanupCandidate> = []
    for (const c of cands) {
      before[c.rule]++
      const row = {attr: c.attr, rule: c.rule, site: `${rel}:${c.line}`}
      const why = coverageGap({baseHunks, mounted, need: c.need, ranges, rel, line: c.line})
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

// ---------------------------------------------------------------- unpin by coverage
//
//   U4  either pin at a call site the coverage base drew, in an unmasked entry, on every platform
//       the site renders on (siteGateNeed), unless the skip list names it
// Unlike U1-U3, U4 is not equivalent by construction: it removes pins the gate can see, and a gate
// run on the result is the proof. A pin whose removal moved pixels goes on the skip list
// (box2-unpin-skips.json) and the pass is redone from HEAD. A site the gate never renders keeps its
// pin. The child must have no spread (it may carry alignSelf, fullWidth or fullHeight), and a
// conditional pin's test must be free of side effects.
//
// A skip entry names a site by file, by its opening tag without the alignSelf attribute (whitespace
// collapsed), and by `nth` (1-based, in source order) when several Box2/ClickableBox tags in the file
// read the same. Neither moves when lines shift or other pins in the file are removed. An entry that
// matches no pin, or matches several without `nth`, fails the run.

export type U4Site = {line: number; start: number; end: number; tag: string; nth: number; need: GateNeed}
export type U4Skip = {rel: string; tag: string; nth?: number; reason: string}
export type U4Result = {sites: Array<U4Site>; unusable: Array<Unresolved>}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

export const u4Candidates = (code: string, filename: string, project?: Project): U4Result => {
  const sites: Array<U4Site> = []
  const unusable: Array<Unresolved> = []
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {plugins: ['jsx', 'typescript'], sourceFilename: filename, sourceType: 'module'})
  } catch (e) {
    return {sites, unusable: [{line: 0, reason: `parse error: ${String(e)}`}]}
  }
  const seen = new Map<string, number>()
  babel.traverse(ast as babel.types.File, {
    JSXOpeningElement(path) {
      if (classifyName(path, filename).kind !== 'target') return
      const node = path.node
      const alignSelf = findAttr(node, 'alignSelf')
      const cut = alignSelf ? removalRange(code, alignSelf) : undefined
      const text = code.slice(node.start ?? 0, node.end ?? 0)
      const off = node.start ?? 0
      const tag = collapse(cut ? text.slice(0, cut.start - off) + text.slice(cut.end - off) : text)
      const nth = (seen.get(tag) ?? 0) + 1
      seen.set(tag, nth)
      if (!alignSelf || !cut || !pinRule(alignSelf)) return
      const line = node.loc?.start.line ?? 0
      const v = alignSelf.value
      const test = t.isJSXExpressionContainer(v) && t.isConditionalExpression(v.expression) ? v.expression.test : undefined
      if (node.attributes.some(a => t.isJSXSpreadAttribute(a))) unusable.push({line, reason: 'child has a spread'})
      else if (test && !pureTest(test)) unusable.push({line, reason: 'conditional pin test may have side effects'})
      else sites.push({line, need: siteGateNeed(path, filename, project), nth, tag, ...cut})
    },
  })
  return {sites: sites.sort((a, b) => a.start - b.start), unusable}
}

export const readU4Skips = (raw: string): Array<U4Skip> => {
  const list = JSON.parse(raw) as unknown
  if (!Array.isArray(list)) throw new Error('the skip list must be a JSON array')
  return list.map((e: unknown, i) => {
    const s = e as Partial<U4Skip>
    if (typeof s.rel !== 'string' || typeof s.tag !== 'string' || typeof s.reason !== 'string' || !s.reason) {
      throw new Error(`skip ${i}: needs rel, tag and reason strings`)
    }
    if (s.nth !== undefined && !(Number.isInteger(s.nth) && s.nth > 0)) throw new Error(`skip ${i}: nth must be a positive integer`)
    return {nth: s.nth, reason: s.reason, rel: s.rel, tag: collapse(s.tag)}
  })
}

// Which of a file's sites the skip list keeps, and the entries for this file that are stale or
// ambiguous.
export const matchU4Skips = (rel: string, sites: ReadonlyArray<U4Site>, skips: ReadonlyArray<U4Skip>) => {
  const kept = new Map<U4Site, U4Skip>()
  const errors: Array<string> = []
  for (const s of skips) {
    if (s.rel !== rel) continue
    const hits = sites.filter(x => x.tag === s.tag && (s.nth === undefined || x.nth === s.nth))
    const name = `${rel} ${s.tag}${s.nth === undefined ? '' : ` (nth ${s.nth})`}`
    if (!hits.length) errors.push(`skip matches no pin: ${name}`)
    else if (hits.length > 1) errors.push(`skip matches ${hits.length} pins, add nth: ${name}`)
    else kept.set(hits[0]!, s)
  }
  return {errors, kept}
}

export const u4SkipsPath = () => join(dirname(fileURLToPath(import.meta.url)), 'box2-unpin-skips.json')

export type U4Plan = {
  base: string
  files: Array<{rel: string; src: string; remove: Array<U4Site>}>
  removed: Array<string>
  kept: Array<{site: string; reason: string}>
  uncovered: Array<{site: string; why: string}>
  unusable: Array<{site: string; reason: string}>
  errors: Array<string>
}

// U4 over the tree at `at`, against the coverage base `base`.
export const planU4 = (root: string, opts: {base: string; at: string; skips: ReadonlyArray<U4Skip>}): U4Plan => {
  const atSha = git(root, ['rev-parse', '--verify', `${opts.at}^{commit}`]).trim()
  const sha = git(root, ['rev-parse', '--verify', `${opts.base}^{commit}`]).trim()
  const mounted = {desktop: platformCoverage(sha, 'desktop'), ios: platformCoverage(sha, 'ios')}
  if (!mounted.desktop.length || !mounted.ios.length) {
    throw new Error(`base ${sha} needs stored coverage for both desktop and iOS`)
  }
  const repoHunks = parseDiffHunks(git(root, ['diff', '--no-ext-diff', '-U0', sha, atSha, '--', '*.tsx']))
  const baseHunks = new Map<string, ReadonlyArray<Hunk>>()
  for (const [p, h] of repoHunks) baseHunks.set(relative('shared', p), h)
  const plan: U4Plan = {base: sha, errors: [], files: [], kept: [], removed: [], uncovered: [], unusable: []}
  const skipFiles = new Set(opts.skips.map(s => s.rel))
  const project = projectAt(root, atSha)
  const tracked = [...project.files.keys()].filter(f => f.endsWith('.tsx')).sort()
  for (const rel of tracked) {
    const src = project.files.get(rel)!
    const r = u4Candidates(src, join(root, rel), project)
    skipFiles.delete(rel)
    plan.unusable.push(...r.unusable.map(u => ({reason: u.reason, site: `${rel}:${u.line}`})))
    const {errors, kept} = matchU4Skips(rel, r.sites, opts.skips)
    plan.errors.push(...errors)
    if (!r.sites.length) continue
    const ranges = callSiteRanges(src)
    const remove: Array<U4Site> = []
    for (const c of r.sites) {
      const site = `${rel}:${c.line}`
      const why = coverageGap({baseHunks, mounted, need: c.need, ranges, rel, line: c.line})
      const skip = kept.get(c)
      if (why) plan.uncovered.push({site, why})
      else if (skip) plan.kept.push({reason: skip.reason, site})
      else {
        plan.removed.push(site)
        remove.push(c)
      }
    }
    if (remove.length) plan.files.push({remove, rel, src})
  }
  for (const rel of skipFiles) plan.errors.push(`skip names a file with no .tsx at ${opts.at}: ${rel}`)
  return plan
}

const runUnpinCoverage = (
  root: string,
  opts: {base: string; at: string; write: boolean; reportFile: string | undefined}
) => {
  if (opts.write) {
    if (git(root, ['rev-parse', '--verify', `${opts.at}^{commit}`]).trim() !== git(root, ['rev-parse', 'HEAD']).trim()) {
      throw new Error('--write needs --at HEAD')
    }
    if (git(root, ['status', '--porcelain', '--', '*.tsx']).trim()) {
      throw new Error('unpin --write reads the tree as HEAD: commit or stash .tsx changes first')
    }
    assertUnpinWritable(readFileSync(join(root, 'common-adapters/box.tsx'), 'utf8'))
  }
  const plan = planU4(root, {at: opts.at, base: opts.base, skips: readU4Skips(readFileSync(u4SkipsPath(), 'utf8'))})
  if (plan.errors.length) throw new Error(`skip list:\n  ${plan.errors.join('\n  ')}`)
  if (opts.write) for (const f of plan.files) writeFileSync(join(root, f.rel), applyCleanup(f.src, f.remove))
  if (opts.reportFile) {
    const {base, errors, kept, removed, uncovered, unusable} = plan
    writeFileSync(opts.reportFile, JSON.stringify({base, errors, kept, removed, uncovered, unusable}, null, 2) + '\n')
  }
  console.log(
    `U4 ${plan.removed.length}${opts.write ? ' (written)' : ' (report only)'}; kept: skip list ${plan.kept.length}, ` +
      `not covered ${plan.uncovered.length}, unusable ${plan.unusable.length} (base ${plan.base.slice(0, 10)})`
  )
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
  const bi = rest.indexOf('--coverage-from')
  const base = bi >= 0 ? rest[bi + 1] : undefined
  const ai = rest.indexOf('--at')
  const at = ai >= 0 ? rest[ai + 1] : 'HEAD'
  if (!at || (bi >= 0 && !base)) {
    console.error(!at ? '--at needs a ref' : '--coverage-from needs a base sha')
    process.exit(2)
  }
  if (mode === 'cleanup') {
    if (!base) {
      console.error('cleanup needs --coverage-from <base sha>')
      process.exit(2)
    }
    runCleanup(root, {at, base, reportFile, write})
    return
  }
  if (mode === 'noop') {
    runNoop(root, {reportFile, write})
    return
  }
  if (mode === 'unpin') {
    if (base) runUnpinCoverage(root, {at, base, reportFile, write})
    else runUnpin(root, {reportFile, write})
    return
  }
  if (mode !== 'pin') {
    console.error(
      'usage: box2-stretch-default.mts pin [--write] [--report <file>]\n' +
        '       box2-stretch-default.mts cleanup --coverage-from <base sha> [--at <ref>] [--write] [--report <file>]\n' +
        '       box2-stretch-default.mts unpin [--coverage-from <base sha> [--at <ref>]] [--write] [--report <file>]\n' +
          '       box2-stretch-default.mts noop [--write] [--report <file>]'
    )
    process.exit(2)
  }
  if (write) assertPinWritable(readFileSync(join(root, 'common-adapters/box.tsx'), 'utf8'))
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
