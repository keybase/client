// The parts of the main-process connection (main-process.ts) that are plain data: what the
// inspector lists, the CDP messages, and which process and sockets to act on.

export const INSPECTOR_HOST = '127.0.0.1'
export const INSPECTOR_PORT = 9229
export const inspectorListUrl = `http://${INSPECTOR_HOST}:${INSPECTOR_PORT}/json/list`

// The `node` target's debugger URL from the inspector's /json/list. Only one on 127.0.0.1: the
// inspector runs code in the main process for whoever connects.
export const inspectorUrl = (listJson: unknown): string => {
  const targets = Array.isArray(listJson) ? (listJson as Array<{type?: unknown; webSocketDebuggerUrl?: unknown}>) : []
  const url = targets.find(t => t.type === 'node')?.webSocketDebuggerUrl
  if (typeof url !== 'string') throw new Error(`the inspector at ${inspectorListUrl} lists no node target: ${JSON.stringify(listJson)}`)
  if (new URL(url).hostname !== INSPECTOR_HOST) throw new Error(`the inspector is not on ${INSPECTOR_HOST}: ${url}`)
  return url
}

// A Runtime.evaluate of `expr` with `Electron` (the electron module) and `require` in scope, its
// promise awaited and its value returned as JSON. The main bundle keeps neither as a global, and a
// bare `require` is not defined at the inspector's top level.
export const cdpEvaluate = (id: number, expr: string) =>
  JSON.stringify({
    id,
    method: 'Runtime.evaluate',
    params: {
      awaitPromise: true,
      expression: `(async () => {
  const require = process.mainModule.require.bind(process.mainModule)
  const Electron = require('electron')
  return (${expr})
})()`,
      returnByValue: true,
    },
  })

type EvaluateReply = {
  id?: number
  error?: {message?: string}
  result?: {
    result?: {value?: unknown}
    exceptionDetails?: {text?: string; exception?: {description?: string}}
  }
}

// The evaluated value, or a throw with the exception's text (and its description, which names the error).
export const parseEvaluateReply = (msg: unknown): unknown => {
  const m = msg as EvaluateReply
  if (m.error) throw new Error(`Runtime.evaluate failed: ${m.error.message ?? JSON.stringify(m.error)}`)
  const ex = m.result?.exceptionDetails
  if (ex) throw new Error(`in the main process: ${[ex.text, ex.exception?.description].filter(Boolean).join(': ')}`)
  return m.result?.result?.value
}

// The Electron main process in the app's process group, from `ps -A -o pid=,pgid=,command=`: the
// one running the Electron binary itself, not a helper.
export const electronMainPid = (ps: string, pgid: number): number => {
  for (const line of ps.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (!m || Number(m[2]) !== pgid) continue
    // a helper's binary is ".../Electron Helper (Renderer).app/Contents/MacOS/Electron Helper ...",
    // which a bare "/Contents/MacOS/Electron" followed by a space matches too
    if (/\/Electron\.app\/Contents\/MacOS\/Electron(\s|$)/.test(m[3] ?? '')) return Number(m[1])
  }
  throw new Error(`no Electron main process in the app's process group ${pgid}; relaunch with node tests/e2e/electron/launch-app.mts`)
}

// The fds `pid` holds whose other end is a socket bound to `socketPath`, from `lsof -nP -U`: lsof
// names the listening side's sockets by path and the connecting side's by its peer's address.
export const serviceSocketFds = (lsof: string, pid: number, socketPath: string): Array<number> => {
  const rows = lsof
    .split('\n')
    .map(line => /^\S+\s+(\d+)\s+\S+\s+(\d+)\w*\s+unix\s+(0x[0-9a-f]+)\s+\S+\s+(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => !!m)
    .map(m => ({addr: m[3] ?? '', fd: Number(m[2]), name: (m[4] ?? '').trim(), pid: Number(m[1])}))
  const bound = new Set(rows.filter(r => r.name === socketPath).map(r => r.addr))
  return rows.filter(r => r.pid === pid && r.name.startsWith('->') && bound.has(r.name.slice(2))).map(r => r.fd)
}

// Whether the macOS console session is locked, from `ioreg -n Root -d1`. A locked session refuses
// a window's native fullscreen: the window starts entering and drops back at once, with no
// 'enter-full-screen'.
export const consoleLocked = (ioreg: string): boolean => {
  const m = /"IOConsoleLocked" = (Yes|No)\b/.exec(ioreg)
  if (!m) throw new Error('ioreg -n Root -d1 does not report IOConsoleLocked')
  return m[1] === 'Yes'
}
