// Evaluates JS inside a React Native debug build through Metro's inspector proxy
// (Runtime.evaluate over the page's debugger websocket). Only works against a debug build served
// by Metro. Shared by the iOS lifecycle flows and the Electron flows that need a second account.
import {harnessSite, timed, timingOn} from './gate/timing.ts'

export const metroOrigin = process.env['KB_METRO_ORIGIN'] ?? 'http://127.0.0.1:8081'

export type InspectorPage = {appId?: string; deviceName?: string; title?: string; webSocketDebuggerUrl: string}

type EvalResponse = {
  id: number
  result?: {result?: {value?: unknown}; exceptionDetails?: {exception?: {description?: string}; text?: string}}
}

// Metro keeps a page per JS runtime the device has started; the newest is last.
export const listInspectorPages = async (timeoutMs = 3000): Promise<Array<InspectorPage>> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer from ${metroOrigin} in ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    const res = await Promise.race([fetch(`${metroOrigin}/json/list`), timeout])
    return (await res.json()) as Array<InspectorPage>
  } finally {
    clearTimeout(timer)
  }
}

// Node's WebSocket, described here: this file is also type-checked against react-native's globals,
// whose WebSocket differs.
type NodeWebSocket = {
  addEventListener: (type: 'close' | 'error' | 'message' | 'open', listener: (e: {data?: unknown}) => void) => void
  close: () => void
  send: (data: string) => void
}
type NodeWebSocketCtor = new (url: string, opts: {headers: Record<string, string>}) => NodeWebSocket

export const NO_INSPECTOR_PAGE = 'no Metro inspector page'
// Metro closes a debugger socket when the app's own inspector socket drops (or the page is gone), so
// an eval it closes before answering may or may not have run.
export const INSPECTOR_CLOSED = 'inspector connection closed before answering'
// Whether `message` says the app's inspector page went away, as opposed to the app failing an eval.
export const lostInspectorPage = (message: string | undefined) =>
  !!message && (message.includes(NO_INSPECTOR_PAGE) || message.includes(INSPECTOR_CLOSED))

// The newest of `pages` for the device and app. When there is none, the error says what Metro did
// list: nothing (the app's inspector socket is closed) or other targets (a different device or app).
export const pickInspectorPage = (pages: ReadonlyArray<InspectorPage>, device: string, appId: string) => {
  const page = pages.filter(p => p.deviceName === device && p.appId === appId).at(-1)
  if (!page) {
    const listed = pages.map(p => `${p.deviceName ?? '?'}/${p.appId ?? '?'}/${p.title ?? '?'}`).join(', ') || 'nothing'
    throw new Error(`${NO_INSPECTOR_PAGE} for ${device} (Metro lists ${listed})`)
  }
  return page
}

export const inspectorPageFor = async (device: string, appId: string) =>
  pickInspectorPage(await listInspectorPages(), device, appId)

export type WaitClock = {now: () => number; sleep: (ms: number) => Promise<void>}
const realClock: WaitClock = {now: () => Date.now(), sleep: async ms => new Promise(resolve => setTimeout(resolve, ms))}

// Runs a side-effect-free `f` (a page lookup, a read) until it answers, trying it again every
// `intervalMs` for up to `ms` while it fails in a way `retryIf` accepts (any failure when there is
// none). A failure it does not accept, or the last one at the bound, is thrown, prefixed with `what`
// when given. Never for a body that changes anything: one that already ran may have done it.
export const retryFor = async <R,>(
  f: () => Promise<R>,
  opts: {ms: number; intervalMs: number; retryIf?: (e: Error) => boolean; what?: string; clock?: WaitClock}
): Promise<R> => {
  const clock = opts.clock ?? realClock
  const end = clock.now() + opts.ms
  for (;;) {
    try {
      return await f()
    } catch (e) {
      const err = e as Error
      if ((opts.retryIf && !opts.retryIf(err)) || clock.now() >= end) {
        throw opts.what ? new Error(`${opts.what}: ${err.message}`, {cause: e}) : e
      }
      await clock.sleep(opts.intervalMs)
    }
  }
}

// While the app's inspector socket flaps, a lookup can find the page and the eval's socket still be
// closed under it: a read is tried again on that alone.
export const whileLost = (e: Error) => lostInspectorPage(e.message)

// The id of the module Metro registered as `name`: an exact verboseName first, then, for a
// node_modules/ name, the one that ends with it, and more than one is an error (a worktree whose node_modules is a symlink makes Metro
// name them relative to the other checkout, `../../client/shared/node_modules/...`). Runs in the page
// too, so it closes over nothing.
export const findModuleId = <Id,>(modules: Iterable<[Id, {verboseName?: string}]>, name: string): Id | undefined => {
  const all = [...modules]
  const exact = all.find(([, m]) => m.verboseName === name)
  if (exact) return exact[0]
  if (!name.startsWith('node_modules/')) return undefined
  const matches = all.filter(([, m]) => String(m.verboseName).endsWith('/' + name))
  if (matches.length > 1) throw new Error('ambiguous module ' + name + ': ' + String(matches.length) + ' matches')
  return matches[0]?.[0]
}

// Metro dev bundles register modules by path; this finds and requires one by that path.
const prelude = `const findModuleId = ${findModuleId.toString()}; const kbModule = name => { const id = findModuleId(__r.getModules(), name); if (id === undefined) throw new Error('no module ' + name); return __r(id) };`

// A stretch this long of the evaluated code, repeated in a failed eval's report, withholds that line.
const QUOTED_RUN = 20
export const WITHHELD_LINE = '(a line repeating the evaluated code, withheld)'

// `report` with every line that repeats a QUOTED_RUN-character stretch of `code` withheld. An eval's
// code can carry a secret (the text setPasteboard writes, a secret field's value), and a message the
// app builds from that data must not take it into an error. Hermes quotes no source in its reports, so
// what this withholds is a message built from the code's own data, or a long message the code spells out.
// Compared lowercased: the app can lowercase what it is given (the join field does) before quoting it.
export const withholdQuotedCode = (report: string, code: string) => {
  const lower = code.toLowerCase()
  const runs = new Set<string>()
  for (let i = 0; i + QUOTED_RUN <= lower.length; i++) runs.add(lower.slice(i, i + QUOTED_RUN))
  const quotes = (line: string) => {
    const l = line.toLowerCase()
    for (let i = 0; i + QUOTED_RUN <= l.length; i++) if (runs.has(l.slice(i, i + QUOTED_RUN))) return true
    return false
  }
  return report
    .split('\n')
    .map(line => (quotes(line) ? WITHHELD_LINE : line))
    .join('\n')
}

// Evaluates a synchronous function body in the page's JS runtime and returns its value. The body
// can call kbModule('<path under shared/>') to reach an app module. A failure's error never repeats the
// body (withholdQuotedCode), and nothing here logs it.
export const evalInPage = async <R>(page: InspectorPage, body: string): Promise<R> => timed('eval', 'eval', async () => evalInPageUntimed<R>(page, body), timingOn() ? harnessSite() : '')

const evalInPageUntimed = async <R>(page: InspectorPage, body: string): Promise<R> => {
  const url = page.webSocketDebuggerUrl.replace('ws://localhost:', 'ws://127.0.0.1:')
  // The inspector proxy rejects connections without a local Origin; Node's WebSocket
  // takes headers as a non-standard option.
  const WS = (globalThis as unknown as {WebSocket: NodeWebSocketCtor}).WebSocket
  const ws = new WS(url, {headers: {Origin: metroOrigin}})
  try {
    const expression = `(() => { ${prelude} ${body} })()`
    return await new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('inspector evaluate timed out')), 10000)
      ws.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error('inspector connection failed'))
      })
      // after an answer or an error this is a no-op: the promise has settled
      ws.addEventListener('close', () => {
        clearTimeout(timer)
        reject(new Error(INSPECTOR_CLOSED))
      })
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression, returnByValue: true}}))
      })
      ws.addEventListener('message', e => {
        const m = JSON.parse(String(e.data)) as EvalResponse
        if (m.id !== 1) return
        clearTimeout(timer)
        if (m.result?.exceptionDetails) {
          // text can be just "Uncaught"; the thrown error's message is in its description
          const {exception, text} = m.result.exceptionDetails
          const report = [text, exception?.description].filter(Boolean).join(': ') || 'unknown'
          reject(new Error(`app evaluate threw: ${withholdQuotedCode(report, expression)}`))
        } else {
          resolve(m.result?.result?.value as R)
        }
      })
    })
  } finally {
    ws.close()
  }
}
