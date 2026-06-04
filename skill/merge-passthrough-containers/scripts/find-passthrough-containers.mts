// Finds "pass-through container" components: a default-exported component whose
// only job is to call hook(s), assemble props, and render ONE imported sibling
// view component. These are redux-era ceremony that can usually be folded into
// the view. See SKILL.md.
//
// Run from `shared/` (so the `typescript` package resolves):
//   node .claude/skills/merge-passthrough-containers/scripts/find-passthrough-containers.mts <dir>
// <dir> is relative to shared/, e.g. `chat/inbox` or `.` for everything.

import {readFileSync, readdirSync, statSync, existsSync} from 'fs'
import {join, relative, dirname, basename} from 'path'
import {execSync} from 'child_process'
import {createRequire} from 'module'

// Resolve the `typescript` package from the current working directory's
// node_modules (this script lives outside the repo's package tree, so a plain
// `import 'typescript'` would fail ESM resolution). Run from `shared/`.
const req = createRequire(join(process.cwd(), 'index.js'))
const ts = req('typescript') as typeof import('typescript')

const target = process.argv[2] ?? '.'
const SHARED = process.cwd()
const root = join(SHARED, target)

function findTsx(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const full = join(dir, e)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...findTsx(full))
    else if (e.endsWith('.tsx') && !e.endsWith('.stories.tsx') && !e.endsWith('.test.tsx')) out.push(full)
  }
  return out
}

// the single JSX element a component returns, if any
function soleReturnedElement(fn: ts.FunctionLikeDeclaration): ts.JsxOpeningLikeElement | null {
  let body: ts.Node | undefined = fn.body
  if (!body) return null
  // arrow with expression body: () => <X/>
  if (!ts.isBlock(body)) {
    const e = unwrap(body as ts.Expression)
    return jsxOpeningOf(e)
  }
  // block body: find the LAST return statement (top level)
  let found: ts.JsxOpeningLikeElement | null = null
  for (const stmt of body.statements) {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      // ignore early `return null` guards; only the final element-returning one counts
      const el = jsxOpeningOf(unwrap(stmt.expression))
      if (el) found = el
    }
  }
  return found
}

function unwrap(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e)) e = e.expression
  return e
}

// A pass-through container forwards props to a view and renders NOTHING of its
// own: the returned element must be self-closing (or have no real children). An
// element WITH children is presentational content, not a pass-through.
function jsxOpeningOf(e: ts.Expression): ts.JsxOpeningLikeElement | null {
  if (ts.isJsxSelfClosingElement(e)) return e
  if (ts.isJsxElement(e)) {
    const hasChild = e.children.some(
      c => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces)
    )
    return hasChild ? null : e.openingElement
  }
  return null
}

function tagText(el: ts.JsxOpeningLikeElement): string {
  return el.tagName.getText()
}

// does this function call any hook (identifier starting with `use`)?
function callsHook(fn: ts.Node): boolean {
  let yes = false
  const walk = (n: ts.Node) => {
    if (yes) return
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText().split('.').pop() ?? ''
      if (/^use[A-Z]/.test(name)) yes = true
    }
    ts.forEachChild(n, walk)
  }
  ts.forEachChild(fn, walk)
  return yes
}

type Candidate = {
  file: string
  view: string
  viewImportPath: string
  hooks: boolean
  spread: boolean
}

function analyze(file: string): Candidate | null {
  const text = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  // map imported identifier -> module specifier (relative imports only)
  const imports = new Map<string, string>()
  // identifier -> true if locally declared component (so NOT an imported view)
  const localDecls = new Set<string>()

  sf.forEachChild(n => {
    if (ts.isImportDeclaration(n) && n.importClause && ts.isStringLiteral(n.moduleSpecifier)) {
      const spec = n.moduleSpecifier.text
      const c = n.importClause
      if (c.name) imports.set(c.name.text, spec) // default import
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const el of c.namedBindings.elements) imports.set(el.name.text, spec)
      }
    }
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) localDecls.add(n.name.text)
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) localDecls.add(d.name.text)
      }
    }
  })

  // find the default-exported component
  let defaultName: string | null = null
  let defaultFn: ts.FunctionLikeDeclaration | null = null
  sf.forEachChild(n => {
    if (ts.isExportAssignment(n) && !n.isExportEquals) {
      const e = unwrap(n.expression)
      if (ts.isIdentifier(e)) defaultName = e.text
      else if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) defaultFn = e
    }
    if (ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
        n.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      defaultFn = n
    }
  })
  if (!defaultFn && defaultName) {
    // resolve `const X = (..) => ..; export default X`
    sf.forEachChild(n => {
      if (ts.isVariableStatement(n)) {
        for (const d of n.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === defaultName && d.initializer) {
            const init = unwrap(d.initializer as ts.Expression)
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) defaultFn = init
          }
        }
      }
      if (ts.isFunctionDeclaration(n) && n.name?.text === defaultName) defaultFn = n
    })
  }
  if (!defaultFn) return null

  const el = soleReturnedElement(defaultFn)
  if (!el) return null
  const tag = tagText(el)
  // the rendered tag must be an imported component from a RELATIVE module (sibling view),
  // not a Kb.* primitive and not something declared locally in this file.
  if (tag.includes('.')) return null // Kb.Box2 etc
  if (!/^[A-Z]/.test(tag)) return null
  if (localDecls.has(tag) && !imports.has(tag)) return null
  const importPath = imports.get(tag)
  if (!importPath || !importPath.startsWith('.')) return null

  const spread = el.attributes.properties.some(a => ts.isJsxSpreadAttribute(a))

  return {
    file,
    view: tag,
    viewImportPath: importPath,
    hooks: callsHook(defaultFn),
    spread,
  }
}

// how many OTHER files import the rendered view (besides this container).
// >0 means the view is shared and merging the container into it is unsafe.
function viewImporters(containerFile: string, viewImportPath: string): number {
  const viewBase = basename(viewImportPath).replace(/\.tsx$/, '')
  return countImportsOf(viewBase, relative(SHARED, containerFile))
}

function externalImporters(file: string): number {
  // count files (outside this file) that import the container by path
  const base = basename(file).replace(/\.tsx$/, '')
  // require a path-segment boundary (slash before the name) so `container`
  // doesn't match every `*-container` import in the repo.
  return countImportsOf(base, relative(SHARED, file))
}

// count files importing `from '.../<name>'` (slash-bounded), excluding `exclude`.
function countImportsOf(name: string, exclude: string): number {
  if (!name || name === '.' || name === 'index') return -1 // too generic to count by name
  try {
    const out = execSync(
      `grep -rlnE --include='*.tsx' "from '[^']*/${name}'" . | grep -v "${exclude}" || true`,
      {cwd: SHARED, encoding: 'utf8'}
    )
    return out.trim() ? out.trim().split('\n').length : 0
  } catch {
    return -1
  }
}

const files = existsSync(root) && statSync(root).isDirectory() ? findTsx(root) : [root]
const candidates: Candidate[] = []
for (const f of files) {
  try {
    const c = analyze(f)
    if (c && c.hooks) candidates.push(c)
  } catch {
    // ignore parse errors
  }
}

if (candidates.length === 0) {
  console.log(`No pass-through container candidates found in ${target}.`)
} else {
  console.log(`Found ${candidates.length} pass-through container candidate(s) in ${target}:\n`)
  for (const c of candidates) {
    const ext = externalImporters(c.file)
    const viewReuse = viewImporters(c.file, c.viewImportPath)
    const rel = relative(SHARED, c.file)
    const named = /container/i.test(basename(c.file))
    const sibling = !c.viewImportPath.includes('/') || c.viewImportPath.startsWith('./')
    const fmt = (n: number) => (n < 0 ? '?(verify by hand — generic name)' : String(n))
    console.log(`${rel}`)
    console.log(`    renders: <${c.view} ${c.spread ? '{...props}' : '.../>'}  (from '${c.viewImportPath}')`)
    console.log(`    hooks: yes   container-named: ${named}   sibling-view: ${sibling}   view reused by: ${fmt(viewReuse)} other file(s)   container imported by: ${fmt(ext)}`)
    if (viewReuse > 0) {
      console.log(`    ⚠ view is reused by other files — merging would change those call sites. Likely a real adapter; SKIP unless you fold all consumers.`)
    } else if (!sibling) {
      console.log(`    ⚠ view lives in another feature dir (not a sibling). Merging container logic across features is usually wrong; SKIP unless this is genuinely the only consumer.`)
    } else {
      console.log(`    → merge hook+derivation into the view, delete this file, repoint container importer(s).`)
    }
    console.log('')
  }
  console.log(`The script flags candidates; you decide. Read both files, confirm the view is a 1:1 sibling, then merge per SKILL.md.`)
}
