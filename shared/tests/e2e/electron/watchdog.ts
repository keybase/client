// The release run's renderer watchdog. While a phase drives the app it polls main.html every 5s over
// its own CDP connection to the page target (separate from Playwright's browser connection; it only
// reads, with Runtime.evaluate). A renderer that stays blank, missing or silent for 10s, or on the
// loading placeholder for 30s (past what a reload is allowed), is written up in
// tests/results/watchdog.log (time, phase, the renderer's last console errors, the app log's tail),
// reloaded once per run through checkRendererAfterReload, and reported as an incident: the run fails
// whether or not the reload brought it back. After that reload each phase writes up one more
// incident per state (blank, gone, unanswered); repeats of it are only counted.
import * as fs from 'fs'
import * as path from 'path'
import {chromium} from '@playwright/test'
import {checkRendererAfterReload, findMainPage} from './helpers/connect.ts'
import {
  emptyIncidentBook,
  incidentLines,
  nextWatch,
  noteAlarm,
  probeSample,
  WATCH_LOADING_THRESHOLD_MS,
  WATCH_THRESHOLD_MS,
  type BadKind,
  type RendererProbe,
  type WatchSample,
  type WatchState,
} from './release-lib.ts'

type CdpTarget = {type: string; url: string; webSocketDebuggerUrl: string}
type CdpMessage = {
  id?: number
  method?: string
  result?: {result?: {value?: unknown}; exceptionDetails?: unknown}
  error?: {message?: string}
  params?: {type?: string; args?: Array<{value?: unknown; description?: string}>; exceptionDetails?: {text?: string; exception?: {description?: string}}}
}

export type WatchdogOpts = {
  log: (s: string) => void
  logFile: string
  appLog: string
  cdpPort?: number
  pollMs?: number
  thresholdMs?: number
  loadingThresholdMs?: number
}

const probeExpression = `(() => {
  const r = document.getElementById('root')
  const kids = r ? Array.from(r.children) : []
  return {hasRoot: !!r, placeholderOnly: kids.length === 1 && kids[0].getAttribute('title') === 'loading...', rootChildren: kids.length}
})()`

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const tail = (file: string, lines: number) => {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(-lines).join('\n')
  } catch {
    return `(no log at ${file})`
  }
}

export const createWatchdog = (opts: WatchdogOpts) => {
  const cdpPort = opts.cdpPort ?? 9222
  const pollMs = opts.pollMs ?? 5_000
  const badMs = opts.thresholdMs ?? WATCH_THRESHOLD_MS
  const loadingMs = opts.loadingThresholdMs ?? WATCH_LOADING_THRESHOLD_MS
  let book = emptyIncidentBook()
  // the watchdog's own failures, each once
  const failures: Array<string> = []
  const incidents = () => [...incidentLines(book), ...failures]
  let phase = ''
  let running: Promise<void> | undefined
  let stopping = false
  const isStopping = () => stopping
  let polls = 0

  // the page target's connection, re-opened when its target changes or it closes
  // typed by what is used: the native tsconfig's WebSocket type differs from node's
  let ws: {send: (data: string) => void; close: () => void} | undefined
  let wsUrl = ''
  // bumped by every connect and close: a socket from an earlier one is closed if it opens late
  let generation = 0
  let nextId = 1
  const pending = new Map<number, (m: CdpMessage) => void>()
  const consoleErrors: Array<string> = []

  const closeWs = () => {
    generation++
    ws?.close()
    ws = undefined
    wsUrl = ''
    pending.clear()
  }

  const connect = async (url: string) =>
    new Promise<void>((resolve, reject) => {
      const gen = ++generation
      const sock = new WebSocket(url)
      const timer = setTimeout(() => {
        // abandoned: a late open is closed rather than left listening beside the next connection
        generation++
        sock.close()
        reject(new Error('CDP page connection not open in 3s'))
      }, 3_000)
      sock.addEventListener('open', () => {
        clearTimeout(timer)
        if (gen !== generation) {
          sock.close()
          return
        }
        ws = sock
        wsUrl = url
        // replays what the page logged before, so an error from before the poll is kept too
        sock.send(JSON.stringify({id: nextId++, method: 'Runtime.enable'}))
        resolve()
      })
      sock.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error('CDP page connection failed'))
      })
      sock.addEventListener('close', () => {
        if (ws === sock) closeWs()
      })
      sock.addEventListener('message', e => {
        if (ws !== sock) return
        const m = JSON.parse(String(e.data)) as CdpMessage
        if (m.id !== undefined) pending.get(m.id)?.(m)
        else if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
          consoleErrors.push((m.params.args ?? []).map(a => (typeof a.value === 'string' ? a.value : (a.description ?? JSON.stringify(a.value)))).join(' '))
        } else if (m.method === 'Runtime.exceptionThrown') {
          const d = m.params?.exceptionDetails
          consoleErrors.push(`uncaught: ${d?.exception?.description ?? d?.text ?? ''}`)
        }
        if (consoleErrors.length > 20) consoleErrors.splice(0, consoleErrors.length - 20)
      })
    })

  const evaluate = async (): Promise<RendererProbe> =>
    new Promise((resolve, reject) => {
      const id = nextId++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Runtime.evaluate not answered in 3s'))
      }, 3_000)
      pending.set(id, m => {
        clearTimeout(timer)
        pending.delete(id)
        if (m.error || m.result?.exceptionDetails) reject(new Error(m.error?.message ?? 'the probe threw'))
        else resolve(m.result?.result?.value as RendererProbe)
      })
      ws?.send(JSON.stringify({id, method: 'Runtime.evaluate', params: {expression: probeExpression, returnByValue: true}}))
    })

  const sample = async (): Promise<WatchSample> => {
    let targets: Array<CdpTarget>
    try {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('no answer in 2s')), 2_000)
      })
      try {
        const res = await Promise.race([fetch(`http://127.0.0.1:${cdpPort}/json/list`), timeout])
        targets = (await res.json()) as Array<CdpTarget>
      } finally {
        clearTimeout(timer)
      }
    } catch (e) {
      return {detail: `CDP on port ${cdpPort} does not answer (${e instanceof Error ? e.message : String(e)})`, kind: 'gone'}
    }
    const main = targets.find(t => t.type === 'page' && t.url.includes('main.html'))
    if (!main) return {detail: 'no main.html page target', kind: 'gone'}
    try {
      if (!ws || wsUrl !== main.webSocketDebuggerUrl) {
        closeWs()
        await connect(main.webSocketDebuggerUrl)
      }
      return probeSample(await evaluate())
    } catch (e) {
      return {detail: e instanceof Error ? e.message : String(e), kind: 'unanswered'}
    }
  }

  const record = (lines: Array<string>) => {
    fs.mkdirSync(path.dirname(opts.logFile), {recursive: true})
    fs.appendFileSync(opts.logFile, `${lines.join('\n')}\n\n`)
  }

  const incident = async (kind: BadKind, why: string) => {
    const at = new Date().toISOString()
    const what = `renderer went blank during ${phase}: ${why}`
    const noted = noteAlarm(book, phase, kind, what)
    book = noted.book
    if (noted.action === 'count') {
      opts.log(`watchdog: ${kind} again during ${phase} (counted, not written up again)`)
      return
    }
    opts.log(`watchdog: ${what}; details in ${opts.logFile}`)
    record([
      `=== ${at} ${what}`,
      '--- last renderer console errors ---',
      consoleErrors.join('\n') || '(none)',
      `--- last 40 lines of ${opts.appLog} ---`,
      tail(opts.appLog, 40),
    ])
    if (noted.action === 'record') {
      record([`${at}: not reloading again (one reload per run); repeats of this during ${phase} are only counted`])
      return
    }
    try {
      // a connection of its own, never closed: closing a CDP-connected browser quits Electron
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, {timeout: 5_000})
      await checkRendererAfterReload(findMainPage(browser))
      record([`${new Date().toISOString()}: reloaded; the renderer came back (the run still fails)`])
      opts.log('watchdog: reloaded the renderer; it came back')
    } catch (e) {
      record([`${new Date().toISOString()}: the reload did not bring it back: ${e instanceof Error ? e.message : String(e)}`])
      opts.log('watchdog: the reload did not bring the renderer back')
    }
  }

  const loop = async () => {
    let state: WatchState = {}
    while (!isStopping()) {
      try {
        const s = await sample()
        polls++
        if (isStopping()) break
        const next = nextWatch(state, s, Date.now(), {badMs, loadingMs})
        state = next.state
        if (next.alarm) await incident(next.alarm.kind, next.alarm.text)
      } catch (e) {
        // a watchdog that cannot watch cannot vouch for the renderer: that fails the run too
        const what = `watchdog failed during ${phase}: ${e instanceof Error ? e.message : String(e)}`
        if (!failures.includes(what)) failures.push(what)
        opts.log(what)
      }
      for (let waited = 0; waited < pollMs && !isStopping(); waited += 250) await sleep(250)
    }
  }

  return {
    incidents,
    polls: () => polls,
    start: (name: string) => {
      if (running) throw new Error(`watchdog already watching ${phase}`)
      phase = name
      stopping = false
      opts.log(`watchdog: started for ${name} (every ${pollMs / 1000}s, alarm after ${badMs / 1000}s, ${loadingMs / 1000}s on the loading placeholder)`)
      running = loop()
    },
    stop: async () => {
      const r = running
      if (!r) return
      running = undefined
      stopping = true
      await r
      closeWs()
      opts.log(`watchdog: stopped for ${phase} (${polls} polls so far, ${incidents().length} incidents)`)
    },
  }
}
