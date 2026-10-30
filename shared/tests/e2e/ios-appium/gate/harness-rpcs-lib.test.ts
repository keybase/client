import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import {pausedAround} from './harness-rpcs-lib'

const recorder = (resumeFails = false) => {
  const log: Array<string> = []
  return {
    log,
    pause: async () => {
      log.push('pause')
      return Promise.resolve('tok')
    },
    resume: async (token: string) => {
      log.push(`resume ${token}`)
      if (resumeFails) throw new Error('the app reloaded')
      return Promise.resolve()
    },
  }
}

test('the recorder is paused while f runs, and resumed after it answers', async () => {
  const r = recorder()
  const got = await pausedAround(r, 'an ask', async () => {
    r.log.push('f')
    return Promise.resolve(7)
  })
  expect(got).toBe(7)
  expect(r.log).toEqual(['pause', 'f', 'resume tok'])
})

test('the recorder is resumed when f throws, and f’s error is the one thrown', async () => {
  const r = recorder(true)
  await expect(
    pausedAround(r, 'an ask', async () => {
      r.log.push('f')
      return Promise.reject(new Error('boom'))
    })
  ).rejects.toThrow('boom')
  expect(r.log).toEqual(['pause', 'f', 'resume tok'])
})

test('a resume that fails after f answers names what was paused', async () => {
  const r = recorder(true)
  await expect(pausedAround(r, 'the configured-accounts ask', async () => Promise.resolve(1))).rejects.toThrow(
    /the configured-accounts ask.*the app reloaded/
  )
})

// What makes the app send an RPC from inside an eval: an `...RpcPromise` call or a store's account
// switch (which signs in).
const SENDS = /RpcPromise|switchToAccount/

const callee = (n: ts.Node) =>
  ts.isCallExpression(n) && ts.isIdentifier(n.expression) ? n.expression.text : undefined

const within = (n: ts.Node, name: string) => {
  for (let p = n.parent as ts.Node | undefined; p; p = p.parent) if (callee(p) === name) return true
  return false
}

const isLiteral = (n: ts.Node) => ts.isStringLiteralLike(n) || ts.isTemplateExpression(n)
const literalText = (n: ts.Node, sf: ts.SourceFile) =>
  ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n)
    ? n.text
    : ts.isTemplateExpression(n)
      ? [n.head, ...n.templateSpans.map(s => s.literal)].map(l => l.text).join('')
      : n.getText(sf)

// the top-level declaration a node sits in, for a body builder such as `const askBody = (x) => \`...\``
const declaredName = (n: ts.Node): string | undefined => {
  for (let p = n.parent as ts.Node | undefined; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && ts.isSourceFile(p.parent) && p.name) return p.name.text
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && ts.isSourceFile(p.parent.parent.parent)) return p.name.text
  }
  return undefined
}

// a literal naming a send, or a use of a body builder (not its own declared name)
const sends = (n: ts.Node, sf: ts.SourceFile, builders: ReadonlySet<string>) =>
  (isLiteral(n) && SENDS.test(literalText(n, sf))) ||
  (ts.isIdentifier(n) && builders.has(n.text) && !((ts.isVariableDeclaration(n.parent) || ts.isFunctionDeclaration(n.parent)) && n.parent.name === n))

const walk = (n: ts.Node, f: (n: ts.Node) => void) => {
  f(n)
  n.forEachChild(c => walk(c, f))
}
const some = (n: ts.Node, f: (n: ts.Node) => boolean): boolean => f(n) || !!n.forEachChild(c => some(c, f) || undefined)

// Every jsEval whose body sends an RPC (an eval body naming one, or a body builder declared from one)
// and is not inside withHarnessRpcs, as file:line.
const unpausedHarnessEvals = (files: ReadonlyArray<{file: string; text: string}>) => {
  const sfs = files.map(f => ({file: f.file, sf: ts.createSourceFile(f.file, f.text, ts.ScriptTarget.Latest, true)}))
  // body builders: top-level declarations holding a sending literal outside any jsEval, found to a fixed point
  const builders = new Set<string>()
  const newBuilders = () => {
    const names = new Set<string>()
    for (const {sf} of sfs) {
      walk(sf, n => {
        if (!sends(n, sf, builders) || within(n, 'jsEval')) return
        const name = declaredName(n)
        if (name && !builders.has(name)) names.add(name)
      })
    }
    return names
  }
  for (let more = newBuilders(); more.size; more = newBuilders()) for (const name of more) builders.add(name)
  const found: Array<string> = []
  for (const {file, sf} of sfs) {
    walk(sf, n => {
      if (!ts.isCallExpression(n) || callee(n) !== 'jsEval') return
      if (n.arguments.some(a => some(a, x => sends(x, sf, builders))) && !within(n, 'withHarnessRpcs')) {
        found.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`)
      }
    })
  }
  return {builders, found}
}

const sources = (dir: string) =>
  fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => ({file: path.join(path.basename(dir), f), text: fs.readFileSync(path.join(dir, f), 'utf8')}))

test('no eval body in the gate or its helpers sends an RPC from inside the app outside withHarnessRpcs', () => {
  const files = [...sources(__dirname), ...sources(path.join(__dirname, '..', 'helpers'))]
  const {builders, found} = unpausedHarnessEvals(files)
  // the scan sees the known harness bodies, so an empty answer is not a scan that matched nothing
  expect(builders.has('configuredAccountsAskBody')).toBe(true)
  expect(files.some(f => f.text.includes('withHarnessRpcs(') && f.text.includes('switchToAccount'))).toBe(true)
  expect(found).toEqual([])
})

test('the scan finds an inline sending body and a body builder outside withHarnessRpcs, and passes them inside it', () => {
  const builder = "export const askBody = (x: string) => `kbModule('a').loginGetConfiguredAccountsRpcPromise(${x})`"
  const uses = [
    "const a = async () => jsEval(`kbModule('b').useConfigState.getState().dispatch.switchToAccount('u')`)",
    'const b = async () => jsEval(askBody("1"))',
    "const c = async () => withHarnessRpcs('ask', async () => jsEval(askBody('2')))",
    "const d = async () => withHarnessRpcs('switch', async () => jsEval(`switchToAccount('u')`))",
    'const e = async () => jsEval(`return globalThis.__kbE2ERuntime`)',
  ].join('\n')
  const {found} = unpausedHarnessEvals([
    {file: 'lib.ts', text: builder},
    {file: 'use.ts', text: uses},
  ])
  expect(found).toEqual(['use.ts:1', 'use.ts:2'])
})
