// Lists every route the app registers by reading the route maps in `*/routes.tsx` and
// `router-v2/routes.tsx` (exported `defineRouteMap({...})` consts). Source-only, no typechecker:
//   name       the object key; a computed key like `[Settings.settingsAboutTab]` resolves to the
//              string constant it names when that is an `export const` in constants/ or stores/
//   modal      the map's export name contains "modal"
//   hasParams  approximation: the entry is a `makeScreen(...)` call, which is how a screen with
//              typed route params is declared; a plain `{screen}` object takes none
// A spread of a map defined in the same file without an export (`...sharedNewModalRoutes`), or of an
// inline conditional (`...(__DEV__ ? {...} : {})`), is listed with the map it is spread into; a
// spread of an exported or imported map is listed from where that map is defined.
import {readdirSync, readFileSync, existsSync} from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import {parse} from '@babel/parser'
import type {Node, ObjectExpression, ObjectProperty, ObjectMethod} from '@babel/types'

export type RouteInfo = {name: string; file: string; modal: boolean; hasParams: boolean}

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const parseSrc = (src: string) => parse(src, {sourceType: 'module', plugins: ['typescript', 'jsx']})

const routeFiles = () => {
  const files: Array<string> = []
  for (const d of readdirSync(sharedDir, {withFileTypes: true})) {
    if (!d.isDirectory() || d.name === 'node_modules') continue
    const rel = `${d.name}/routes.tsx`
    if (existsSync(path.join(sharedDir, rel))) files.push(rel)
  }
  const nested = 'login/signup/routes.tsx'
  if (existsSync(path.join(sharedDir, nested)) && !files.includes(nested)) files.push(nested)
  return files.sort()
}

let constCache: Map<string, string> | undefined
const stringConsts = () => {
  if (constCache) return constCache
  const m = new Map<string, string>()
  for (const dir of ['constants', 'stores']) {
    const full = path.join(sharedDir, dir)
    if (!existsSync(full)) continue
    for (const f of readdirSync(full)) {
      if (!/\.tsx?$/.test(f)) continue
      const src = readFileSync(path.join(full, f), 'utf8')
      for (const mm of src.matchAll(/^export const (\w+)\s*=\s*(['"])([^'"\n]*)\2/gm)) {
        const [, name, , value] = mm
        if (name && value !== undefined && !m.has(name)) m.set(name, value)
      }
    }
  }
  constCache = m
  return m
}

const keyName = (p: ObjectProperty | ObjectMethod): string | undefined => {
  const k = p.key
  if (!p.computed) {
    if (k.type === 'Identifier') return k.name
    if (k.type === 'StringLiteral') return k.value
    return undefined
  }
  if (k.type === 'StringLiteral') return k.value
  const ident = k.type === 'Identifier' ? k.name : k.type === 'MemberExpression' && k.property.type === 'Identifier' ? k.property.name : undefined
  return ident ? (stringConsts().get(ident) ?? ident) : undefined
}

const isMakeScreen = (n: Node): boolean => {
  if (n.type !== 'CallExpression') return false
  const c = n.callee
  return (
    (c.type === 'Identifier' && c.name === 'makeScreen') ||
    (c.type === 'MemberExpression' && c.property.type === 'Identifier' && c.property.name === 'makeScreen')
  )
}

// A value that is a conditional picks params if either branch does.
const valueHasParams = (n: Node): boolean => {
  if (n.type === 'ConditionalExpression') return valueHasParams(n.consequent) || valueHasParams(n.alternate)
  return isMakeScreen(n)
}

const mapArg = (n: Node | null | undefined): ObjectExpression | undefined => {
  if (n?.type !== 'CallExpression') return undefined
  const callee = n.callee
  if (callee.type !== 'Identifier' || callee.name !== 'defineRouteMap') return undefined
  const arg = n.arguments[0]
  return arg?.type === 'ObjectExpression' ? arg : undefined
}

// The object literals a spread argument stands for: a local unexported const's initializer, or the
// object branches of a conditional.
const spreadObjects = (n: Node, locals: Map<string, ObjectExpression>): Array<ObjectExpression> => {
  if (n.type === 'ObjectExpression') return [n]
  if (n.type === 'Identifier') {
    const o = locals.get(n.name)
    return o ? [o] : []
  }
  if (n.type === 'ConditionalExpression') return [...spreadObjects(n.consequent, locals), ...spreadObjects(n.alternate, locals)]
  return []
}

type Parsed = {ast: ReturnType<typeof parseSrc>; locals: Map<string, ObjectExpression>; imports: Map<string, {from: string; name: string}>}

const parsed = new Map<string, Parsed>()
const parseFile = (file: string): Parsed => {
  const hit = parsed.get(file)
  if (hit) return hit
  const ast = parseSrc(readFileSync(path.join(sharedDir, file), 'utf8'))
  const locals = new Map<string, ObjectExpression>()
  const imports = new Map<string, {from: string; name: string}>()
  for (const stmt of ast.program.body) {
    if (stmt.type === 'ImportDeclaration') {
      for (const sp of stmt.specifiers) {
        if (sp.type !== 'ImportSpecifier') continue
        const name = sp.imported.type === 'Identifier' ? sp.imported.name : sp.imported.value
        imports.set(sp.local.name, {from: stmt.source.value, name})
      }
      continue
    }
    // an exported const is a map too: `export const newRoutes = {...}` is spread into other files
    const decl0 = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt
    if (decl0?.type !== 'VariableDeclaration') continue
    for (const decl of decl0.declarations) {
      if (decl.id.type !== 'Identifier') continue
      const obj = decl.init?.type === 'ObjectExpression' ? decl.init : mapArg(decl.init)
      if (obj) locals.set(decl.id.name, obj)
    }
  }
  const out = {ast, imports, locals}
  parsed.set(file, out)
  return out
}

// The file (relative to shared/) an import specifier names; relative or the `@/` alias.
const resolveImport = (from: string, spec: string): string | undefined => {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? path.join(path.dirname(from), spec) : undefined
  if (!base) return undefined
  for (const c of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (existsSync(path.join(sharedDir, c))) return c
  }
  return undefined
}

export function listRoutes(): Array<RouteInfo> {
  const out: Array<RouteInfo> = []
  const seen = new Set<string>()
  const addMap = (file: string, obj: ObjectExpression, modal: boolean) => {
    const {locals, imports} = parseFile(file)
    for (const p of obj.properties) {
      if (p.type === 'SpreadElement') {
        const arg = p.argument
        for (const o of spreadObjects(arg, locals)) addMap(file, o, modal)
        // a map imported from another module is listed with that module
        const imp = arg.type === 'Identifier' && !locals.has(arg.name) ? imports.get(arg.name) : undefined
        const target = imp ? resolveImport(file, imp.from) : undefined
        const exported = target ? parseFile(target).locals.get(imp?.name ?? '') : undefined
        if (target && exported) addMap(target, exported, modal)
        continue
      }
      const name = keyName(p)
      if (!name || seen.has(`${file}:${name}`)) continue
      seen.add(`${file}:${name}`)
      out.push({name, file, modal, hasParams: p.type === 'ObjectProperty' && valueHasParams(p.value)})
    }
  }
  for (const file of [...routeFiles(), 'router-v2/routes.tsx'].filter((f, i, a) => a.indexOf(f) === i)) {
    for (const stmt of parseFile(file).ast.program.body) {
      if (stmt.type !== 'ExportNamedDeclaration' || stmt.declaration?.type !== 'VariableDeclaration') continue
      for (const decl of stmt.declaration.declarations) {
        if (decl.id.type !== 'Identifier') continue
        const obj = mapArg(decl.init)
        if (obj) addMap(file, obj, /modal/i.test(decl.id.name))
      }
    }
  }
  return out
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const routes = listRoutes()
  const w = Math.max(...routes.map(r => r.name.length), 4)
  console.log(`${'name'.padEnd(w)}  modal  params  file`)
  for (const r of routes) {
    console.log(`${r.name.padEnd(w)}  ${r.modal ? 'yes  ' : 'no   '}  ${r.hasParams ? 'yes   ' : 'no    '}  ${r.file}`)
  }
  console.log(`\n${routes.length} routes`)
}
