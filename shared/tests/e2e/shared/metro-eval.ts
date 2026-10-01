// Evaluates JS inside a React Native debug build through Metro's inspector proxy
// (Runtime.evaluate over the page's debugger websocket). Only works against a debug build served
// by Metro. Shared by the iOS lifecycle flows and the Electron flows that need a second account.

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
  addEventListener: (type: 'error' | 'message' | 'open', listener: (e: {data?: unknown}) => void) => void
  close: () => void
  send: (data: string) => void
}
type NodeWebSocketCtor = new (url: string, opts: {headers: Record<string, string>}) => NodeWebSocket

export const inspectorPageFor = async (device: string, appId: string) => {
  const page = (await listInspectorPages()).filter(p => p.deviceName === device && p.appId === appId).at(-1)
  if (!page) throw new Error(`no Metro inspector page for ${device}`)
  return page
}

// Metro dev bundles register modules by path; this finds and requires one by that path.
const prelude = `const kbModule = name => { for (const [id, m] of __r.getModules()) if (m.verboseName === name) return __r(id); throw new Error('no module ' + name) };`

// Evaluates a synchronous function body in the page's JS runtime and returns its value. The body
// can call kbModule('<path under shared/>') to reach an app module.
export const evalInPage = async <R>(page: InspectorPage, body: string): Promise<R> => {
  const url = page.webSocketDebuggerUrl.replace('ws://localhost:', 'ws://127.0.0.1:')
  // The inspector proxy rejects connections without a local Origin; Node's WebSocket
  // takes headers as a non-standard option.
  const WS = (globalThis as unknown as {WebSocket: NodeWebSocketCtor}).WebSocket
  const ws = new WS(url, {headers: {Origin: metroOrigin}})
  try {
    return await new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('inspector evaluate timed out')), 10000)
      ws.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error('inspector connection failed'))
      })
      ws.addEventListener('open', () => {
        const expression = `(() => { ${prelude} ${body} })()`
        ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression, returnByValue: true}}))
      })
      ws.addEventListener('message', e => {
        const m = JSON.parse(String(e.data)) as EvalResponse
        if (m.id !== 1) return
        clearTimeout(timer)
        if (m.result?.exceptionDetails) {
          // text can be just "Uncaught"; the thrown error's message is in its description
          const {exception, text} = m.result.exceptionDetails
          reject(new Error(`app evaluate threw: ${[text, exception?.description].filter(Boolean).join(': ') || 'unknown'}`))
        } else {
          resolve(m.result?.result?.value as R)
        }
      })
    })
  } finally {
    ws.close()
  }
}
