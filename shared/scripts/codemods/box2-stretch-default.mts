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
// at call sites that the visual gate's coverage base for <base sha> mounted on every platform the
// file renders on (gatePlatforms).
//
//   node scripts/codemods/box2-stretch-default.mts unpin [--write] [--report <file>]
//
// Also once the default is gone, `unpin` removes the pins whose centering the parent already
// provides (rules below). It reads the working tree and needs no coverage: each removal is
// equivalent by construction against the stretch default, so --write refuses a tree that still
// centers by default.
import * as babel from '@babel/core'
import {parse, parseExpression} from '@babel/parser'
import MagicString from 'magic-string'
import {execFileSync} from 'child_process'
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'fs'
import {basename, dirname, join, relative, resolve} from 'path'
import {fileURLToPath} from 'url'
import {
  callSiteRanges,
  parseDiffHunks,
  unmarkedFile,
  unmountedChanged,
  type Hunk,
  type Range,
} from '../../tests/e2e/visual/coverage/changed-sites.mts'
import {basePlatformDir, type CoverageFile, type RunPlatform} from '../../tests/e2e/visual/store.mts'

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

// A style may stand when it provably leaves some keys alone: it resolves, in this file, to object
// literals without them (any platform branch included). A parent style must leave its cross-axis
// layout alone.
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
  // a later duplicate key wins, as in the object at runtime
  let found: babel.types.Node | undefined
  for (const p of body.properties) {
    if (t.isObjectProperty(p) && !p.computed && t.isIdentifier(p.key, {name})) found = p.value
  }
  return found
}

const styleLeaves = (
  scope: babel.NodePath['scope'],
  e: babel.types.Node | null | undefined,
  keys: ReadonlySet<string>,
  depth = 0
): boolean => {
  if (!e || depth > 8) return false
  const recur = (x: babel.types.Node | null | undefined) => styleLeaves(scope, x, keys, depth + 1)
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
      if (key === undefined || keys.has(key)) return false
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

const styleAttrLeaves = (scope: babel.NodePath['scope'], attr: babel.types.JSXAttribute, keys: ReadonlySet<string>) =>
  t.isJSXExpressionContainer(attr.value) &&
  !t.isJSXEmptyExpression(attr.value.expression) &&
  styleLeaves(scope, attr.value.expression, keys)

const isMapCall = (p: babel.NodePath | null) =>
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

export const cleanupCandidates = (code: string, filename: string): Array<CleanupCandidate> => {
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
      if (parentStyle && !styleAttrLeaves(parentPath.scope, parentStyle, crossAxisKeys)) return
      const direction = stringValue(findAttr(parent, 'direction'))
      const line = child.loc?.start.line ?? 0
      const fullWidth = findAttr(child, 'fullWidth')
      const fullHeight = findAttr(child, 'fullHeight')
      const alignSelf = findAttr(child, 'alignSelf')
      const parentFullWidth = isTrue(findAttr(parent, 'fullWidth'))
      const parentFullHeight = isTrue(findAttr(parent, 'fullHeight'))
      if (alignSelf) {
        if (direction === 'vertical' && parentFullWidth && isTrue(fullWidth) && alignSelfLiterals.has(stringValue(alignSelf) ?? '')) {
          out.push({attr: 'alignSelf', line, rule: 'C3', ...removal(alignSelf)})
        }
        return
      }
      const alignItems = findAttr(parent, 'alignItems')
      if ((alignItems && stringValue(alignItems) !== 'stretch') || findAttr(parent, 'centerChildren')) return
      if (direction === 'vertical' && parentFullWidth && fullWidth && isTrue(fullWidth) && !fullHeight) {
        out.push({attr: 'fullWidth', line, rule: 'C1', ...removal(fullWidth)})
      } else if (direction === 'horizontal' && parentFullHeight && fullHeight && isTrue(fullHeight) && !fullWidth) {
        out.push({attr: 'fullHeight', line, rule: 'C2', ...removal(fullHeight)})
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

const alignSelfKeys = new Set(['alignSelf'])

// Whether a style sets a non-empty literal alignSelf on every platform, provably from this file.
// Later entries must leave alignSelf alone. In platformStyles only common and isMobile count as
// setting it on native, since isIOS, isAndroid, isPhone and isTablet apply on some devices only.
const styleSetsAlignSelf = (scope: babel.NodePath['scope'], e: babel.types.Node | null | undefined, depth = 0): boolean => {
  if (!e || depth > 8) return false
  const recur = (x: babel.types.Node | null | undefined) => styleSetsAlignSelf(scope, x, depth + 1)
  const leaves = (x: babel.types.Node | null | undefined) => styleLeaves(scope, x, alignSelfKeys)
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
      const rule: UnpinRule = !childSpread && styleSetsAlignSelf(path.scope, childStyleExpr) ? 'U3' : shape
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
        if (parentStyle && !styleAttrLeaves(parentPath.scope, parentStyle, crossAxisKeys)) {
          return 'parent style may change its cross axis'
        }
        const notCentering = parentNotCentering(parent)
        if (notCentering) return notCentering
        if (childSpread) return 'child has a spread'
        if (findAttr(child, 'className')) return 'child has a className'
        if (childStyle && !styleAttrLeaves(path.scope, childStyle, positionKeys)) return 'child style may set position'
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

// The gate platforms whose tour must have mounted a call site before it is cleaned. A shared file
// renders on both, and an in-file platform branch gets no exemption, so a shared file needs both;
// a platform file only renders on its own platform.
export const gatePlatforms = (rel: string): Array<RunPlatform> =>
  rel.endsWith('.desktop.tsx') ? ['desktop'] : /\.(native|ios|android)\.tsx$/.test(rel) ? ['ios'] : ['desktop', 'ios']

// The gate platforms whose base coverage misses a call site. Coverage ids are base-tree
// `file:line`, carried forward through `hunks` (the base..tree diff of that file).
export const unmountedPlatforms = (opts: {
  rel: string
  range: Range
  hunks: ReadonlyArray<Hunk>
  mounted: Readonly<Record<RunPlatform, ReadonlyArray<string>>>
}): Array<RunPlatform> =>
  gatePlatforms(opts.rel).filter(
    platform =>
      unmountedChanged({
        baseHunks: new Map([[opts.rel, opts.hunks]]),
        changed: new Map([[opts.rel, [opts.range]]]),
        mounted: opts.mounted[platform],
      }).length > 0
  )

// The call sites a platform's base captures mounted. A masked entry counts for nothing: its sites
// may sit under a mask the compare never sees. A bare id list predates the masked flag and may
// come from a masked entry, so it is refused rather than trusted.
export const platformCoverage = (sha: string, platform: RunPlatform) => {
  const out = new Set<string>()
  const walkCoverage = (dir: string) => {
    if (!existsSync(dir)) return
    for (const d of readdirSync(dir, {withFileTypes: true})) {
      const p = join(dir, d.name)
      if (d.isDirectory()) walkCoverage(p)
      else if (basename(dir) === 'coverage' && d.name.endsWith('.json')) {
        const file = JSON.parse(readFileSync(p, 'utf8')) as CoverageFile | Array<string>
        if (Array.isArray(file)) throw new Error(`${p} has no masked flag: retake the coverage base`)
        if (!file.masked) for (const id of file.ids) out.add(id)
      }
    }
  }
  walkCoverage(basePlatformDir(sha, platform))
  return [...out]
}

// Candidates are computed on the tree at `at` (HEAD by default; --write needs HEAD and a clean tree)
// and kept only where every platform from gatePlatforms mounted their call site.
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
  const tracked = git(root, ['ls-tree', '-r', '--name-only', atSha, '--', '.'])
    .split('\n')
    .filter(f => f.endsWith('.tsx') && !f.split('/').some(seg => skipDirs.has(seg)))
    .sort()
  for (const rel of tracked) {
    const file = join(root, rel)
    const src = git(root, ['show', `${atSha}:./${rel}`])
    const cands = cleanupCandidates(src, file)
    if (!cands.length) continue
    const ranges = callSiteRanges(src)
    const keep: Array<CleanupCandidate> = []
    for (const c of cands) {
      before[c.rule]++
      const row = {attr: c.attr, rule: c.rule, site: `${rel}:${c.line}`}
      const range = ranges.find(r => r.start === c.line)
      const missing = range
        ? unmountedPlatforms({hunks: baseHunks.get(rel) ?? [], mounted, range, rel})
        : []
      const why = unmarkedFile(rel)
        ? 'file not marked by coverage'
        : !range
          ? 'call site not marked by coverage'
          : missing.length
            ? `never mounted on ${missing.join(' or ')}`
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
    const ai = rest.indexOf('--at')
    const at = ai >= 0 ? rest[ai + 1] : 'HEAD'
    if (!at) {
      console.error('--at needs a ref')
      process.exit(2)
    }
    runCleanup(root, {at, base, reportFile, write})
    return
  }
  if (mode === 'unpin') {
    runUnpin(root, {reportFile, write})
    return
  }
  if (mode !== 'pin') {
    console.error(
      'usage: box2-stretch-default.mts pin [--write] [--report <file>]\n' +
        '       box2-stretch-default.mts cleanup --coverage-from <base sha> [--at <ref>] [--write] [--report <file>]\n' +
        '       box2-stretch-default.mts unpin [--write] [--report <file>]'
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
