// Which iOS form factor a simulator is (iPhone, iPhone Duo folded or unfolded), and folding or unfolding
// the Duo. The label comes from the device itself: the device type from simctl and, for a Duo, which
// of its two screens devicectl reports active (the primary display is the outer one). The hinge moves
// through duo-hinge.m, run inside the simulator.
import {execFile, execFileSync} from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {promisify} from 'util'

export type FormFactor = 'iphone' | 'duo-folded' | 'duo-unfolded' | (string & {})
export type Posture = 'folded' | 'unfolded'
type Display = {active: boolean; backlightState?: string; displayId: number; primary: boolean}
export type Exec = (file: string, args: ReadonlyArray<string>) => string

const LABELS: Record<string, string> = {
  'duo-folded': 'iPhone Duo Folded',
  'duo-unfolded': 'iPhone Duo Unfolded',
  iphone: 'iPhone',
}
export const formFactorLabel = (f: FormFactor) => LABELS[f] ?? f

// The visual store's key: iPhone keeps the plain `ios` it has always had
export const formFactorStoreKey = (f: FormFactor): 'ios' | `ios-${string}` => (f === 'iphone' ? 'ios' : `ios-${f}`)

const isDuo = (deviceType: string) => /iPhone-Duo/i.test(deviceType)

export const classifyFormFactor = (deviceType: string, displays: ReadonlyArray<Display> | undefined): FormFactor => {
  if (isDuo(deviceType)) {
    // The lit screen, not `active`: after a fold devicectl can keep naming the inner screen active
    // while the outer one is lit and showing the app
    const lit = displays?.filter(d => d.backlightState === 'activeOn') ?? []
    const active = lit.length === 1 ? lit[0] : displays?.find(d => d.active)
    if (!active) throw new Error('the iPhone Duo has no active display (is the simulator still booting?)')
    return active.primary ? 'duo-folded' : 'duo-unfolded'
  }
  if (/\.iPad/i.test(deviceType)) return 'ipad'
  return 'iphone'
}

export const parsePosture = (v: string | undefined): Posture | undefined => {
  if (!v) return undefined
  if (v === 'folded' || v === 'unfolded') return v
  throw new Error(`the posture must be folded or unfolded, not ${v}`)
}

// simctl and devicectl can wait forever on an Xcode first-launch install, so each call has a deadline
const realExec: Exec = (file, args) =>
  execFileSync(file, args, {encoding: 'utf8', killSignal: 'SIGKILL', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000})

const deviceTypeOf = (udid: string, exec: Exec) => {
  const devices = (JSON.parse(exec('xcrun', ['simctl', 'list', 'devices', '-j'])) as {
    devices: Record<string, Array<{deviceTypeIdentifier?: string; udid: string}>>
  }).devices
  const d = Object.values(devices)
    .flat()
    .find(x => x.udid === udid)
  if (!d) throw new Error(`no simulator has the udid ${udid}`)
  return d.deviceTypeIdentifier ?? ''
}

const displaysOf = (udid: string, exec: Exec) =>
  (JSON.parse(exec('xcrun', ['devicectl', 'device', 'info', 'displays', '-d', udid, '-q', '-j', '-'])) as {
    result: {displays: Array<Display>}
  }).result.displays

export const readFormFactor = (udid: string, exec: Exec = realExec): FormFactor => {
  const type = deviceTypeOf(udid, exec)
  return classifyFormFactor(type, isDuo(type) ? displaysOf(udid, exec) : undefined)
}

// The lit screen's display id for a Duo, else undefined. Appium's screenshot is always the Duo's outer
// screen (black when unfolded), so a Duo is captured with simctlScreenshot on this display instead.
export const screenshotDisplayOf = (udid: string, exec: Exec = realExec): number | undefined => {
  const type = deviceTypeOf(udid, exec)
  if (!isDuo(type)) return undefined
  const f = classifyFormFactor(type, displaysOf(udid, exec))
  return displaysOf(udid, exec).find(d => d.primary === (f === 'duo-folded'))?.displayId
}

// KB_IOS_SCREEN=<udid>:<displayId>: set by a Duo flow run for its workers, whose screenshots then go
// through simctlScreenshot
export const parseScreenTarget = (v: string | undefined): {displayId: number; udid: string} | undefined => {
  if (!v) return undefined
  const m = /^(.+):(\d+)$/.exec(v)
  if (!m) throw new Error(`KB_IOS_SCREEN must be <udid>:<displayId>, not ${v}`)
  return {displayId: Number(m[2]), udid: m[1]!}
}

type AsyncRun = (file: string, args: ReadonlyArray<string>) => Promise<unknown>
const execFileAsync = promisify(execFile)
const realRun: AsyncRun = async (file, args) => execFileAsync(file, [...args], {timeout: 30_000})

// A PNG of one simulator display. simctl writes nothing to stdout for `-`, so it goes through a file.
export const simctlScreenshot = async (udid: string, displayId: number, run: AsyncRun = realRun): Promise<Buffer> => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-duo-shot-'))
  const file = path.join(dir, 'shot.png')
  try {
    await run('xcrun', ['simctl', 'io', udid, 'screenshot', `--display=${displayId}`, file])
    return fs.readFileSync(file)
  } finally {
    fs.rmSync(dir, {force: true, recursive: true})
  }
}

// Builds the in-simulator helper with Xcode's own clang into shared/tests/results when its source is
// newer than the binary
const buildHelper = () => {
  const dir = path.dirname(fileURLToPath(import.meta.url))
  const HELPER_SOURCE = path.join(dir, 'duo-hinge.m')
  const HELPER_BIN = path.resolve(dir, '../../../results/duo-hinge/duo-hinge')
  const built = fs.existsSync(HELPER_BIN) && fs.statSync(HELPER_BIN).mtimeMs >= fs.statSync(HELPER_SOURCE).mtimeMs
  if (built) return HELPER_BIN
  fs.mkdirSync(path.dirname(HELPER_BIN), {recursive: true})
  const tmp = `${HELPER_BIN}.tmp`
  realExec('xcrun', [
    '-sdk', 'iphonesimulator', 'clang', '-arch', 'arm64', '-mios-simulator-version-min=17.0', '-O2', '-fobjc-arc',
    '-o', tmp, HELPER_SOURCE, '-framework', 'IOKit', '-framework', 'Foundation', '-framework', 'CoreMotion',
  ])
  realExec('codesign', ['-f', '-s', '-', tmp])
  fs.renameSync(tmp, HELPER_BIN)
  return HELPER_BIN
}

const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const SWITCH_TIMEOUT_MS = 8000
const POLL_MS = 600

// Folds or unfolds the Duo and waits until devicectl reports the matching screen active. The hinge
// always sweeps from its current angle: a straight jump between closed and open moves the angle but
// can leave the screens unswitched until the Device Hub slider is nudged.
export const setPosture = (
  udid: string,
  posture: Posture,
  deps: {build?: () => string; exec?: Exec; now?: () => number; sleep?: (ms: number) => void} = {}
) => {
  const {build = buildHelper, exec = realExec, now = Date.now, sleep = sleepSync} = deps
  const type = deviceTypeOf(udid, exec)
  if (!isDuo(type)) throw new Error(`only the iPhone Duo folds; ${udid} is ${type}`)
  const want: FormFactor = posture === 'folded' ? 'duo-folded' : 'duo-unfolded'
  const bin = build()
  const from = Math.round(Number(exec('xcrun', ['simctl', 'spawn', udid, bin, 'get']).trim()))
  const to = posture === 'folded' ? 0 : 180
  if (from === to && classifyFormFactor(type, displaysOf(udid, exec)) === want) return
  exec('xcrun', ['simctl', 'spawn', udid, bin, 'set', String(from), String(to)])
  const deadline = now() + SWITCH_TIMEOUT_MS
  while (now() < deadline) {
    sleep(POLL_MS)
    if (classifyFormFactor(type, displaysOf(udid, exec)) === want) return
  }
  throw new Error(
    `the iPhone Duo's hinge is at ${to}° but it did not switch screens within ${SWITCH_TIMEOUT_MS / 1000}s: ` +
      'nudge the hinge slider in Device Hub (hold Option) or restart the simulator, then rerun'
  )
}
