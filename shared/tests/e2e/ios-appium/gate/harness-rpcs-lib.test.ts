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

// What makes the app send an RPC from inside an eval: an `...RpcPromise` call, a call through the
// engine's call port (for a method the app has no generated call for), a store's account switch
// (which signs in), or a chat send through the app's own send action.
const SENDS = /RpcPromise|getCallPort|switchToAccount|sendTextToConversation/

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

// the names declared or imported at the top of a file: a jsEval body held in any other name (a local
// variable) is one the scan cannot read
const topLevelNames = (sf: ts.SourceFile) => {
  const names = new Set<string>()
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) names.add(st.name.text)
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.add(d.name.text)
    }
    if (ts.isImportDeclaration(st)) {
      const b = st.importClause
      if (b?.name) names.add(b.name.text)
      if (b?.namedBindings && ts.isNamedImports(b.namedBindings)) for (const e of b.namedBindings.elements) names.add(e.name.text)
    }
  }
  return names
}

// Body builders that send no RPC, whose bodies the scan cannot see (they come from shared/ or take
// their text as arguments): a jsEval of any other call is one the scan cannot read.
const READ_ONLY_BUILDERS = new Set([
  'appLogMarkerBody',
  'appLogReadBody',
  'callsSinceBody',
  'errorCaptureBody',
  'resumeRecorderBody',
  'startRecorderBody',
  'takeRecorderBody',
  'topModalScreenBody',
])

const lineOf = (file: string, sf: ts.SourceFile, n: ts.Node) => `${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`

// Every jsEval outside withHarnessRpcs whose body sends an RPC (an eval body naming one, or a body
// builder declared from one) or is one the scan cannot read: held in a name that is not top-level,
// built by a call not on READ_ONLY_BUILDERS, or any other expression that is not a literal. As file:line.
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
    const topLevel = topLevelNames(sf)
    walk(sf, n => {
      if (!ts.isCallExpression(n) || callee(n) !== 'jsEval' || within(n, 'withHarnessRpcs')) return
      // the body is the first argument (a second names the device)
      const [body] = n.arguments
      const readable = (b: ts.Node) =>
        isLiteral(b) ||
        (ts.isIdentifier(b) && topLevel.has(b.text)) ||
        (ts.isCallExpression(b) && READ_ONLY_BUILDERS.has(callee(b) ?? ''))
      const unread = !!body && !readable(body)
      if (unread || n.arguments.some(a => some(a, x => sends(x, sf, builders)))) found.push(lineOf(file, sf, n))
    })
  }
  return {builders, found}
}

// The file holding the retrying eval wrapper and askApp.
const APP_ASK = path.join('gate', 'app-ask.ts')

// Every call of the raw eval (lifecycle's jsEval, imported as jsEvalOnce) outside the retrying
// wrapper in gate/app-ask.ts, which the scan above sees as jsEval.
const rawEvalCalls = (files: ReadonlyArray<{file: string; text: string}>) => {
  const found: Array<string> = []
  for (const f of files) {
    const sf = ts.createSourceFile(f.file, f.text, ts.ScriptTarget.Latest, true)
    walk(sf, n => {
      if (callee(n) !== 'jsEvalOnce') return
      if (f.file !== APP_ASK || declaredName(n) !== 'jsEval') found.push(lineOf(f.file, sf, n))
    })
  }
  return found
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
  // askApp's typed bodies in gate/app-ask.ts, and the chat helpers' asks through it
  for (const b of [
    'filesSettings',
    'setFilesSettings',
    'folderSyncConfig',
    'setFolderSyncConfig',
    'appSkinTone',
    'rememberPassphrase',
    'setRememberPassphrase',
    'proxyData',
    'setProxyData',
    'guiValue',
    'guiSetValue',
    'guiClearValue',
    'compressPreference',
    'setCompressPreference',
    'randomPW',
    'setDebugLevel',
    'toggleRuntimeStats',
    'runtimeStatsEnabled',
    'phoneReachesServer',
    'archiveJobStates',
    'removeArchiveJobs',
  ]) {
    expect(builders.has(b)).toBe(true)
  }
  expect(files.some(f => f.text.includes('withHarnessRpcs(') && f.text.includes('switchToAccount'))).toBe(true)
  // the location flow's harness stop, a body builder the scan must see
  expect(builders.has('stopLocationBody')).toBe(true)
  expect(found).toEqual([])
  expect(rawEvalCalls(files)).toEqual([])
})

test("the scan flags askApp's eval once it is outside withHarnessRpcs", () => {
  const files = [...sources(__dirname), ...sources(path.join(__dirname, '..', 'helpers'))]
  const appAsk = files.find(f => f.file === APP_ASK)
  expect(appAsk?.text).toContain('jsEval(appAskBody(')
  const unpaused = files.map(f => (f === appAsk ? {...f, text: f.text.replace('withHarnessRpcs(what,', 'unpaused(what,')} : f))
  expect(unpaused.find(f => f.file === APP_ASK)?.text).not.toContain('withHarnessRpcs(')
  const {found} = unpausedHarnessEvals(unpaused)
  expect(found).toHaveLength(1)
  expect(found[0]).toMatch(new RegExp(`^${APP_ASK}:\\d+$`))
})

test('the scan finds an inline sending body and a body builder outside withHarnessRpcs, and passes them inside it', () => {
  const builder = "export const askBody = (x: string) => `kbModule('a').loginGetConfiguredAccountsRpcPromise(${x})`"
  const uses = [
    "const a = async () => jsEval(`kbModule('b').useConfigState.getState().dispatch.switchToAccount('u')`)",
    'const b = async () => jsEval(askBody("1"))',
    "const c = async () => withHarnessRpcs('ask', async () => jsEval(askBody('2')))",
    "const d = async () => withHarnessRpcs('switch', async () => jsEval(`switchToAccount('u')`))",
    'const e = async () => jsEval(`return globalThis.__kbE2ERuntime`)',
    'const f = async () => { const body = askBody("3"); return jsEval(body) }',
    "const g = async () => { const body = askBody('4'); return withHarnessRpcs('ask', async () => jsEval(body)) }",
    'const h = async () => jsEval(readBody)',
    'const readBody = `return 1`',
    "const i = async (call: string) => jsEval(appAskBody('5', call))",
    "const j = async (call: string) => withHarnessRpcs('ask', async () => jsEval(appAskBody('6', call)))",
    'const k = async () => jsEval(callsSinceBody(7))',
    "const l = async (x: boolean) => jsEval(x ? readBody : 'return 2')",
    "const m = async () => jsEval(`kbModule('engine/call-port.tsx').getCallPort().call({method: 'keybase.1.config.guiClearValue'})`)",
  ].join('\n')
  const {found} = unpausedHarnessEvals([
    {file: 'lib.ts', text: builder},
    {file: 'use.ts', text: uses},
  ])
  expect(found).toEqual(['use.ts:1', 'use.ts:2', 'use.ts:6', 'use.ts:10', 'use.ts:13', 'use.ts:14'])
})

test('the raw eval is called only by the retrying wrapper', () => {
  const wrapper = 'export const jsEval = async (body: string) => jsEvalOnce(body)'
  const other = 'export const read = async () => jsEvalOnce(`return 1`)'
  expect(rawEvalCalls([{file: APP_ASK, text: wrapper}])).toEqual([])
  expect(rawEvalCalls([{file: APP_ASK, text: wrapper + '\n' + other}])).toEqual(['gate/app-ask.ts:2'])
  expect(rawEvalCalls([{file: path.join('helpers', 'chat.ts'), text: wrapper + '\n' + other}])).toEqual(['helpers/chat.ts:1', 'helpers/chat.ts:2'])
})
