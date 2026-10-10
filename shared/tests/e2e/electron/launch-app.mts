// Launches the dev Electron app for the desktop flows and waits until it is ready, with a hard
// deadline: CDP answers, a main.html page exists, and the chat tab is visible in it. On a timeout it
// prints the tail of the app log and the renderer's console errors, stops the app, and exits 1.
//
//   node tests/e2e/electron/launch-app.mts            kill any previous app, launch, wait
//   node tests/e2e/electron/launch-app.mts --check    only check the running app is ready
//   node tests/e2e/electron/launch-app.mts --visual   launch with the visual gate's Chromium switches
//   ... --coverage                                    also mark Box2/ClickableBox call sites
//                                                     (KB_VISUAL_COVERAGE=1, tests/e2e/visual/coverage)
//
// Options: --deadline <seconds> (default 120), --cdp-port <port> (default 9222), --log <path>
// (default /tmp/chat-e2e-electron.log, appended to, one separator per launch).
import {spawn, execFileSync} from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {NAV_TAB_CHAT} from '../shared/test-ids.ts'
import {VISUAL_ELECTRON_ARGS} from '../visual/electron-args.ts'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}
const checkOnly = process.argv.includes('--check')
const visual = process.argv.includes('--visual')
const coverage = process.argv.includes('--coverage')
const deadlineMs = Number(arg('deadline') ?? 120) * 1000
const cdpPort = Number(arg('cdp-port') ?? 9222)
const logPath = arg('log') ?? '/tmp/chat-e2e-electron.log'
const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const devServerPort = 4000

type CdpTarget = {type: string; url: string; webSocketDebuggerUrl: string}

const log = (msg: string) => console.log(`[launch-app] ${msg}`)
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const listTargets = async (): Promise<Array<CdpTarget>> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('CDP did not answer in 2s')), 2_000)
  })
  try {
    const res = await Promise.race([fetch(`http://127.0.0.1:${cdpPort}/json/list`), timeout])
    return (await res.json()) as Array<CdpTarget>
  } finally {
    clearTimeout(timer)
  }
}

const mainTarget = async () => (await listTargets().catch(() => [])).find(t => t.type === 'page' && t.url.includes('main.html'))

// The chat tab is visible in main.html. Never closes the browser: that would quit Electron.
const chatTabVisible = async () => {
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, {timeout: 3_000})
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('main.html'))
    return !!page && (await page.getByTestId(NAV_TAB_CHAT).isVisible({timeout: 2_000}))
  } catch {
    return false
  }
}

// Console errors and uncaught exceptions the renderer has logged so far: enabling the Runtime domain
// replays the messages the page has already logged.
const rendererErrors = async (): Promise<Array<string>> => {
  const target = await mainTarget()
  if (!target) return ['(no main.html page to read from)']
  const errors: Array<string> = []
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise<void>(resolve => {
    const done = setTimeout(resolve, 1_500)
    ws.addEventListener('error', () => {
      clearTimeout(done)
      errors.push('(could not attach to the renderer)')
      resolve()
    })
    ws.addEventListener('open', () => ws.send(JSON.stringify({id: 1, method: 'Runtime.enable'})))
    ws.addEventListener('message', e => {
      const m = JSON.parse(String(e.data)) as {
        method?: string
        params?: {type?: string; args?: Array<{value?: unknown; description?: string}>; exceptionDetails?: {text?: string; exception?: {description?: string}}}
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
        errors.push(
          (m.params.args ?? [])
            .map(a => (typeof a.value === 'string' ? a.value : (a.description ?? JSON.stringify(a.value))))
            .join(' ')
        )
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params?.exceptionDetails
        errors.push(`uncaught: ${d?.exception?.description ?? d?.text ?? ''}`)
      }
    })
  })
  ws.close()
  return errors.slice(-20)
}

const pidsOf = (args: Array<string>) => {
  try {
    return execFileSync(args[0]!, args.slice(1), {encoding: 'utf8', timeout: 5_000})
      .split('\n')
      .map(s => Number(s.trim()))
      .filter(n => n > 0 && n !== process.pid)
  } catch {
    return []
  }
}

// The previous dev app: its yarn and helper processes, Electron with a debug port, and whatever
// still listens on the dev server or CDP port.
const appPids = () => [
  ...new Set([
    ...pidsOf(['pgrep', '-f', 'desktop:start:hot']),
    ...pidsOf(['pgrep', '-f', 'yarn-helper/index.mts start:hot']),
    ...pidsOf(['pgrep', '-f', 'Electron.app/Contents/MacOS/Electron --remote-debugging-port']),
    ...pidsOf(['lsof', '-t', `-iTCP:${devServerPort}`, '-sTCP:LISTEN']),
    ...pidsOf(['lsof', '-t', `-iTCP:${cdpPort}`, '-sTCP:LISTEN']),
  ]),
]

const killApp = async () => {
  const pids = appPids()
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {}
  }
  for (let waited = 0; waited < 10_000 && appPids().length; waited += 250) {
    await sleep(250)
  }
  for (const pid of appPids()) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {}
  }
}

const logTail = (lines: number) => {
  try {
    return fs.readFileSync(logPath, 'utf8').split('\n').slice(-lines).join('\n')
  } catch {
    return `(no log at ${logPath})`
  }
}

const waitForReady = async () => {
  const start = Date.now()
  let stage = 'CDP to answer'
  while (Date.now() - start < deadlineMs) {
    if (!(await mainTarget())) {
      stage = (await listTargets().then(() => true).catch(() => false)) ? 'a main.html page' : 'CDP to answer'
    } else if (await chatTabVisible()) {
      log(`ready in ${Math.round((Date.now() - start) / 1000)}s`)
      return true
    } else {
      stage = 'the chat tab to show in main.html'
    }
    await sleep(1_000)
  }
  log(`app not ready after ${deadlineMs / 1000}s: still waiting for ${stage}`)
  return false
}

const fail = async (why: string) => {
  console.error(`[launch-app] ${why}`)
  console.error(`--- last 50 lines of ${logPath} ---\n${logTail(50)}`)
  console.error(`--- renderer console errors ---\n${(await rendererErrors()).join('\n') || '(none)'}`)
  if (!checkOnly) {
    await killApp()
    console.error('[launch-app] stopped the app')
  }
  process.exit(1)
}

if (checkOnly) {
  if (!(await waitForReady())) await fail('the running app is not ready')
  process.exit(0)
}

await killApp()
// appended to, each launch under its own separator, so what a previous launch logged (a renderer
// that went white, say) is still there after a relaunch
const out = fs.openSync(logPath, 'a')
fs.writeSync(out, `\n=== launch ${new Date().toISOString()} ===\n`)
const env = {
  ...process.env,
  KB_ELECTRON_EXTRA_ARGS: visual ? VISUAL_ELECTRON_ARGS.join(' ') : '',
  KB_VISUAL_COVERAGE: coverage ? '1' : '',
}
const child = spawn('yarn', ['desktop:start:hot:e2e'], {cwd: sharedDir, detached: true, env, stdio: ['ignore', out, out]})
child.unref()
log(`started the app (pid ${child.pid})${coverage ? ' with coverage marks' : ''}, log at ${logPath}`)
if (!(await waitForReady())) await fail('launch failed')
process.exit(0)
