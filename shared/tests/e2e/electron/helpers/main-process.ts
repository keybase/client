// Code run in the dev app's Electron main process, for what the renderer cannot reach: its native
// dialogs and notifications, the URLs the OS hands it, its clipboard and its service socket.
//
// It goes through the main process's Node inspector, opened by SIGUSR1 (Node's own signal for it)
// on 127.0.0.1:9229, and CDP Runtime.evaluate. The inspector runs any code it is sent in the main
// process for anyone on this machine who connects, so only the e2e harness opens it, and closes it
// once done: the flows' worker teardown (fixtures.ts) and the release's end (closeMainInspector).
import {execFileSync} from 'child_process'
import {readAppPidfile} from '../app-pidfile.ts'
import {withDeadline} from '../../shared/deadline.ts'
import {mainSocketPath} from '../../shared/peer-service.ts'
import {cdpEvaluate, consoleLocked, electronMainPid, inspectorListUrl, inspectorUrl, INSPECTOR_PORT, parseEvaluateReply, serviceSocketFds} from './main-process-lib.ts'

export type MainProcess = {
  eval: <T>(expr: string) => Promise<T>
  stubOpenDialog: (paths: ReadonlyArray<string>) => Promise<void>
  stubSaveDialog: (path: string) => Promise<void>
  stubFocusedWindow: () => Promise<void>
  recordNotifications: () => Promise<void>
  takeNotifications: () => Promise<Array<{title: string; body: string}>>
  openUrl: (link: string) => Promise<void>
  recordExternalUrls: () => Promise<boolean>
  takeExternalUrls: () => Promise<Array<string>>
  clipboardText: () => Promise<string>
  stubClipboardImage: (path: string) => Promise<void>
  dropServiceSocket: () => Promise<number>
  restore: () => Promise<void>
  close: () => void
}

const EVAL_MS = 10_000
const OPEN_MS = 5_000

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const appMainPid = () => {
  const recorded = readAppPidfile()
  if (!recorded) throw new Error('no app pidfile: launch the app with node tests/e2e/electron/launch-app.mts')
  const ps = execFileSync('ps', ['-A', '-o', 'pid=,pgid=,command='], {encoding: 'utf8', timeout: 5_000})
  return electronMainPid(ps, recorded.pgid)
}

// The pids listening on the inspector port ([] when none).
const inspectorListeners = () => {
  try {
    const out = execFileSync('lsof', ['-t', `-iTCP:${INSPECTOR_PORT}`, '-sTCP:LISTEN'], {encoding: 'utf8', timeout: 10_000})
    return out.split('\n').filter(Boolean).map(Number)
  } catch (e) {
    // lsof exits 1 with nothing said when no one listens
    if ((e as {status?: number}).status === 1 && !(e as {stdout?: string}).stdout) return []
    throw e
  }
}

const listTargets = async () => {
  const r = await withDeadline(fetch(inspectorListUrl), 2_000, `fetching ${inspectorListUrl}`)
  return (await r.json()) as unknown
}

// The main process's inspector URL, opening the inspector when it is not open. Refuses a listener
// on the port that is not the app's main process.
const openInspector = async (pid: number) => {
  const listeners = inspectorListeners()
  const other = listeners.find(p => p !== pid)
  if (other !== undefined) throw new Error(`port ${INSPECTOR_PORT} is held by pid ${other}, not the app's main process ${pid}; stop it`)
  if (!listeners.length) process.kill(pid, 'SIGUSR1')
  const start = Date.now()
  for (;;) {
    try {
      return inspectorUrl(await listTargets())
    } catch (e) {
      if (Date.now() - start > OPEN_MS) {
        throw new Error(`the app's main process (pid ${pid}) opened no inspector on ${INSPECTOR_PORT} within ${OPEN_MS / 1000}s after SIGUSR1: ${String(e)}`, {cause: e})
      }
      await sleep(100)
    }
  }
}

type Conn = {send: (expr: string) => Promise<unknown>; fire: (expr: string) => void; close: () => void; closed: Promise<void>}

const connect = async (url: string): Promise<Conn> => {
  const ws = new WebSocket(url)
  await withDeadline(
    new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), {once: true})
      ws.addEventListener('error', () => reject(new Error(`cannot connect to the main process inspector at ${url}`)), {once: true})
    }),
    OPEN_MS,
    'connecting to the main process inspector'
  )
  let seq = 0
  const pending = new Map<number, {resolve: (v: unknown) => void; reject: (e: Error) => void}>()
  const closed = new Promise<void>(resolve => {
    ws.addEventListener('close', () => {
      for (const p of pending.values()) p.reject(new Error('the main process inspector closed the connection'))
      pending.clear()
      resolve()
    })
  })
  ws.addEventListener('message', e => {
    const msg = JSON.parse(String(e.data)) as {id?: number}
    const p = msg.id === undefined ? undefined : pending.get(msg.id)
    if (!p || msg.id === undefined) return
    pending.delete(msg.id)
    try {
      p.resolve(parseEvaluateReply(msg))
    } catch (err) {
      p.reject(err as Error)
    }
  })
  const send = async (expr: string) => {
    const id = ++seq
    const reply = new Promise<unknown>((resolve, reject) => pending.set(id, {reject, resolve}))
    ws.send(cdpEvaluate(id, expr))
    try {
      return await withDeadline(reply, EVAL_MS, `evaluating in the main process: ${expr.slice(0, 80)}`)
    } finally {
      pending.delete(id)
    }
  }
  return {close: () => ws.close(), closed, fire: expr => ws.send(cdpEvaluate(++seq, expr)), send}
}

// State the stubs keep in the main process: each replaced function with its original, and the
// notifications and external URLs recorded since the last take.
const STATE = 'globalThis.__kbE2EMain'
const stateExpr = `(${STATE} ??= {saved: [], notes: [], urls: []})`

// Replaces `owner[key]` with `impl` (an expression), marked __kbStub, keeping the first original.
const stubExpr = (owner: string, key: string, impl: string) => `(() => {
  const s = ${stateExpr}
  const owner = ${owner}
  if (!owner[${JSON.stringify(key)}].__kbStub) s.saved.push({owner, key: ${JSON.stringify(key)}, original: owner[${JSON.stringify(key)}]})
  const f = ${impl}
  f.__kbStub = true
  owner[${JSON.stringify(key)}] = f
  return true
})()`

const restoreExpr = `(() => {
  const s = ${STATE}
  if (!s) return 0
  for (const {owner, key, original} of s.saved.reverse()) owner[key] = original
  delete ${STATE}
  return s.saved.length
})()`

let current: {conn: Conn; mp: MainProcess} | undefined

export const connectMainProcess = async (): Promise<MainProcess> => {
  if (current) return current.mp
  const pid = appMainPid()
  const conn = await connect(await openInspector(pid))
  // a relaunched app or a closed inspector drops the connection: the next call opens a new one
  void conn.closed.then(() => {
    if (current?.conn === conn) current = undefined
  })
  const run = async <T,>(expr: string) => (await conn.send(expr)) as T
  const stub = async (owner: string, key: string, impl: string) => {
    await run(stubExpr(owner, key, impl))
  }
  const mp: MainProcess = {
    clipboardText: async () => run<string>('Electron.clipboard.readText()'),
    close: () => {
      if (current?.conn === conn) current = undefined
      conn.close()
    },
    dropServiceSocket: async () => {
      const lsof = execFileSync('lsof', ['-nP', '-U'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 20_000})
      const fds = serviceSocketFds(lsof, pid, mainSocketPath())
      if (!fds.length) return 0
      return run<number>(`(() => {
  const fds = ${JSON.stringify(fds)}
  const hit = process._getActiveHandles().filter(h => h && h.constructor && h.constructor.name === 'Socket' && h._handle && fds.includes(h._handle.fd))
  for (const h of hit) h.destroy()
  return hit.length
})()`)
    },
    eval: run,
    openUrl: async link => {
      await run(`Electron.app.emit('open-url', {preventDefault() {}}, ${JSON.stringify(link)})`)
    },
    // Records each notification instead of showing it: the dev build's notifications reach the OS
    // only from a signed app, and a shown one would stay in Notification Center.
    recordNotifications: async () =>
      stub(
        'Electron.Notification.prototype',
        'show',
        `function () { ${stateExpr}.notes.push({title: String(this.title ?? ''), body: String(this.body ?? '')}) }`
      ),
    // Records each URL the app hands the OS to open instead of opening it, so no browser starts.
    // Resolves to whether the stub is in place.
    recordExternalUrls: async () => {
      await stub('Electron.shell', 'openExternal', `async url => { ${stateExpr}.urls.push(String(url)) }`)
      return run<boolean>('Electron.shell.openExternal.__kbStub === true')
    },
    restore: async () => {
      await run(restoreExpr)
    },
    // The app reads a pasted image from the clipboard in its main process (clipboard.read), not
    // from the paste event: this hands back the PNG or JPEG at `path` instead, and never writes the
    // system clipboard.
    stubClipboardImage: async path => {
      const type = /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : undefined
      if (!type) throw new Error(`stubClipboardImage: ${path} is not a PNG or JPEG`)
      await stub(
        'Electron.clipboard',
        'read',
        `async () => { const bytes = require('fs').readFileSync(${JSON.stringify(path)}); return [{types: [${JSON.stringify(type)}], getType: async () => new Blob([bytes], {type: ${JSON.stringify(type)}})}] }`
      )
    },
    // The app opens its upload picker only over the focused window, and a window driven in the
    // background has none: this answers with the main window.
    stubFocusedWindow: async () =>
      stub(
        'Electron.BrowserWindow',
        'getFocusedWindow',
        `() => Electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('main.html')) ?? null`
      ),
    stubOpenDialog: async paths => stub('Electron.dialog', 'showOpenDialog', `async () => ({canceled: false, filePaths: ${JSON.stringify(paths)}})`),
    stubSaveDialog: async path => stub('Electron.dialog', 'showSaveDialog', `async () => ({canceled: false, filePath: ${JSON.stringify(path)}})`),
    takeExternalUrls: async () => run<Array<string>>(`(() => { const s = ${stateExpr}; const u = s.urls; s.urls = []; return u })()`),
    takeNotifications: async () =>
      run<Array<{title: string; body: string}>>(`(() => { const s = ${stateExpr}; const n = s.notes; s.notes = []; return n })()`),
  }
  current = {conn, mp}
  return mp
}

// Whether the app runs with its main process's inspector open: only through it can a stub have been
// installed, by this process or by an earlier worker that died before restoring.
const inspectorOpen = () => {
  let pid: number
  try {
    pid = appMainPid()
  } catch {
    return false
  }
  return inspectorListeners().includes(pid)
}

// Puts back every stub in the main process, whoever installed it (restoreExpr is a no-op when none
// is there). Does nothing when the inspector is closed.
export const restoreMainProcessStubs = async () => {
  if (!inspectorOpen()) {
    current = undefined
    return
  }
  await (await connectMainProcess()).restore()
}

// Closes the main process's inspector, if it is open, so nothing can connect to it after the
// harness is done. Restores any stub first. Does nothing when no app is running.
export const closeMainInspector = async () => {
  if (!inspectorOpen()) {
    current = undefined
    return
  }
  const mp = await connectMainProcess()
  await mp.restore()
  const conn = current?.conn
  current = undefined
  if (!conn) return
  // the inspector drops this connection as it closes, so the evaluation never answers
  conn.fire(`require('inspector').close()`)
  await withDeadline(conn.closed, OPEN_MS, 'the main process closing its inspector')
}

// Whether the macOS session is locked (main-process-lib's consoleLocked).
export const sessionLocked = () => consoleLocked(execFileSync('ioreg', ['-n', 'Root', '-d1'], {encoding: 'utf8', timeout: 10_000}))

// The main window's own fullscreen transitions, as the main process reports them ('enter-full-screen',
// 'leave-full-screen'), from the call on: a video's fullscreen puts the window fullscreen too, about
// half a second after the video's fullscreenchange, and a reload before that ends leaves the window
// where the next video's fullscreen request is never answered.
const WINDOW_FULLSCREEN = 'globalThis.__kbE2EWindowFullscreen'
export const recordMainWindowFullscreen = async () => {
  if (sessionLocked()) {
    throw new Error('the macOS session is locked, and a locked session refuses the window its fullscreen; unlock it and rerun')
  }
  const main = await connectMainProcess()
  await main.eval(`(() => {
  const w = Electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('main.html'))
  if (!w) throw new Error('no main window')
  ${WINDOW_FULLSCREEN} = []
  for (const name of ['enter-full-screen', 'leave-full-screen']) w.once(name, () => ${WINDOW_FULLSCREEN}?.push(name))
  return true
})()`)
  return {
    stop: async () => main.eval(`(() => { delete ${WINDOW_FULLSCREEN}; return true })()`),
    transitions: async () => main.eval<Array<string>>(`${WINDOW_FULLSCREEN} ?? []`),
  }
}
