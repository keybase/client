// `classify` reports, for every Box2/ClickableBox with fullWidth or fullHeight, whether the prop can
// take its stretch meaning (alignSelf: 'stretch', winning over an alignSelf prop) without moving
// pixels, and what explicit form keeps the pixels where it cannot. It reads the working tree and
// writes nothing but the report.
//
//   node scripts/codemods/box2-fullwidth-stretch.mts classify [--report <file>]
//
// Today fullWidth is {width: '100%', maxWidth: '100%'} and fullHeight is {height: '100%',
// maxHeight: '100%'}, both before the style prop. Each prop is classified on its own axis against
// every parent the box can render in:
//   SAME     stretch equals 100% there: the axis is the parent's cross axis, the parent's size on it
//            is definite, and the box has no margins, size override, or position on that axis that
//            would tell them apart (or it is absolute with zero insets on both sides of the axis)
//   MAIN     the axis is the parent's main axis (or the parent is a block on the height axis), where
//            100% sets a size and stretch would act on the other axis
//   MARGIN   own margins on the axis: 100% plus a margin overflows, stretch fits inside
//   WIDTH    own size keys on the axis that tell them apart (see sizeClass)
//   ABS      absolute without zero insets on both sides of the axis
//   ALIGNSELF_STYLE  a style alignSelf other than stretch: the style wins over stretch
//   CONTENT  the parent is sized by its content on the axis (Yoga and CSS resolve 100% differently)
//   UNKNOWN  a parent or a style the analysis cannot see, with the reason
// A box is only as safe as its worst parent. A component's root box takes the parents of every
// place the component renders: JSX render sites across shared/ (through imports, re-exports,
// memo/forwardRef/lazy wrappers and the Kb namespace), route screens, and render helpers called
// in place. A box passed as a child or a prop of another component takes the parents of the place
// that component renders that prop.
import * as babel from '@babel/core'
import {parse} from '@babel/parser'
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'fs'
import {dirname, join, relative, resolve} from 'path'
import {fileURLToPath} from 'url'
import {calleeName, findAttr, isMapCall, readAxis, skipDirs, styleSheetEntry} from './box2-stretch-default.mts'

const t = babel.types
type Node = babel.types.Node
type NP<T = Node> = babel.NodePath<T>
type Scope = babel.NodePath['scope']
type Fn = babel.types.Function

// ---------------------------------------------------------------- project and module resolution

export type FileInfo = {abs: string; rel: string; code: string; program: NP<babel.types.Program>}

export type Comp = {key: string; file: FileInfo; fn: NP<Fn>; name: string}
export type Host = 'div' | 'view' | 'scroll' | 'kbscroll' | 'transparent'
export type Target =
  | {kind: 'box'; name: string}
  | {kind: 'comp'; comp: Comp}
  | {kind: 'host'; host: Host}
  | {kind: 'unknown'; reason: string}

// `usage` is the element that instantiates the component this element sits in, when the element
// was reached through that usage; it resolves props the element reads (direction={direction}).
type El = {file: FileInfo; path: NP<babel.types.JSXElement>; usage?: El; subst?: Subst}
type Subst = ReadonlyMap<string, {fn: Node; use: El}>

export type Project = {
  root: string
  files: Map<string, FileInfo>
  renderSites: Map<string, Array<El>>
  valueUses: Map<string, Array<string>>
  screens: Map<string, {modal: boolean}>
  elements: Array<El>
}

const targetNames = new Set(['Box2', 'ClickableBox'])
const transparentReact = new Set(['Fragment', 'Suspense', 'StrictMode', 'Activity', 'Profiler'])
const rnViews = new Set([
  'View',
  'SafeAreaView',
  'KeyboardAvoidingView',
  'Pressable',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
  'TouchableHighlight',
])
// third-party components that lay their children out in a plain View
const externalViews = new Set([
  'react-native-keyboard-controller:KeyboardAvoidingView',
  'react-native-keyboard-controller:KeyboardStickyView',
  'react-native-safe-area-context:SafeAreaProvider',
  'react-native-screens/experimental:SafeAreaView',
])
const viewSources = new Set([
  'react-native',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-gesture-handler',
])

const parseFile = (abs: string, root: string): FileInfo | undefined => {
  const code = readFileSync(abs, 'utf8')
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {
      plugins: abs.endsWith('.tsx') ? ['jsx', 'typescript'] : ['typescript'],
      sourceFilename: abs,
      sourceType: 'module',
    })
  } catch {
    return undefined
  }
  let program: NP<babel.types.Program> | undefined
  babel.traverse(ast as babel.types.File, {
    Program(p) {
      program = p
      p.stop()
    },
  })
  return program && {abs, code, program, rel: relative(root, abs)}
}

const walkSources = (dir: string, out: Array<string>) => {
  for (const ent of readdirSync(dir, {withFileTypes: true})) {
    if (ent.isDirectory()) {
      if (!skipDirs.has(ent.name) && ent.name !== 'results') walkSources(join(dir, ent.name), out)
    } else if (ent.isFile() && /\.tsx?$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
      out.push(join(dir, ent.name))
    }
  }
  return out
}

const platformExts = ['.desktop', '.native', '.ios', '.android']

const resolveModule = (proj: Project, from: FileInfo, source: string): Array<FileInfo> => {
  const base = source.startsWith('@/')
    ? join(proj.root, source.slice(2))
    : source.startsWith('.')
      ? resolve(dirname(from.abs), source)
      : undefined
  if (!base) return []
  // the bundlers pick foo.native.tsx over foo.tsx on native, so every variant can render
  const pick = (stem: string) => {
    const exact = /\.tsx?$/.test(stem) ? proj.files.get(stem) : undefined
    if (exact) return [exact]
    const plain = ['.tsx', '.ts'].map(e => proj.files.get(stem + e)).find(f => !!f)
    const variants = platformExts.flatMap(p => ['.tsx', '.ts'].map(e => proj.files.get(stem + p + e)))
    return [plain, ...variants].filter((f): f is FileInfo => !!f)
  }
  const direct = pick(base)
  return direct.length ? direct : pick(join(base, 'index'))
}

const isTypePosition = (p: NP) => {
  let q: NP | null = p.parentPath
  while (q) {
    if (q.isTSType() || q.isTSTypeAnnotation() || q.isTSTypeQuery() || q.isTSTypeReference()) return true
    if (q.isStatement() || q.isFunction()) return false
    q = q.parentPath
  }
  return false
}

const fnName = (fn: NP<Fn>): string => {
  if (t.isFunctionDeclaration(fn.node) && fn.node.id) return fn.node.id.name
  let p: NP = fn.parentPath
  while (p.isCallExpression() || p.isTSAsExpression() || p.isParenthesizedExpression()) p = p.parentPath
  if (p.isVariableDeclarator() && t.isIdentifier(p.node.id)) return p.node.id.name
  if (p.isObjectProperty() && t.isIdentifier(p.node.key)) return p.node.key.name
  if (p.isExportDefaultDeclaration()) return 'default'
  return `<anonymous:${fn.node.loc?.start.line ?? 0}>`
}

const compOf = (file: FileInfo, fn: NP<Fn>): Comp => ({
  file,
  fn,
  key: `${file.rel}:${fn.node.start ?? 0}`,
  name: fnName(fn),
})

const unknown = (reason: string): Array<Target> => [{kind: 'unknown', reason}]

const resolveExport = (proj: Project, files: ReadonlyArray<FileInfo>, name: string, depth: number): Array<Target> => {
  if (!files.length) return unknown(`no module for export ${name}`)
  return files.flatMap(f => resolveExportIn(proj, f, name, depth))
}

const resolveExportIn = (proj: Project, file: FileInfo, name: string, depth: number): Array<Target> => {
  if (depth > 12) return unknown('export chain too deep')
  if (file.rel === 'common-adapters/box.tsx' && targetNames.has(name)) return [{kind: 'box', name}]
  if (file.rel === 'common-adapters/scroll-view.tsx' && name === 'default') return [{kind: 'host', host: 'kbscroll'}]
  const body = file.program.get('body')
  const stars: Array<string> = []
  for (const s of body) {
    if (s.isExportNamedDeclaration()) {
      const decl = s.get('declaration')
      if (decl.isFunctionDeclaration() && decl.node.id?.name === name) return [{comp: compOf(file, decl), kind: 'comp'}]
      if (decl.isVariableDeclaration()) {
        for (const d of decl.get('declarations')) {
          if (t.isIdentifier(d.node.id, {name})) {
            const init = d.get('init')
            return init.node ? resolveExpr(proj, file, init as NP, depth + 1) : unknown(`${name} has no initializer`)
          }
        }
      }
      for (const sp of s.get('specifiers')) {
        if (!sp.isExportSpecifier()) continue
        const exported = t.isIdentifier(sp.node.exported) ? sp.node.exported.name : sp.node.exported.value
        if (exported !== name) continue
        const local = sp.node.local.name
        if (s.node.source) return resolveExport(proj, resolveModule(proj, file, s.node.source.value), local, depth + 1)
        return resolveIdent(proj, file, s.scope, local, depth + 1)
      }
    } else if (s.isExportDefaultDeclaration() && name === 'default') {
      const decl = s.get('declaration')
      if (decl.isFunctionDeclaration() || decl.isArrowFunctionExpression() || decl.isFunctionExpression()) {
        return [{comp: compOf(file, decl as NP<Fn>), kind: 'comp'}]
      }
      if (decl.isIdentifier()) return resolveIdent(proj, file, s.scope, decl.node.name, depth + 1)
      if (decl.isExpression()) return resolveExpr(proj, file, decl, depth + 1)
      return unknown(`default export of ${file.rel} is a ${decl.node.type}`)
    } else if (s.isExportAllDeclaration()) {
      stars.push(s.node.source.value)
    }
  }
  for (const src of stars) {
    const files = resolveModule(proj, file, src)
    const r = files.flatMap(f => resolveExportIn(proj, f, name, depth + 1))
    if (r.length && r.every(x => x.kind !== 'unknown')) return r
  }
  return unknown(`no export ${name} in ${file.rel}`)
}

const externalTarget = (source: string, imported: string): Array<Target> => {
  if (source === 'react' && transparentReact.has(imported)) return [{host: 'transparent', kind: 'host'}]
  if (viewSources.has(source) && rnViews.has(imported)) return [{host: 'view', kind: 'host'}]
  if (source === 'react-native' && imported === 'ScrollView') return [{host: 'scroll', kind: 'host'}]
  if (externalViews.has(`${source}:${imported}`)) return [{host: 'view', kind: 'host'}]
  return unknown(`external component ${imported} from ${source}`)
}

const resolveIdent = (proj: Project, file: FileInfo, scope: Scope, name: string, depth: number): Array<Target> => {
  const binding = scope.getBinding(name)
  if (!binding) return unknown(`global ${name}`)
  const bp = binding.path
  if (bp.isImportSpecifier() || bp.isImportDefaultSpecifier() || bp.isImportNamespaceSpecifier()) {
    const decl = bp.parentPath as NP<babel.types.ImportDeclaration>
    const source = decl.node.source.value
    if (bp.isImportNamespaceSpecifier()) return unknown(`namespace ${name} used as a component`)
    const imported = bp.isImportDefaultSpecifier()
      ? 'default'
      : t.isIdentifier((bp.node as babel.types.ImportSpecifier).imported)
        ? ((bp.node as babel.types.ImportSpecifier).imported as babel.types.Identifier).name
        : ((bp.node as babel.types.ImportSpecifier).imported as babel.types.StringLiteral).value
    const files = resolveModule(proj, file, source)
    if (!files.length) return externalTarget(source, imported)
    return resolveExport(proj, files, imported, depth + 1)
  }
  if (bp.isFunctionDeclaration()) return [{comp: compOf(file, bp), kind: 'comp'}]
  if (bp.isVariableDeclarator()) {
    const raw = bp.node.init
    const imported = t.isAwaitExpression(raw) ? raw.argument : undefined
    if (t.isObjectPattern(bp.node.id) && t.isCallExpression(imported) && t.isImport(imported.callee) && t.isStringLiteral(imported.arguments[0])) {
      const prop = bp.node.id.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.value, {name}))
      if (prop && t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        return resolveExport(proj, resolveModule(proj, file, imported.arguments[0].value), prop.key.name, depth + 1)
      }
    }
    if (!t.isIdentifier(bp.node.id)) return unknown(`${name} is destructured`)
    const init = bp.get('init')
    if (!init.node) return unknown(`${name} has no initializer`)
    if (binding.constantViolations.length) return unknown(`${name} is reassigned`)
    return resolveExpr(proj, file, init as NP, depth + 1)
  }
  if (bp.isClassDeclaration()) return unknown(`${name} is a class component`)
  return unknown(`${name} is a ${binding.kind}`)
}

const resolveMember = (proj: Project, file: FileInfo, scope: Scope, obj: string, prop: string, depth: number) => {
  if (obj === 'React' && transparentReact.has(prop)) return [{host: 'transparent', kind: 'host'} as const]
  if (prop === 'Provider') return [{host: 'transparent', kind: 'host'} as const]
  const binding = scope.getBinding(obj)
  const bp = binding?.path
  if (bp?.isImportNamespaceSpecifier() || bp?.isImportDefaultSpecifier()) {
    const source = (bp.parentPath.node as babel.types.ImportDeclaration).source.value
    const files = resolveModule(proj, file, source)
    if (!files.length) return externalTarget(source, prop)
    if (bp.isImportDefaultSpecifier()) return unknown(`member ${obj}.${prop} of a default import`)
    return resolveExport(proj, files, prop, depth + 1)
  }
  if (bp?.isImportSpecifier()) {
    const source = (bp.parentPath.node as babel.types.ImportDeclaration).source.value
    if (!resolveModule(proj, file, source).length) return externalTarget(source, prop)
  }
  // `const Kb = {Box2, Text}` in common-adapters
  if (bp?.isVariableDeclarator() && t.isObjectExpression(bp.node.init) && binding?.constant) {
    for (const p of (bp.get('init') as NP<babel.types.ObjectExpression>).get('properties')) {
      if (!p.isObjectProperty() || p.node.computed || !t.isIdentifier(p.node.key, {name: prop})) continue
      return resolveExpr(proj, file, p.get('value') as NP, depth + 1)
    }
  }
  return unknown(`member ${obj}.${prop}`)
}

const resolveLazy = (proj: Project, file: FileInfo, call: NP<babel.types.CallExpression>, depth: number) => {
  const fn = call.get('arguments')[0]
  if (!fn || !(fn.isArrowFunctionExpression() || fn.isFunctionExpression())) return unknown('lazy without a loader')
  const importOf = (e: Node | null | undefined) => {
    const x = t.isAwaitExpression(e) ? e.argument : e
    return t.isCallExpression(x) && t.isImport(x.callee) && t.isStringLiteral(x.arguments[0])
      ? x.arguments[0].value
      : undefined
  }
  const body = (fn as NP<babel.types.ArrowFunctionExpression>).get('body')
  const direct = importOf(body.node)
  if (direct) return resolveExport(proj, resolveModule(proj, file, direct), 'default', depth + 1)
  if (!body.isBlockStatement()) return unknown('lazy loader shape')
  for (const s of body.get('body')) {
    if (!s.isReturnStatement()) continue
    const arg = s.get('argument')
    const imp = importOf(arg.node)
    if (imp) return resolveExport(proj, resolveModule(proj, file, imp), 'default', depth + 1)
    if (!arg.isObjectExpression()) return unknown('lazy loader return shape')
    for (const prop of arg.get('properties')) {
      if (!prop.isObjectProperty() || !t.isIdentifier(prop.node.key, {name: 'default'})) continue
      // `const {Other} = await import('./other')` resolves in resolveIdent
      return resolveExpr(proj, file, prop.get('value') as NP, depth + 1)
    }
  }
  return unknown('lazy loader without a default')
}

const wrapperCalls = new Set(['memo', 'forwardRef', 'createAnimatedComponent'])

const resolveExpr = (proj: Project, file: FileInfo, e: NP, depth: number): Array<Target> => {
  if (depth > 16) return unknown('alias chain too deep')
  if (e.isArrowFunctionExpression() || e.isFunctionExpression()) return [{comp: compOf(file, e as NP<Fn>), kind: 'comp'}]
  if (e.isIdentifier()) return resolveIdent(proj, file, e.scope, e.node.name, depth)
  if (e.isMemberExpression() && t.isIdentifier(e.node.object) && t.isIdentifier(e.node.property) && !e.node.computed) {
    return resolveMember(proj, file, e.scope, e.node.object.name, e.node.property.name, depth)
  }
  if (e.isTSAsExpression() || e.isTSSatisfiesExpression() || e.isParenthesizedExpression() || e.isTSNonNullExpression()) {
    return resolveExpr(proj, file, e.get('expression') as NP, depth)
  }
  if (e.isConditionalExpression()) {
    return [...resolveExpr(proj, file, e.get('consequent'), depth), ...resolveExpr(proj, file, e.get('alternate'), depth)]
  }
  if (e.isCallExpression()) {
    const name = calleeName(e.node.callee)
    if (name === 'lazy') return resolveLazy(proj, file, e, depth)
    // React 19 renders a context as its provider
    if (name === 'createContext') return [{host: 'transparent', kind: 'host'}]
    const arg = e.get('arguments')[0]
    if (wrapperCalls.has(name) && arg) return resolveExpr(proj, file, arg as NP, depth)
    return unknown(`component made by ${name || 'a call'}()`)
  }
  return unknown(`component expression ${e.node.type}`)
}

const elementTargetCache = new WeakMap<Node, Array<Target>>()

export const resolveElement = (proj: Project, el: El): Array<Target> => {
  const cached = elementTargetCache.get(el.path.node)
  if (cached) return cached
  const opening = el.path.get('openingElement')
  const name = opening.node.name
  let r: Array<Target>
  if (t.isJSXIdentifier(name)) {
    r = /^[a-z]/.test(name.name)
      ? name.name === 'div'
        ? [{host: 'div', kind: 'host'}]
        : unknown(`<${name.name}>`)
      : resolveIdent(proj, el.file, opening.scope, name.name, 0)
  } else if (t.isJSXMemberExpression(name) && t.isJSXIdentifier(name.object)) {
    r = resolveMember(proj, el.file, opening.scope, name.object.name, name.property.name, 0)
  } else {
    r = unknown('element name shape')
  }
  elementTargetCache.set(el.path.node, r)
  return r
}

const screenCalls = new Set(['makeScreen', 'makeChatScreen'])

const inModalMap = (p: NP) => {
  let q: NP | null = p.parentPath
  while (q) {
    if (q.isVariableDeclarator() && t.isIdentifier(q.node.id) && /modal/i.test(q.node.id.name)) return true
    q = q.parentPath
  }
  return false
}

export const loadProject = (root: string, only?: ReadonlyArray<string>): Project => {
  const proj: Project = {
    elements: [],
    files: new Map(),
    renderSites: new Map(),
    root,
    screens: new Map(),
    valueUses: new Map(),
  }
  for (const abs of only ?? walkSources(root, []).sort()) {
    const f = parseFile(abs, root)
    if (f) {
      proj.files.set(abs, f)
      fileOfProgram.set(f.program.node, f)
    }
  }
  activeProject = proj
  const markScreen = (file: FileInfo, e: NP, at: NP) => {
    for (const x of resolveExpr(proj, file, e, 0)) {
      if (x.kind !== 'comp') continue
      const prev = proj.screens.get(x.comp.key)
      proj.screens.set(x.comp.key, {modal: (prev?.modal ?? false) || inModalMap(at)})
    }
  }
  for (const file of proj.files.values()) {
    if (/\.test\.tsx?$/.test(file.rel)) continue
    // a story renders components in a harness, not where the app does
    const harness = file.rel.endsWith('.stories.tsx')
    file.program.traverse({
      CallExpression(p) {
        const arg = p.get('arguments')[0]
        if (screenCalls.has(calleeName(p.node.callee)) && arg?.isExpression()) markScreen(file, arg, p)
      },
      Identifier(p) {
        if (harness || !/^[A-Z]/.test(p.node.name) || !p.isReferencedIdentifier() || isTypePosition(p)) return
        const parent = p.parentPath
        if (parent.isExportSpecifier() || parent.isExportDefaultDeclaration()) return
        if (parent.isCallExpression() && p.listKey === 'arguments') {
          const n = calleeName(parent.node.callee)
          if (wrapperCalls.has(n) || screenCalls.has(n)) return
        }
        if (parent.isCallExpression() && p.key === 'callee') return
        if (parent.isVariableDeclarator() && p.key === 'init') return
        if (parent.isMemberExpression() && p.key === 'object') return
        if (parent.isConditionalExpression() && p.key !== 'test' && parent.parentPath.isVariableDeclarator()) return
        if (parent.isObjectProperty() && p.key === 'value' && t.isIdentifier(parent.node.key, {name: 'screen'})) return
        const binding = p.scope.getBinding(p.node.name)
        if (!binding) return
        const bp = binding.path
        const compish =
          bp.isFunctionDeclaration() ||
          bp.isImportSpecifier() ||
          bp.isImportDefaultSpecifier() ||
          (bp.isVariableDeclarator() &&
            (t.isArrowFunctionExpression(bp.node.init) ||
              t.isFunctionExpression(bp.node.init) ||
              (t.isCallExpression(bp.node.init) && wrapperCalls.has(calleeName(bp.node.init.callee)))))
        if (!compish) return
        // `!!Foo`, `typeof Foo`, `Foo === x` do not render it
        if (parent.isUnaryExpression() || parent.isBinaryExpression()) return
        const where = `${file.rel}:${p.node.loc?.start.line ?? 0}`
        for (const x of resolveIdent(proj, file, p.scope, p.node.name, 0)) {
          if (x.kind !== 'comp') continue
          const list = proj.valueUses.get(x.comp.key) ?? []
          list.push(where)
          proj.valueUses.set(x.comp.key, list)
        }
      },
      JSXElement(p) {
        const el = {file, path: p}
        proj.elements.push(el)
        if (harness) return
        for (const x of resolveElement(proj, el)) {
          if (x.kind !== 'comp') continue
          const list = proj.renderSites.get(x.comp.key) ?? []
          list.push(el)
          proj.renderSites.set(x.comp.key, list)
        }
      },
      ObjectProperty(p) {
        if (!t.isIdentifier(p.node.key, {name: 'screen'}) || p.node.computed) return
        const v = p.get('value')
        if (v.isExpression()) markScreen(file, v, p)
      },
    })
  }
  return proj
}

// ---------------------------------------------------------------- class names

// For each CSS class, the properties rules whose subject it is may set ('>' marks a rule on its
// children). Nested rules (&.x) count for the classes they name. Coarse on purpose: a class only
// passes when none of the properties a check cares about appear.
export const loadCss = (root: string): Map<string, Set<string>> => {
  const out = new Map<string, Set<string>>()
  const files: Array<string> = []
  const walkCss = (dir: string) => {
    for (const ent of readdirSync(dir, {withFileTypes: true})) {
      if (ent.isDirectory()) {
        if (!skipDirs.has(ent.name) && !['results', 'coverage-ts', 'dist'].includes(ent.name)) walkCss(join(dir, ent.name))
      } else if (ent.name.endsWith('.css')) files.push(join(dir, ent.name))
    }
  }
  walkCss(root)
  for (const f of files) addCss(out, readFileSync(f, 'utf8'))
  return out
}

export const addCss = (out: Map<string, Set<string>>, css: string) => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const stack: Array<Array<string>> = []
  let buf = ''
  const subjects = (selector: string): Array<string> =>
    selector.split(',').flatMap(part => {
      const compounds = part.trim().split(/\s*[\s>+~]\s*/).filter(Boolean)
      const last = compounds[compounds.length - 1] ?? ''
      const classes = [...last.matchAll(/\.([\w-]+)/g)].map(m => m[1]!)
      if (classes.length) return classes
      // `.a > *`: the rule styles the children of .a
      return [...part.matchAll(/\.([\w-]+)/g)].map(m => `>${m[1]!}`)
    })
  for (const ch of text) {
    if (ch === '{') {
      stack.push(subjects(buf))
      buf = ''
    } else if (ch === '}' || ch === ';') {
      const decl = buf.trim()
      const m = /^([\w-]+)\s*:/.exec(decl)
      if (m && stack.length) {
        for (const level of stack) {
          for (const c of level) {
            const set = out.get(c) ?? new Set<string>()
            set.add(m[1]!)
            out.set(c, set)
          }
        }
      }
      buf = ''
      if (ch === '}') stack.pop()
    } else buf += ch
  }
}

// The static class names a className expression can produce, or undefined when one is dynamic.
const classNamesOf = (e: Node | null | undefined): Array<string> | undefined => {
  if (!e) return []
  if (t.isStringLiteral(e)) return e.value.split(/\s+/).filter(Boolean)
  if (t.isJSXExpressionContainer(e)) return t.isJSXEmptyExpression(e.expression) ? [] : classNamesOf(e.expression)
  if (t.isTemplateLiteral(e)) return e.expressions.length ? undefined : classNamesOf(t.stringLiteral(e.quasis[0]?.value.cooked ?? ''))
  if (t.isConditionalExpression(e)) {
    const a = classNamesOf(e.consequent)
    const b = classNamesOf(e.alternate)
    return a && b ? [...a, ...b] : undefined
  }
  if (t.isLogicalExpression(e)) {
    const r = classNamesOf(e.right)
    if (e.operator === '&&') return r
    const l = classNamesOf(e.left)
    return l && r ? [...l, ...r] : undefined
  }
  if (t.isNullLiteral(e) || t.isBooleanLiteral(e) || t.isIdentifier(e, {name: 'undefined'})) return []
  if (t.isCallExpression(e) && calleeName(e.callee) === 'classNames') {
    const out: Array<string> = []
    for (const a of e.arguments) {
      if (t.isObjectExpression(a)) {
        for (const p of a.properties) {
          if (!t.isObjectProperty(p) || p.computed) return undefined
          if (t.isIdentifier(p.key)) out.push(p.key.name)
          else if (t.isStringLiteral(p.key)) out.push(p.key.value)
          else return undefined
        }
      } else {
        const r = classNamesOf(a)
        if (!r) return undefined
        out.push(...r)
      }
    }
    return out
  }
  return undefined
}

let cssIndex: Map<string, Set<string>> | undefined
export const setCssIndex = (m: Map<string, Set<string>>) => {
  cssIndex = m
}

// Why the element's className may set one of `props` on itself (or, with children, on its
// children); undefined when it provably does not.
const classSets = (el: El, props: ReadonlyArray<string>, children = false): string | undefined => {
  const attr = findAttr(el.path.node.openingElement, 'className')
  if (!attr) return undefined
  const names = classNamesOf(attr.value)
  if (!names) return `dynamic className at ${lineOf(el.file, el.path.node)}`
  for (const n of names) {
    for (const key of children ? [n, `>${n}`] : [n]) {
      const set = cssIndex?.get(key)
      const hit = set && props.find(p => set.has(p))
      if (hit) return `className ${n} sets ${hit} at ${lineOf(el.file, el.path.node)}`
    }
  }
  return undefined
}
const layoutProps = ['display', 'flex-direction', 'align-items', 'flex-wrap']
const sizeProps = (a: 'w' | 'h') =>
  a === 'w' ? ['width', 'min-width', 'max-width', 'flex', 'flex-grow'] : ['height', 'min-height', 'max-height', 'flex', 'flex-grow']
const ownProps = [
  'position', 'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'margin-inline', 'margin-block',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'align-self', 'inset', 'left', 'right', 'top', 'bottom',
]

// ---------------------------------------------------------------- styles

export type StyleKey = {vals: Array<string>; cond: boolean}
export type StyleInfo = {
  keys: Map<string, StyleKey>
  unresolved: Array<string>
  entries: Array<string>
}

const platformKeys = new Set(['common', 'isAndroid', 'isElectron', 'isIOS', 'isMobile', 'isPhone', 'isTablet'])

const knownGlobal: {[k: string]: {[k: string]: string} | undefined} = {
  fillAbsolute: {inset: '0', position: 'absolute'},
  flexBoxCenter: {alignItems: 'center', display: 'flex', justifyContent: 'center'},
  flexBoxColumn: {display: 'flex', flexDirection: 'column'},
  flexBoxColumnReverse: {display: 'flex', flexDirection: 'column-reverse'},
  flexBoxRow: {display: 'flex', flexDirection: 'row'},
  flexBoxRowReverse: {display: 'flex', flexDirection: 'row-reverse'},
  flexGrow: {flexGrow: '1'},
  flexOne: {flex: '1'},
  flexWrap: {flexWrap: 'wrap'},
  fullHeight: {height: '100%'},
  fullWidth: {width: '100%'},
  opacity0: {opacity: '0'},
  positionRelative: {position: 'relative'},
  rounded: {borderRadius: '3'},
}
const helperKeys: {[k: string]: Array<string> | undefined} = {
  border: ['borderColor', 'borderStyle', 'borderWidth', 'borderRadius'],
  bottomDivider: ['borderBottomColor', 'borderBottomWidth', 'borderStyle', 'minHeight'],
  centered: ['alignItems', 'justifyContent'],
  marginH: ['marginLeft', 'marginRight'],
  marginV: ['marginTop', 'marginBottom'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  paddingH: ['paddingLeft', 'paddingRight'],
  paddingV: ['paddingTop', 'paddingBottom'],
  roundedBottom: ['borderBottomLeftRadius', 'borderBottomRightRadius', 'overflow'],
  size: ['width', 'height'],
  textEllipsis: ['overflow', 'textOverflow', 'whiteSpace'],
  topDivider: ['borderStyle', 'borderTopColor', 'borderTopWidth', 'minHeight'],
  transition: ['transition'],
}
const noLayoutDesktop = new Set(['boxShadow', 'clickable', 'noSelect', 'windowDragging', 'windowDraggingClickable'])

// a literal's value, or the source text for anything else
const valueText = (code: string, e: Node) => {
  if (t.isStringLiteral(e)) return e.value
  if (t.isNumericLiteral(e)) return String(e.value)
  if (t.isUnaryExpression(e, {operator: '-'}) && t.isNumericLiteral(e.argument)) return String(-e.argument.value)
  return `{${code.slice(e.start ?? 0, e.end ?? 0)}}`
}

const globalMember = (e: Node) =>
  t.isMemberExpression(e) &&
  !e.computed &&
  t.isIdentifier(e.property) &&
  ((t.isMemberExpression(e.object) && t.isIdentifier(e.object.property, {name: 'globalStyles'})) ||
    t.isIdentifier(e.object, {name: 'globalStyles'}))
    ? e.property.name
    : undefined

const desktopMember = (scope: Scope, e: Node) =>
  t.isMemberExpression(e) &&
  !e.computed &&
  t.isIdentifier(e.property) &&
  ((t.isMemberExpression(e.object) && t.isIdentifier(e.object.property, {name: 'desktopStyles'})) ||
    (t.isIdentifier(e.object, {name: 'desktopStyles'}) && !scope.getBinding('desktopStyles')?.path.isVariableDeclarator()))
    ? e.property.name
    : undefined

// Resolves a style expression that reads a prop of the enclosing component: the style the usage
// passes, 'absent' when it passes none, undefined when it cannot tell.
type PropStyle = (scope: Scope, n: Node) => StyleInfo | 'absent' | undefined

// styleSheetEntry, plus a style function with a block body that returns the sheet
const sheetEntry = (scope: Scope, e: babel.types.MemberExpression): Node | undefined => {
  const hit = styleSheetEntry(scope, e)
  if (hit || !t.isIdentifier(e.object) || e.computed || !t.isIdentifier(e.property)) return hit
  const init = (name: string) => {
    const decl = scope.getBinding(name)?.path.node
    return t.isVariableDeclarator(decl) && t.isCallExpression(decl.init) ? decl.init : undefined
  }
  let sheet = init(e.object.name)
  if (sheet && t.isIdentifier(sheet.callee) && !sheet.arguments.length) sheet = init(sheet.callee.name)
  if (!sheet || !['createStyleHook', 'styleSheetCreate'].includes(calleeName(sheet.callee))) return undefined
  const fn = sheet.arguments[0]
  if (!(t.isArrowFunctionExpression(fn) || t.isFunctionExpression(fn)) || !t.isBlockStatement(fn.body)) return undefined
  const ret = fn.body.body.find(x => t.isReturnStatement(x)) as babel.types.ReturnStatement | undefined
  let obj = ret?.argument
  while (t.isTSAsExpression(obj) || t.isTSSatisfiesExpression(obj)) obj = obj.expression
  // `const _styles = {...}; return {..._styles, ...}`
  const body = fn.body.body
  const local = (name: string): Node | undefined => {
    let init: Node | null | undefined
    for (const st of body) {
      if (!t.isVariableDeclaration(st)) continue
      for (const d of st.declarations) if (t.isIdentifier(d.id, {name})) init = d.init
    }
    while (t.isTSAsExpression(init) || t.isTSSatisfiesExpression(init)) init = init.expression
    return init ?? undefined
  }
  const key = e.property.name
  const find = (o: Node | undefined, depth: number): Node | undefined => {
    if (t.isIdentifier(o) && depth < 4) return find(local(o.name), depth + 1)
    if (!t.isObjectExpression(o)) return undefined
    // a later key or spread wins, as in the object at runtime
    let found: Node | undefined
    for (const p of o.properties) {
      if (t.isObjectProperty(p) && !p.computed && t.isIdentifier(p.key, {name: key})) found = p.value
      else if (t.isSpreadElement(p)) found = find(p.argument, depth + 1) ?? found
    }
    return found
  }
  return find(obj ?? undefined, 0)
}

let activeProject: Project | undefined
const fileOfProgram = new WeakMap<Node, FileInfo>()

// An exported const another module defines: `Crypto.outputDesktopMaxHeight`, or an imported name.
const importedConst = (scope: Scope, n: Node): {code: string; node: Node; scope: Scope} | undefined => {
  const proj = activeProject
  if (!proj) return undefined
  let local: string
  let exported: string
  if (t.isIdentifier(n)) {
    local = n.name
    exported = ''
  } else if (t.isMemberExpression(n) && !n.computed && t.isIdentifier(n.object) && t.isIdentifier(n.property)) {
    local = n.object.name
    exported = n.property.name
  } else return undefined
  const bp = scope.getBinding(local)?.path
  if (!bp || !(bp.isImportSpecifier() || bp.isImportNamespaceSpecifier())) return undefined
  if (bp.isImportSpecifier()) {
    if (exported) return undefined
    exported = t.isIdentifier(bp.node.imported) ? bp.node.imported.name : bp.node.imported.value
  } else if (!exported) return undefined
  const decl = bp.parentPath as NP<babel.types.ImportDeclaration>
  const program = decl.findParent(x => x.isProgram())?.node
  const from = program && fileOfProgram.get(program)
  if (!from) return undefined
  for (const file of resolveModule(proj, from, decl.node.source.value)) {
    for (const st of file.program.get('body')) {
      if (!st.isExportNamedDeclaration()) continue
      const d = st.get('declaration')
      if (!d.isVariableDeclaration()) continue
      for (const v of d.get('declarations')) {
        if (t.isIdentifier(v.node.id, {name: exported}) && v.node.init && d.node.kind === 'const') {
          return {code: file.code, node: v.node.init, scope: v.scope}
        }
      }
    }
  }
  return undefined
}

export const evalStyle = (code: string, scope: Scope, e: Node | null | undefined, prop?: PropStyle): StyleInfo => {
  const out: StyleInfo = {entries: [], keys: new Map(), unresolved: []}
  const add = (k: string, v: string, cond: boolean) => {
    const prev = out.keys.get(k)
    if (prev) {
      prev.vals.push(v)
      prev.cond = prev.cond && cond
    } else out.keys.set(k, {cond, vals: [v]})
  }
  const src = (n: Node) => code.slice(n.start ?? 0, n.end ?? 0).slice(0, 60)
  const visit = (n: Node | null | undefined, cond: boolean, sc: Scope, depth: number): void => {
    if (!n || depth > 10) return
    // not t.isIdentifier(n, {name}): its type guard would drop every Identifier below
    if (t.isNullLiteral(n) || t.isBooleanLiteral(n) || (n.type === 'Identifier' && n.name === 'undefined')) return
    if (t.isTSAsExpression(n) || t.isTSSatisfiesExpression(n) || t.isParenthesizedExpression(n) || t.isTSNonNullExpression(n)) {
      return visit(n.expression, cond, sc, depth + 1)
    }
    if (t.isConditionalExpression(n)) {
      visit(n.consequent, true, sc, depth + 1)
      return visit(n.alternate, true, sc, depth + 1)
    }
    if (t.isLogicalExpression(n)) {
      if (n.operator !== '&&') visit(n.left, true, sc, depth + 1)
      return visit(n.right, true, sc, depth + 1)
    }
    if (t.isArrayExpression(n)) {
      for (const x of n.elements) visit(x, cond, sc, depth + 1)
      return
    }
    if (t.isObjectExpression(n)) {
      for (const p of n.properties) {
        if (t.isSpreadElement(p)) {
          visit(p.argument, cond, sc, depth + 1)
          continue
        }
        if (!t.isObjectProperty(p) || p.computed) {
          out.unresolved.push('computed style key')
          continue
        }
        const key = t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : undefined
        if (key === undefined) continue
        if (platformKeys.has(key)) visit(p.value, cond || key !== 'common', sc, depth + 1)
        else add(key, valueText(code, p.value), cond)
      }
      return
    }
    const g = globalMember(n)
    if (g !== undefined) {
      const known = knownGlobal[g]
      if (known) for (const [k, v] of Object.entries(known)) add(k, v, cond)
      else if (!g.startsWith('font')) out.unresolved.push(`globalStyles.${g}`)
      return
    }
    const d = desktopMember(sc, n)
    if (d !== undefined) {
      if (d === 'scrollable') add('overflowY', 'auto', true)
      else if (!noLayoutDesktop.has(d)) out.unresolved.push(`desktopStyles.${d}`)
      return
    }
    if (t.isCallExpression(n)) {
      const name = calleeName(n.callee)
      if (name === 'collapseStyles' || name === 'collapseStylesDesktop' || name === 'platformStyles') {
        for (const a of n.arguments) visit(a, cond, sc, depth + 1)
        return
      }
      const keys = helperKeys[name]
      if (keys) {
        // size('100%') and size(20) have a literal value; other helpers keep their source
        const arg = n.arguments[0]
        const v = name === 'size' && arg && (t.isStringLiteral(arg) || t.isNumericLiteral(arg)) ? valueText(code, arg) : `{${src(n)}}`
        for (const k of keys) add(k, v, cond || name === 'bottomDivider' || name === 'border')
        return
      }
      out.unresolved.push(src(n))
      return
    }
    const fromProp = (t.isIdentifier(n) || t.isMemberExpression(n)) && prop ? prop(sc, n) : undefined
    if (fromProp === 'absent') return
    if (fromProp) {
      for (const [k, v] of fromProp.keys) for (const x of v.vals) add(k, x, cond || v.cond)
      out.unresolved.push(...fromProp.unresolved)
      out.entries.push(...fromProp.entries)
      return
    }
    const imp = importedConst(sc, n)
    if (imp) {
      const saved = code
      code = imp.code
      visit(imp.node, cond, imp.scope, depth + 1)
      code = saved
      return
    }
    if (t.isMemberExpression(n)) {
      const entry = sheetEntry(sc, n)
      if (entry) {
        if (t.isIdentifier(n.property)) out.entries.push(n.property.name)
        return visit(entry, cond, sc, depth + 1)
      }
      out.unresolved.push(src(n))
      return
    }
    if (t.isIdentifier(n)) {
      const b = sc.getBinding(n.name)
      if (b?.path.isVariableDeclarator() && t.isIdentifier(b.path.node.id) && b.constant && b.path.node.init) {
        return visit(b.path.node.init, cond, b.path.scope, depth + 1)
      }
      out.unresolved.push(n.name)
      return
    }
    out.unresolved.push(src(n))
  }
  visit(e, false, scope, 0)
  return out
}

// The prop of the enclosing component an expression reads: `p.x`, a destructured `x` (from the
// first parameter or from `const {x} = p`), with its default.
const propKey = (scope: Scope, e: Node): {key: string; dflt?: Node} | undefined => {
  const firstParamObject = (name: string) => {
    const b = scope.getBinding(name)
    if (b?.kind !== 'param') return false
    if (b.path.isIdentifier()) return b.path.key === 0
    // `...rest` of a destructured first parameter
    return b.path.isObjectPattern() && b.path.key === 0 && b.path.node.properties.some(
      p => t.isRestElement(p) && t.isIdentifier(p.argument, {name})
    )
  }
  if (t.isMemberExpression(e) && !e.computed && t.isIdentifier(e.object) && t.isIdentifier(e.property)) {
    return firstParamObject(e.object.name) ? {key: e.property.name} : undefined
  }
  if (!t.isIdentifier(e)) return undefined
  const b = scope.getBinding(e.name)
  if (!b) return undefined
  const pattern = b.kind === 'param' && b.path.isObjectPattern() && b.path.key === 0
    ? b.path.node
    : b.path.isVariableDeclarator() && t.isObjectPattern(b.path.node.id) && t.isIdentifier(b.path.node.init) &&
        firstParamObject(b.path.node.init.name)
      ? b.path.node.id
      : undefined
  if (!pattern) return undefined
  for (const p of pattern.properties) {
    if (!t.isObjectProperty(p) || !t.isIdentifier(p.key)) continue
    if (t.isIdentifier(p.value, {name: e.name})) return {key: p.key.name}
    if (t.isAssignmentPattern(p.value) && t.isIdentifier(p.value.left, {name: e.name})) return {dflt: p.value.right, key: p.key.name}
  }
  return undefined
}

const styleOf = (el: El, name = 'style'): StyleInfo | undefined => {
  const attr = findAttr(el.path.node.openingElement, name)
  if (!attr) return undefined
  const v = attr.value
  if (!t.isJSXExpressionContainer(v) || t.isJSXEmptyExpression(v.expression)) {
    return {entries: [], keys: new Map(), unresolved: ['style value']}
  }
  const usage = el.usage
  const prop: PropStyle | undefined = usage
    ? (scope, n) => {
        const k = propKey(scope, n)
        if (!k) return undefined
        const opening = usage.path.node.openingElement
        if (!findAttr(opening, k.key)) {
          return opening.attributes.some(a => t.isJSXSpreadAttribute(a)) ? undefined : 'absent'
        }
        return styleOf(usage, k.key)
      }
    : undefined
  return evalStyle(el.file.code, el.path.scope, v.expression, prop)
}

// ---------------------------------------------------------------- where an element renders

// `rootUse` is the render site a component's root box reached this parent through, so the box can
// read the props that render site passes.
export type Frame = (
  | {kind: 'el'; el: El; target: Target; via: Node}
  | {kind: 'screen'; modal: boolean; name: string}
  | {kind: 'unknown'; reason: string}
) & {rootUse?: El}

type Ctx = {proj: Project; stack: ReadonlyArray<string>; subst: Subst}

const unknownFrame = (reason: string): Array<Frame> => [{kind: 'unknown', reason}]
const lineOf = (file: FileInfo, n: Node) => `${file.rel}:${n.loc?.start.line ?? 0}`

// Statement and expression shapes a returned element passes through on its way out of a function.
const passesThrough = (p: NP, last: NP) =>
  p.isReturnStatement() ||
  p.isBlockStatement() ||
  p.isIfStatement() ||
  p.isSwitchCase() ||
  p.isSwitchStatement() ||
  p.isTryStatement() ||
  p.isJSXExpressionContainer() ||
  p.isParenthesizedExpression() ||
  p.isTSAsExpression() ||
  p.isTSSatisfiesExpression() ||
  (p.isJSXFragment() && last.listKey === 'children') ||
  (p.isConditionalExpression() && last.key !== 'test') ||
  p.isLogicalExpression()

export const placeOf = (ctx: Ctx, file: FileInfo, start: NP): Array<Frame> => {
  let last: NP = start
  let p: NP | null = start.parentPath
  while (p) {
    if (p.isJSXElement()) {
      if (last.listKey !== 'children') return unknownFrame('element shape')
      return frameOfElement(ctx, {file, path: p}, 'children', last.node)
    }
    if (p.isJSXAttribute()) {
      const name = t.isJSXIdentifier(p.node.name) ? p.node.name.name : '?'
      const owner = p.parentPath.parentPath as NP<babel.types.JSXElement>
      return frameOfElement(ctx, {file, path: owner}, name, last.node)
    }
    if (p.isFunction()) {
      if (p.listKey === 'arguments' && p.key === 0 && isMapCall(p.parentPath)) {
        last = p.parentPath as NP
        p = last.parentPath
        continue
      }
      return functionUses(ctx, file, p as NP<Fn>)
    }
    if (p.isVariableDeclarator() && last.key === 'init' && t.isIdentifier(p.node.id)) {
      const b = p.scope.getBinding(p.node.id.name)
      if (!b) return unknownFrame('unbound variable')
      if (b.constantViolations.length) return unknownFrame(`variable ${p.node.id.name} is reassigned`)
      const refs = b.referencePaths.filter(r => !isTypePosition(r))
      if (!refs.length) return unknownFrame(`variable ${p.node.id.name} is never used`)
      return refs.flatMap(r => placeOf(ctx, file, r))
    }
    if (p.isCallExpression() && isMapCall(p) && last.listKey === 'arguments') {
      last = p
      p = p.parentPath
      continue
    }
    if (!passesThrough(p, last)) {
      const why = p.isCallExpression() ? `${calleeName(p.node.callee) || 'a call'}()` : p.node.type
      return unknownFrame(`passed through ${why} at ${lineOf(file, p.node)}`)
    }
    last = p
    p = p.parentPath
  }
  return unknownFrame('module level')
}

const functionUses = (ctx: Ctx, file: FileInfo, fn: NP<Fn>): Array<Frame> => {
  const comp = compOf(file, fn)
  const sub = ctx.subst.get(comp.key)
  if (sub) {
    const rest = new Map(ctx.subst)
    rest.delete(comp.key)
    return placeOf({...ctx, subst: rest}, sub.use.file, sub.use.path)
  }
  if (ctx.stack.includes(comp.key)) return unknownFrame(`${comp.name} renders itself`)
  if (ctx.stack.length > 40) return unknownFrame('render chain too deep')
  const inner: Ctx = {...ctx, stack: [...ctx.stack, comp.key]}
  const frames: Array<Frame> = []
  const screen = ctx.proj.screens.get(comp.key)
  if (screen) frames.push({kind: 'screen', modal: screen.modal, name: comp.name})
  const top = !ctx.stack.length && !ctx.subst.size
  for (const site of ctx.proj.renderSites.get(comp.key) ?? []) {
    frames.push(...placeOf(inner, site.file, site.path).map(f => (top ? {...f, rootUse: site} : f)))
  }
  for (const where of ctx.proj.valueUses.get(comp.key) ?? []) {
    frames.push({kind: 'unknown', reason: `${comp.name} passed as a value at ${where}`})
  }
  // a render helper called in place: {renderRow()}
  const id = t.isFunctionDeclaration(fn.node)
    ? fn.node.id
    : fn.parentPath.isVariableDeclarator() && t.isIdentifier(fn.parentPath.node.id)
      ? fn.parentPath.node.id
      : undefined
  if (id && !/^[A-Z]/.test(id.name)) {
    const b = fn.parentPath.scope.getBinding(id.name)
    for (const r of b?.referencePaths ?? []) {
      if (r.parentPath?.isCallExpression() && r.key === 'callee') frames.push(...placeOf(inner, file, r.parentPath))
      else if (!isTypePosition(r)) frames.push({kind: 'unknown', reason: `${id.name} passed as a value at ${lineOf(file, r.node)}`})
    }
  }
  if (!frames.length) {
    const parent = fn.parentPath
    if (parent.isJSXExpressionContainer() && parent.parentPath.isJSXAttribute()) {
      const attr = parent.parentPath.node.name
      return unknownFrame(`rendered by prop ${t.isJSXIdentifier(attr) ? attr.name : '?'} at ${lineOf(file, fn.node)}`)
    }
    if (parent.isObjectProperty()) return unknownFrame(`${comp.name} callback of an object (list or menu renderer)`)
    return unknownFrame(`${comp.name} has no render site`)
  }
  return frames
}

// Paths in a component's body that render the prop `slot`.
const slotRefs = (fn: NP<Fn>, slot: string): {refs: Array<NP>; spreads: Array<NP<babel.types.JSXElement>>} => {
  const refs: Array<NP> = []
  const spreads: Array<NP<babel.types.JSXElement>> = []
  const param = fn.get('params')[0]
  if (!param) return {refs, spreads}
  const fromBinding = (scope: Scope, name: string) => scope.getBinding(name)?.referencePaths ?? []
  const viaIdent = (name: string) => {
    for (const r of fromBinding(fn.scope, name)) {
      const parent = r.parentPath
      if (parent?.isMemberExpression() && r.key === 'object' && t.isIdentifier(parent.node.property, {name: slot})) {
        refs.push(parent)
      } else if (parent?.isVariableDeclarator() && r.key === 'init' && t.isObjectPattern(parent.node.id)) {
        viaPattern(parent.get('id') as NP<babel.types.ObjectPattern>, parent.scope)
      } else if (parent?.isJSXSpreadAttribute()) {
        spreads.push(parent.parentPath.parentPath as NP<babel.types.JSXElement>)
      }
    }
  }
  const viaPattern = (pat: NP<babel.types.ObjectPattern>, scope: Scope) => {
    for (const prop of pat.node.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key, {name: slot})) {
        const v = t.isAssignmentPattern(prop.value) ? prop.value.left : prop.value
        if (t.isIdentifier(v)) refs.push(...fromBinding(scope, v.name))
      } else if (t.isRestElement(prop) && t.isIdentifier(prop.argument)) {
        for (const r of fromBinding(scope, prop.argument.name)) {
          const parent = r.parentPath
          if (parent?.isMemberExpression() && t.isIdentifier(parent.node.property, {name: slot})) refs.push(parent)
          else if (parent?.isJSXSpreadAttribute()) {
            spreads.push(parent.parentPath.parentPath as NP<babel.types.JSXElement>)
          }
        }
      }
    }
  }
  if (param.isIdentifier()) viaIdent(param.node.name)
  else if (param.isObjectPattern()) viaPattern(param, fn.scope)
  else if (param.isAssignmentPattern() && t.isIdentifier(param.node.left)) viaIdent(param.node.left.name)
  // `!!children &&` and `children.length` read the prop without rendering it
  const rendered = refs.filter(r => {
    const parent = r.parentPath
    if (!parent) return false
    if (parent.isUnaryExpression() || parent.isBinaryExpression() || parent.isMemberExpression()) return false
    if (parent.isLogicalExpression() && parent.node.operator === '&&' && r.key === 'left') return false
    if (parent.isConditionalExpression() && r.key === 'test') return false
    if (parent.isIfStatement()) return false
    if (parent.isCallExpression() && r.listKey === 'arguments' && calleeName(parent.node.callee) === 'Boolean') return false
    return true
  })
  return {refs: rendered, spreads}
}

const withCtx = (el: El, subst: Subst): El => {
  if (!subst.size) return el
  let usage: El | undefined
  for (let p: NP | null = el.path; p && !usage; p = p.parentPath) {
    for (const v of subst.values()) if (v.fn === p.node) usage = v.use
  }
  return {...el, subst, usage}
}

const frameOfElement = (ctx: Ctx, el: El, slot: string, via: Node): Array<Frame> => {
  const targets = resolveElement(ctx.proj, el)
  return targets.flatMap((target): Array<Frame> => {
    if (target.kind === 'unknown') return [{kind: 'unknown', reason: `${target.reason} at ${lineOf(el.file, el.path.node)}`}]
    if (target.kind === 'host' && target.host === 'transparent') {
      return slot === 'children' ? placeOf(ctx, el.file, el.path) : unknownFrame(`prop ${slot} of a wrapper`)
    }
    if (target.kind === 'box' || target.kind === 'host') {
      if (slot !== 'children') return unknownFrame(`prop ${slot} of a box at ${lineOf(el.file, el.path.node)}`)
      return [{el: withCtx(el, ctx.subst), kind: 'el', target, via}]
    }
    const {comp} = target
    if (ctx.stack.includes(`slot:${comp.key}:${slot}`)) return unknownFrame(`${comp.name} renders ${slot} into itself`)
    const {refs, spreads} = slotRefs(comp.fn, slot)
    if (!refs.length && !spreads.length) {
      return unknownFrame(`${comp.name} (${comp.file.rel}) does not render prop ${slot} in place`)
    }
    const subst = new Map(ctx.subst)
    subst.set(comp.key, {fn: comp.fn.node, use: el})
    const inner: Ctx = {...ctx, stack: [...ctx.stack, `slot:${comp.key}:${slot}`], subst}
    return [
      ...refs.flatMap(r => placeOf(inner, comp.file, r)),
      ...spreads.flatMap(s => frameOfElement(inner, {file: comp.file, path: s}, slot, via)),
    ]
  })
}

const framesCache = new WeakMap<Node, Array<Frame>>()
export const parentFrames = (proj: Project, el: El): Array<Frame> => {
  if (el.subst?.size) return placeOf({proj, stack: [], subst: el.subst}, el.file, el.path)
  const hit = framesCache.get(el.path.node)
  if (hit) return hit
  const frames = placeOf({proj, stack: [], subst: new Map()}, el.file, el.path)
  framesCache.set(el.path.node, frames)
  return frames
}

// ---------------------------------------------------------------- a parent's layout

export type Axis = 'w' | 'h'
type Dir = 'col' | 'row' | 'block'
type Align = 'stretch' | 'flex-start' | 'center' | 'flex-end' | 'baseline'
type Desc = {dir: Dir; align: Align} | {unknown: string}

const lit = (k: StyleKey | undefined) =>
  k && !k.cond && k.vals.length === 1 && !k.vals[0]!.startsWith('{') ? k.vals[0] : undefined
const zeroish = (v: string) => v === '0' || v === '{0}'

type AttrValue = {absent: true} | {value: string} | {either: [string, string]} | {expr: true}

const literalAttr = (e: Node): AttrValue | undefined => {
  if (t.isStringLiteral(e)) return {value: e.value}
  if (t.isBooleanLiteral(e)) return {value: String(e.value)}
  if (t.isNumericLiteral(e)) return {value: String(e.value)}
  return undefined
}

const attrString = (el: El, name: string): AttrValue => {
  const a = findAttr(el.path.node.openingElement, name)
  if (!a) return {absent: true as const}
  const v = a.value
  // a prop forwarded from the enclosing component: read it off the usage
  if (el.usage && t.isJSXExpressionContainer(v) && (t.isIdentifier(v.expression) || t.isMemberExpression(v.expression))) {
    const k = propKey(el.path.scope, v.expression)
    if (k) {
      const opening = el.usage.path.node.openingElement
      if (findAttr(opening, k.key)) return attrString(el.usage, k.key)
      if (opening.attributes.some(x => t.isJSXSpreadAttribute(x))) return {expr: true}
      return (k.dflt && literalAttr(k.dflt)) ?? {absent: true}
    }
  }
  if (t.isStringLiteral(v)) return {value: v.value}
  if (t.isJSXExpressionContainer(v) && t.isStringLiteral(v.expression)) return {value: v.expression.value}
  if (v === null || v === undefined) return {value: 'true'}
  if (t.isJSXExpressionContainer(v) && (t.isBooleanLiteral(v.expression) || t.isNumericLiteral(v.expression))) {
    return {value: String(v.expression.value)}
  }
  if (t.isJSXExpressionContainer(v) && t.isConditionalExpression(v.expression)) {
    const {consequent: c, alternate: alt} = v.expression
    if (t.isStringLiteral(c) && t.isStringLiteral(alt)) return {either: [c.value, alt.value]}
  }
  return {expr: true as const}
}

const dirOfDirection = (d: string): Dir => (d.startsWith('horizontal') ? 'row' : 'col')
const dirOfFlex = (d: string): Dir | undefined =>
  d === 'row' || d === 'row-reverse' ? 'row' : d === 'column' || d === 'column-reverse' ? 'col' : undefined

const describe = (frame: Extract<Frame, {kind: 'el'}>): Desc => {
  const {el, target} = frame
  const opening = el.path.node.openingElement
  if (opening.attributes.some(a => t.isJSXSpreadAttribute(a))) return {unknown: `parent has spread props at ${lineOf(el.file, opening)}`}
  const style = styleOf(el)
  if (style?.unresolved.length) return {unknown: `parent style unresolved (${style.unresolved[0]}) at ${lineOf(el.file, opening)}`}
  const sDir = style?.keys.get('flexDirection')
  const sAlign = style?.keys.get('alignItems')
  const sDisplay = style?.keys.get('display')
  if (sDisplay && lit(sDisplay) !== 'flex') return {unknown: `parent style display at ${lineOf(el.file, opening)}`}
  let dir: Dir
  let align: Align = 'stretch'
  if (target.kind === 'box') {
    const cls = classSets(el, layoutProps, true)
    if (cls) return {unknown: `parent ${cls}`}
    const d = attrString(el, 'direction')
    if ('value' in d && d.value) dir = dirOfDirection(d.value)
    else if ('either' in d && dirOfDirection(d.either[0]!) === dirOfDirection(d.either[1]!)) dir = dirOfDirection(d.either[0]!)
    else return {unknown: `parent direction is an expression at ${lineOf(el.file, opening)}`}
    const ai = attrString(el, 'alignItems')
    const cc = attrString(el, 'centerChildren')
    if ('value' in ai && ai.value) align = ai.value as Align
    else if (!('absent' in ai)) return {unknown: `parent alignItems is an expression at ${lineOf(el.file, opening)}`}
    else if ('value' in cc && cc.value === 'true') align = 'center'
    else if (!('absent' in cc) && !('value' in cc && cc.value === 'false')) {
      return {unknown: `parent centerChildren is an expression at ${lineOf(el.file, opening)}`}
    }
  } else if (target.kind === 'host' && target.host === 'div') {
    const cls = classSets(el, [...layoutProps, 'width', 'height'], true)
    if (cls) return {unknown: `parent <div> ${cls}`}
    dir = sDisplay ? 'row' : 'block'
  } else if (target.kind === 'host' && (target.host === 'scroll' || target.host === 'kbscroll')) {
    if (findAttr(opening, 'horizontal')) return {unknown: `horizontal ScrollView at ${lineOf(el.file, opening)}`}
    const cc = findAttr(opening, 'contentContainerStyle')
    if (cc) {
      const v = cc.value
      const s = t.isJSXExpressionContainer(v) && !t.isJSXEmptyExpression(v.expression)
        ? evalStyle(el.file.code, el.path.scope, v.expression)
        : undefined
      if (!s || s.unresolved.length || ['display', 'flexDirection', 'alignItems', 'flexWrap'].some(k => s.keys.has(k))) {
        return {unknown: `ScrollView contentContainerStyle may set layout at ${lineOf(el.file, opening)}`}
      }
    }
    return {align: 'stretch', dir: 'col'}
  } else {
    dir = 'col'
  }
  if (sDir) {
    const v = lit(sDir)
    const d = v && dirOfFlex(v)
    if (!d) return {unknown: `parent style flexDirection at ${lineOf(el.file, opening)}`}
    dir = d
  }
  if (sAlign) {
    const v = lit(sAlign)
    if (!v) return {unknown: `parent style alignItems at ${lineOf(el.file, opening)}`}
    align = v as Align
  }
  return {align, dir}
}

const sizeKey = (a: Axis) => (a === 'w' ? 'width' : 'height')
const minKey = (a: Axis) => (a === 'w' ? 'minWidth' : 'minHeight')
const maxKey = (a: Axis) => (a === 'w' ? 'maxWidth' : 'maxHeight')
const fullAttr = (a: Axis) => (a === 'w' ? 'fullWidth' : 'fullHeight')
const marginKeys = (a: Axis) =>
  a === 'w'
    ? ['margin', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginStart', 'marginEnd']
    : ['margin', 'marginTop', 'marginBottom', 'marginVertical']
const insetPairs = (a: Axis): Array<[string, string]> =>
  a === 'w' ? [['left', 'right'], ['start', 'end'], ['left', 'end'], ['start', 'right']] : [['top', 'bottom']]

const hasMargin = (s: StyleInfo | undefined, a: Axis) =>
  marginKeys(a).some(k => {
    const v = s?.keys.get(k)
    return v && !(v.vals.every(zeroish))
  })

const isAbsolute = (s: StyleInfo | undefined) => s?.keys.get('position')?.vals.some(v => v === 'absolute' || v.startsWith('{'))
const absZeroInsets = (s: StyleInfo | undefined, a: Axis) => {
  if (!s) return false
  const pos = s.keys.get('position')
  if (!pos || lit(pos) !== 'absolute') return false
  const inset = lit(s.keys.get('inset'))
  if (inset !== undefined && zeroish(inset)) return true
  return insetPairs(a).some(([x, y]) => {
    const vx = lit(s.keys.get(x))
    const vy = lit(s.keys.get(y))
    return vx !== undefined && vy !== undefined && zeroish(vx) && zeroish(vy)
  })
}

const hasFlex = (el: El, s: StyleInfo | undefined) => {
  const f = attrString(el, 'flex')
  if ('value' in f && f.value === '1') return true
  return ['flex', 'flexGrow'].some(k => {
    const v = lit(s?.keys.get(k))
    return v !== undefined && Number(v) > 0
  })
}

const ownAlignSelf = (el: El, s: StyleInfo | undefined): string | undefined | {unknown: string} => {
  const sv = s?.keys.get('alignSelf')
  if (sv) return lit(sv) ?? {unknown: 'style alignSelf is conditional'}
  const a = attrString(el, 'alignSelf')
  if ('absent' in a) return undefined
  if ('value' in a) return a.value
  return {unknown: 'alignSelf is an expression'}
}

type Tri = {v: 'yes' | 'no'; why?: string} | {v: 'unknown'; why: string}
const definiteCache = new WeakMap<Node, Map<Node | undefined, {w?: Tri; h?: Tri}>>()

const combine = (xs: ReadonlyArray<Tri>): Tri => {
  const no = xs.find(x => x.v === 'no')
  if (no) return no
  const unk = xs.find(x => x.v === 'unknown')
  return unk ?? {v: 'yes'}
}

const screenDefinite = (f: Extract<Frame, {kind: 'screen'}>, a: Axis): Tri =>
  a === 'h' && f.modal
    ? {v: 'unknown', why: `${f.name} is a modal: content-sized height on desktop, full height on native`}
    : {v: 'yes'}

// Whether an element's size on an axis is definite: set by its style, by fullWidth/fullHeight, by
// insets, by flex on its parent's main axis, or by stretching across a definite parent.
export const definite = (proj: Project, frame: Frame, a: Axis): Tri => {
  if (frame.kind === 'unknown') return {v: 'unknown', why: frame.reason}
  if (frame.kind === 'screen') return screenDefinite(frame, a)
  const {el, target} = frame
  if (target.kind === 'host' && (target.host === 'scroll' || target.host === 'kbscroll')) {
    return a === 'w' ? {v: 'yes'} : {v: 'no', why: `ScrollView content at ${lineOf(el.file, el.path.node)}`}
  }
  const node = el.path.node
  const byUsage = definiteCache.get(node) ?? new Map<Node | undefined, {w?: Tri; h?: Tri}>()
  definiteCache.set(node, byUsage)
  const cached = byUsage.get(el.usage?.path.node) ?? {}
  byUsage.set(el.usage?.path.node, cached)
  const hit = cached[a]
  if (hit) return hit
  cached[a] = {v: 'unknown', why: 'cycle'}
  const r = definiteUncached(proj, el, target, a)
  cached[a] = r
  return r
}

const definiteUncached = (proj: Project, el: El, target: Target, a: Axis): Tri => {
  const where = lineOf(el.file, el.path.node)
  const s = styleOf(el)
  if (s?.unresolved.length) return {v: 'unknown', why: `style unresolved (${s.unresolved[0]}) at ${where}`}
  const size = s?.keys.get(sizeKey(a))
  if (size && !size.cond && lit(size) !== 'auto') return {v: 'yes'}
  const cls = classSets(el, [...sizeProps(a), 'position', 'align-self', a === 'w' ? 'left' : 'top'])
  if (cls) return {v: 'unknown', why: cls}
  if (target.kind === 'box') {
    const full = attrString(el, fullAttr(a))
    if ('value' in full && full.value === 'true') return {v: 'yes'}
  }
  if (isAbsolute(s)) {
    return absZeroInsets(s, a) ? {v: 'yes'} : {v: 'no', why: `absolute without both insets at ${where}`}
  }
  const frames = parentFrames(proj, el)
  return combine(
    frames.map((pf): Tri => {
      if (pf.kind === 'unknown') return {v: 'unknown', why: pf.reason}
      if (pf.kind === 'screen') return screenDefinite(pf, a)
      const d = describe(pf)
      if ('unknown' in d) return {v: 'unknown', why: d.unknown}
      if (d.dir === 'block') return a === 'w' ? definite(proj, pf, 'w') : {v: 'no', why: `in a block at ${where}`}
      const main: Axis = d.dir === 'col' ? 'h' : 'w'
      if (main === a) return hasFlex(el, s) ? {v: 'yes'} : {v: 'no', why: `content-sized on its parent's main axis at ${where}`}
      const self = ownAlignSelf(el, s)
      if (typeof self === 'object') return {v: 'unknown', why: `${self.unknown} at ${where}`}
      const align = self ?? d.align
      if (align !== 'stretch') return {v: 'no', why: `aligned ${align} at ${where}`}
      return definite(proj, pf, a)
    })
  )
}

// ---------------------------------------------------------------- classification

export type AxisClass = 'SAME' | 'MAIN' | 'MARGIN' | 'WIDTH' | 'ABS' | 'ALIGNSELF_STYLE' | 'CONTENT' | 'UNKNOWN'
const rank: ReadonlyArray<AxisClass> = ['UNKNOWN', 'ABS', 'MAIN', 'MARGIN', 'WIDTH', 'ALIGNSELF_STYLE', 'CONTENT', 'SAME']

export type FrameResult = {
  cls: AxisClass
  why: string
  sub?: string
  align?: string
  parentDefinite?: Tri['v']
  onlyChild?: boolean
}
export type AxisResult = {
  cls: AxisClass
  why: string
  sub?: string
  frames: Array<FrameResult>
  fix: Fix
  value: 'true' | 'expr'
}
export type Fix =
  | {kind: 'none'}
  | {kind: 'explicit'; add: Array<string>; remove: boolean; form: string}
  | {kind: 'flex'; form: string}
  | {kind: 'remove'; add: Array<string>; form: string}

export type SiteResult = {
  site: string
  tag: string
  w?: AxisResult
  h?: AxisResult
  alignSelf?: {prop: string; dead: boolean}
  stretchAfter: 'removed' | 'kept' | 'none'
}

const percentAtMost100 = (v: string) => /^\d+(\.\d+)?%$/.test(v) && parseFloat(v) <= 100

// The size keys on the axis, for a cross-axis box: whether they tell 100% and stretch apart.
//   width '100%'          same as fullWidth's own width: no difference
//   width other           fullWidth's width is dead today and only its maxWidth: 100% cap stays;
//                         stretch never applies to a box with a width, so they differ
//   maxWidth / minWidth   both clamp the same width; they differ only in where a box narrower (or
//                         wider) than its parent sits: today the parent's alignItems or the box's
//                         alignSelf places it, after the flip stretch places it at the start
const sizeClass = (s: StyleInfo | undefined, a: Axis, align: string): {cls: AxisClass; sub: string} | undefined => {
  const size = s?.keys.get(sizeKey(a))
  if (size) {
    if (size.vals.every(v => v === '100%')) return undefined
    return {cls: 'WIDTH', sub: `own ${sizeKey(a)} ${size.vals.join('|')}`}
  }
  const clamps = [maxKey(a), minKey(a)].filter(k => {
    const v = s?.keys.get(k)
    return v && !(k === maxKey(a) && v.vals.every(x => x === '100%'))
  })
  if (!clamps.length) return undefined
  if (align === 'stretch' || align === 'flex-start') return undefined
  return {cls: 'WIDTH', sub: `${clamps.join('+')} placed ${align}`}
}

const onlyChildOf = (frame: Extract<Frame, {kind: 'el'}>) => {
  const kids = frame.el.path.node.children.filter(c => !(t.isJSXText(c) && !c.value.trim()))
  return kids.length === 1 && kids[0] === frame.via
}

const classifyFrame = (proj: Project, site: El, s: StyleInfo | undefined, frame: Frame, a: Axis): FrameResult => {
  if (frame.kind === 'unknown') return {cls: 'UNKNOWN', why: frame.reason}
  let d: Desc
  if (frame.kind === 'screen') d = {align: 'stretch', dir: 'col'}
  else d = describe(frame)
  if ('unknown' in d) return {cls: 'UNKNOWN', why: d.unknown}
  const main: Axis = d.dir === 'row' ? 'w' : 'h'
  if (main === a) {
    const def = frame.kind === 'screen' ? screenDefinite(frame, a) : definite(proj, frame, a)
    const onlyChild = frame.kind === 'screen' ? !frame.modal : onlyChildOf(frame)
    return {cls: 'MAIN', onlyChild, parentDefinite: def.v, why: d.dir === 'block' ? 'block parent' : `${d.dir} parent`}
  }
  if (hasMargin(s, a)) return {cls: 'MARGIN', why: 'own margins'}
  const self = ownAlignSelf(site, s)
  if (typeof self === 'object') return {cls: 'UNKNOWN', why: self.unknown}
  const styleSelf = lit(s?.keys.get('alignSelf'))
  if (s?.keys.has('alignSelf') && styleSelf !== 'stretch' && !s.keys.has(sizeKey(a))) {
    return {cls: 'ALIGNSELF_STYLE', why: `style alignSelf ${s.keys.get('alignSelf')!.vals.join('|')}`}
  }
  const align = self ?? d.align
  const sc = sizeClass(s, a, align)
  if (sc) return {align, cls: sc.cls, why: sc.sub}
  const def = frame.kind === 'screen' ? screenDefinite(frame, a) : definite(proj, frame, a)
  if (def.v === 'no') return {align: d.align, cls: 'CONTENT', why: def.why ?? 'content-sized parent'}
  if (def.v === 'unknown') return {align: d.align, cls: 'UNKNOWN', why: def.why}
  return {align: d.align, cls: 'SAME', why: frame.kind === 'screen' ? 'screen' : `${d.dir} parent`}
}

// The least noisy explicit form for adding style keys at a site.
const styleForm = (el: El, s: StyleInfo | undefined, keys: ReadonlyArray<string>) => {
  const attr = findAttr(el.path.node.openingElement, 'style')
  if (!attr) return keys.length === 1 ? `style={Styles.globalStyles.${keys[0] === 'width' ? 'fullWidth' : 'fullHeight'}}` : `style={Styles.size('100%')}`
  const v = attr.value
  const e = t.isJSXExpressionContainer(v) ? v.expression : undefined
  const clash = keys.some(k => s?.keys.has(k))
  if (t.isObjectExpression(e)) return clash ? 'inline object: prepend keys' : 'inline object: add keys'
  if (t.isMemberExpression(e) && s?.entries.length === 1) {
    const name = s.entries[0]!
    const uses = el.file.code.split(new RegExp(`\\bstyles\\.${name}\\b`)).length - 1
    return uses === 1 ? `merge into styles.${name}` : `merge into styles.${name} (shared by ${uses} uses)`
  }
  return clash ? 'style list: prepend an object' : 'style list: add an object'
}

// CSS gives a flex item with visible overflow an automatic minimum size, so flex: 1 could grow past
// the parent where height: 100% does not; a box that clips its overflow has none.
const clipsOverflow = (el: El, s: StyleInfo | undefined) => {
  const o = attrString(el, 'overflow')
  return ('value' in o && o.value === 'hidden') || lit(s?.keys.get('overflow')) === 'hidden'
}

const fixFor = (
  el: El,
  s: StyleInfo | undefined,
  a: Axis,
  cls: AxisClass,
  frames: ReadonlyArray<FrameResult>
): Fix => {
  if (cls === 'SAME') return {kind: 'none'}
  const size = s?.keys.get(sizeKey(a))
  if (cls === 'WIDTH' && size) {
    if (lit(size) === '100%') return {add: [], form: 'remove the prop (style already sets 100%)', kind: 'remove'}
    const capped = s?.keys.has(maxKey(a)) || size.vals.every(percentAtMost100)
    return capped
      ? {add: [], form: 'remove the prop (its size is overridden)', kind: 'remove'}
      : {add: [`${maxKey(a)}: '100%'`], form: styleForm(el, s, [maxKey(a)]), kind: 'remove'}
  }
  if (size && lit(size) === '100%') return {add: [], form: 'remove the prop (style already sets 100%)', kind: 'remove'}
  if (
    cls === 'MAIN' &&
    a === 'h' &&
    frames.every(f => f.cls === 'MAIN' && f.onlyChild && f.parentDefinite === 'yes') &&
    !s?.keys.has(minKey(a)) &&
    !s?.keys.has(maxKey(a)) &&
    clipsOverflow(el, s) &&
    !hasFlex(el, s)
  ) {
    return {form: 'flex={1}', kind: 'flex'}
  }
  return {add: [`${sizeKey(a)}: '100%'`], form: styleForm(el, s, [sizeKey(a)]), kind: 'explicit', remove: true}
}

const worst = (rs: ReadonlyArray<FrameResult>): FrameResult =>
  rs.reduce((acc, r) => (rank.indexOf(r.cls) < rank.indexOf(acc.cls) ? r : acc), rs[0] ?? {cls: 'UNKNOWN', why: 'no parent'})

export const classifyAxis = (proj: Project, el: El, a: Axis): AxisResult | undefined => {
  const attr = findAttr(el.path.node.openingElement, fullAttr(a))
  const v = readAxis(attr, el.file.code)
  if (v.kind === 'absent') return undefined
  const value = v.kind === 'true' ? 'true' : 'expr'
  const done = (cls: AxisClass, why: string, frames: Array<FrameResult>, sub?: string): AxisResult => ({
    cls,
    fix: fixFor(el, s, a, cls, frames),
    frames,
    sub,
    value,
    why,
  })
  const s = styleOf(el)
  if (v.kind === 'unresolved') return done('UNKNOWN', v.reason, [])
  if (el.path.node.openingElement.attributes.some(x => t.isJSXSpreadAttribute(x))) return done('UNKNOWN', 'spread props', [])
  const cls = classSets(el, ownProps)
  if (cls) return done('UNKNOWN', cls, [])
  // a style read from props resolves per render site
  const frames = parentFrames(proj, el).map((f): FrameResult => {
    const site = f.rootUse && s?.unresolved.length ? {...el, usage: f.rootUse} : el
    const fs = site === el ? s : styleOf(site)
    if (fs?.unresolved.length) return {cls: 'UNKNOWN', why: `style unresolved (${fs.unresolved[0]})`}
    if (isAbsolute(fs)) {
      return absZeroInsets(fs, a)
        ? {cls: 'SAME', sub: 'abs-insets', why: 'absolute with zero insets'}
        : {cls: 'ABS', why: 'absolute without zero insets on both sides'}
    }
    return classifyFrame(proj, site, fs, f, a)
  })
  const w = worst(frames)
  return done(w.cls, w.why, frames, w.sub)
}

const nameOfTarget = (el: El) => {
  const n = el.path.node.openingElement.name
  return t.isJSXMemberExpression(n) ? n.property.name : t.isJSXIdentifier(n) ? n.name : '?'
}

export const isBoxSite = (proj: Project, el: El) => resolveElement(proj, el).some(x => x.kind === 'box')

const parentsStretch = (proj: Project, el: El) =>
  parentFrames(proj, el).every(f => {
    if (f.kind === 'screen') return true
    if (f.kind !== 'el') return false
    const d = describe(f)
    return !('unknown' in d) && (d.align === 'stretch' || d.dir === 'block')
  })

export const classifySite = (proj: Project, el: El): SiteResult | undefined => {
  const w = classifyAxis(proj, el, 'w')
  const h = classifyAxis(proj, el, 'h')
  if (!w && !h) return undefined
  const kept = [w, h].filter(r => r?.fix.kind === 'none') as Array<AxisResult>
  const a = attrString(el, 'alignSelf')
  const alignSelf = 'absent' in a ? undefined : {dead: kept.length > 0, prop: 'value' in a ? a.value : 'expr'}
  const absInsets = kept.length > 0 && kept.every(r => r.sub === 'abs-insets')
  const stretchAfter = !kept.length ? 'none' : absInsets || parentsStretch(proj, el) ? 'removed' : 'kept'
  return {
    alignSelf,
    h,
    site: lineOf(el.file, el.path.node),
    stretchAfter,
    tag: nameOfTarget(el),
    w,
  }
}

// ---------------------------------------------------------------- no-op finder

export type NoOps = {
  alignSelfStretchUnderStretch: Array<string>
  alignItemsStretch: Array<string>
  flexDirectionRestated: Array<string>
  size100WithFull: Array<{site: string; axis: Axis; cls: AxisClass}>
  fullWithOtherSize: Array<{site: string; axis: Axis; size: string}>
  alignSelfPropOverridden: Array<{site: string; cond: boolean}>
  staleComments: Array<string>
  forwarders: Array<{site: string; how: string}>
}

const staleComment =
  /(align-?self[^a-z]*'?center|cent(er|re)s?( [a-z]+)? by default|defaults? to (alignSelf )?'?cent|center(ing)? default|implicit(ly)? cent|default.{0,30}cent(er|re))/i

export const findNoOps = (proj: Project, results: ReadonlyMap<Node, SiteResult>): NoOps => {
  const out: NoOps = {
    alignItemsStretch: [],
    alignSelfPropOverridden: [],
    alignSelfStretchUnderStretch: [],
    flexDirectionRestated: [],
    forwarders: [],
    fullWithOtherSize: [],
    size100WithFull: [],
    staleComments: [],
  }
  for (const el of proj.elements) {
    if (!isBoxSite(proj, el)) continue
    const opening = el.path.node.openingElement
    const site = lineOf(el.file, opening)
    const s = styleOf(el)
    const ai = attrString(el, 'alignItems')
    const cc = attrString(el, 'centerChildren')
    if ('value' in ai && ai.value === 'stretch' && ('absent' in cc || ('value' in cc && cc.value === 'false'))) {
      out.alignItemsStretch.push(site)
    }
    const as = attrString(el, 'alignSelf')
    if ('value' in as && as.value === 'stretch' && !isAbsolute(s) && parentsStretch(proj, el)) {
      out.alignSelfStretchUnderStretch.push(site)
    }
    if (!('absent' in as) && s?.keys.has('alignSelf')) out.alignSelfPropOverridden.push({cond: s.keys.get('alignSelf')!.cond, site})
    const d = attrString(el, 'direction')
    const fd = lit(s?.keys.get('flexDirection'))
    if (fd && 'value' in d && d.value) {
      const expected = {horizontal: 'row', horizontalReverse: 'row-reverse', vertical: 'column', verticalReverse: 'column-reverse'}[d.value]
      if (expected === fd) out.flexDirectionRestated.push(site)
    }
    const r = results.get(el.path.node)
    for (const a of ['w', 'h'] as const) {
      const ar = r?.[a]
      if (!ar) continue
      const size = s?.keys.get(sizeKey(a))
      if (!size) continue
      if (size.vals.every(v => v === '100%')) out.size100WithFull.push({axis: a, cls: ar.cls, site})
      else out.fullWithOtherSize.push({axis: a, site, size: size.vals.join('|')})
    }
    // a box whose fullWidth / fullHeight / spread comes from its component's props
    const fn = el.path.getFunctionParent()
    const param = fn?.node.params[0]
    if (fn && param) {
      const names = new Set<string>()
      if (t.isIdentifier(param)) names.add(param.name)
      fn.traverse({
        ObjectPattern(p) {
          if (p.parentPath.isFunction() || (p.parentPath.isVariableDeclarator() && t.isIdentifier(p.parentPath.node.init) && names.has(p.parentPath.node.init.name))) {
            for (const prop of p.node.properties) {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) names.add(prop.value.name)
              if (t.isRestElement(prop) && t.isIdentifier(prop.argument)) names.add(prop.argument.name)
            }
          }
        },
      })
      if (t.isObjectPattern(param)) {
        for (const prop of param.properties) {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) names.add(prop.value.name)
          if (t.isRestElement(prop) && t.isIdentifier(prop.argument)) names.add(prop.argument.name)
        }
      }
      const fromProps = (e: Node) => {
        let hit = false
        babel.traverse(t.file(t.program([t.expressionStatement(e as babel.types.Expression)])), {
          noScope: true,
          Identifier(p) {
            if (names.has(p.node.name)) hit = true
          },
        })
        return hit
      }
      for (const name of ['fullWidth', 'fullHeight']) {
        const at = findAttr(opening, name)
        const v = at?.value
        if (t.isJSXExpressionContainer(v) && !t.isJSXEmptyExpression(v.expression) && fromProps(v.expression)) {
          out.forwarders.push({how: `${name} from props in ${compOf(el.file, fn as NP<Fn>).name}`, site})
        }
      }
      for (const at of opening.attributes) {
        if (t.isJSXSpreadAttribute(at) && fromProps(at.argument)) {
          out.forwarders.push({how: `spread props in ${compOf(el.file, fn as NP<Fn>).name}`, site})
        }
      }
    }
    // `const boxProps = {fullWidth: true, ...}; <Box2 {...boxProps}>`
    for (const at of opening.attributes) {
      if (!t.isJSXSpreadAttribute(at) || !t.isIdentifier(at.argument)) continue
      const init = el.path.scope.getBinding(at.argument.name)?.path.node
      let obj = t.isVariableDeclarator(init) ? init.init : undefined
      while (t.isTSAsExpression(obj) || t.isTSSatisfiesExpression(obj)) obj = obj.expression
      if (!t.isObjectExpression(obj)) continue
      for (const p of obj.properties) {
        if (t.isObjectProperty(p) && (t.isIdentifier(p.key, {name: 'fullWidth'}) || t.isIdentifier(p.key, {name: 'fullHeight'}))) {
          out.forwarders.push({how: `spread object ${at.argument.name} sets ${p.key.name}`, site})
        }
      }
    }
  }
  for (const file of proj.files.values()) {
    const ast = file.program.parent as babel.types.File
    for (const c of ast.comments ?? []) {
      if (staleComment.test(c.value) && /Box2|align-?self/i.test(c.value)) out.staleComments.push(`${file.rel}:${c.loc?.start.line ?? 0}: ${c.value.trim().slice(0, 100)}`)
    }
    file.program.traverse({
      VariableDeclarator(p) {
        if (t.isCallExpression(p.node.init) && calleeName(p.node.init.callee) === 'createAnimatedComponent') {
          const arg = p.get('init').get('arguments') as Array<NP>
          if (arg[0] && resolveExpr(proj, file, arg[0], 0).some(x => x.kind === 'box')) {
            out.forwarders.push({how: 'createAnimatedComponent(Box2)', site: lineOf(file, p.node)})
          }
        }
      },
    })
  }
  return out
}

// ---------------------------------------------------------------- report

export const classifyProject = (proj: Project) => {
  const results = new Map<Node, SiteResult>()
  for (const el of proj.elements) {
    if (!isBoxSite(proj, el)) continue
    const r = classifySite(proj, el)
    if (r) results.set(el.path.node, r)
  }
  return results
}

export type Summary = {
  byClass: {[k: string]: {count: number; examples: Array<string>}}
  fixes: {[form: string]: number}
  mainHeight: {definite: number; indefinite: number; unknown: number; flexProvable: number; onlyChildDefinite: number}
  alignSelfDead: Array<string>
  both: {sites: number; classes: {[k: string]: number}}
  endState: {
    propsBefore: number
    stretchKept: number
    deletedOutright: number
    explicitAdded: number
    cleanupRemoved: {fullWidth: number; fullHeight: number}
  }
}

const bump = (m: {[k: string]: number}, k: string) => {
  m[k] = (m[k] ?? 0) + 1
}

// Counts per class and the end state: SAME props become `stretch` (one per box), the rest take
// their fix-up, and `stretch` under a parent whose alignItems stretches is removed.
export const summarize = (sites: ReadonlyArray<SiteResult>): Summary => {
  const sum: Summary = {
    alignSelfDead: [],
    both: {classes: {}, sites: 0},
    byClass: {},
    endState: {cleanupRemoved: {fullHeight: 0, fullWidth: 0}, deletedOutright: 0, explicitAdded: 0, propsBefore: 0, stretchKept: 0},
    fixes: {},
    mainHeight: {definite: 0, flexProvable: 0, indefinite: 0, onlyChildDefinite: 0, unknown: 0},
  }
  for (const r of sites) {
    const axes = (['w', 'h'] as const).filter(a => r[a])
    if (axes.length === 2) {
      sum.both.sites++
      bump(sum.both.classes, `fullWidth ${r.w!.cls} + fullHeight ${r.h!.cls}`)
    }
    let kept = 0
    for (const a of axes) {
      const x = r[a]!
      const prop = a === 'w' ? 'fullWidth' : 'fullHeight'
      sum.endState.propsBefore++
      const key = `${prop} ${x.cls} ${r.tag === 'ClickableBox' ? 'ClickableBox' : 'Box2'}`
      const c = (sum.byClass[key] ??= {count: 0, examples: []})
      c.count++
      if (c.examples.length < 3) c.examples.push(r.site)
      if (x.fix.kind === 'none') {
        kept++
        if (r.stretchAfter === 'removed') sum.endState.cleanupRemoved[prop]++
      } else {
        bump(sum.fixes, `${prop} ${x.cls}: ${x.fix.kind === 'flex' ? 'flex={1}' : x.fix.kind === 'remove' ? (x.fix.add.length ? `remove, add ${x.fix.add.join(', ')}` : 'remove') : `explicit ${x.fix.add.join(', ')}`}`)
        if (x.fix.kind === 'remove' && !x.fix.add.length) sum.endState.deletedOutright++
        else sum.endState.explicitAdded++
      }
      if (a === 'h' && x.cls === 'MAIN') {
        const defs = x.frames.map(f => f.parentDefinite)
        if (defs.every(d => d === 'yes')) sum.mainHeight.definite++
        else if (defs.every(d => d === 'no')) sum.mainHeight.indefinite++
        else sum.mainHeight.unknown++
        if (x.frames.every(f => f.onlyChild && f.parentDefinite === 'yes')) sum.mainHeight.onlyChildDefinite++
        if (x.fix.kind === 'flex') sum.mainHeight.flexProvable++
      }
    }
    if (kept) {
      // both props SAME collapse into one stretch
      sum.endState.deletedOutright += kept - 1
      if (r.stretchAfter === 'removed') sum.endState.deletedOutright++
      else sum.endState.stretchKept++
    }
    if (r.alignSelf?.dead) sum.alignSelfDead.push(r.site)
  }
  return sum
}

const main = (argv: Array<string>) => {
  const [mode, ...rest] = argv
  if (mode !== 'classify') {
    console.error('usage: box2-fullwidth-stretch.mts classify [--report <file>]')
    process.exit(2)
  }
  const ri = rest.indexOf('--report')
  const reportFile = ri >= 0 ? rest[ri + 1] : undefined
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  setCssIndex(loadCss(root))
  const proj = loadProject(root)
  const results = classifyProject(proj)
  const noOps = findNoOps(proj, results)
  const sites = [...results.values()]
  const tally: {[k: string]: number} = {}
  for (const r of sites) {
    for (const a of ['w', 'h'] as const) {
      const x = r[a]
      if (x) tally[`${a === 'w' ? 'fullWidth' : 'fullHeight'} ${r.tag} ${x.cls}`] = (tally[`${a === 'w' ? 'fullWidth' : 'fullHeight'} ${r.tag} ${x.cls}`] ?? 0) + 1
    }
  }
  const summary = summarize(sites)
  const report = {
    summary,
    noOps,
    sites: sites.map(r => ({
      ...r,
      h: r.h && {...r.h, frames: r.h.frames.slice(0, 6)},
      w: r.w && {...r.w, frames: r.w.frames.slice(0, 6)},
    })),
    tally,
  }
  if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n')
  for (const [k, n] of Object.entries(tally).sort()) console.log(`${k}: ${n}`)
  console.log(JSON.stringify(summary.endState), JSON.stringify(summary.mainHeight))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && existsSync(process.argv[1])) {
  main(process.argv.slice(2))
}
