import {execFileSync} from 'child_process'
import {maskedRunError} from '../gate/run-errors-lib.ts'

// A synchronous child blocks the event loop, so mocha's per-test timeout can never fire while it
// runs: every one needs its own deadline. simctl, for one, can wait forever on an Xcode
// first-launch install. On a timeout the child is killed and this throws.
// `masked`: the argv holds a link, a path or a name, so a failure says only `masked.what` and how it
// failed, with `masked.hidden` replaced in the child's stderr (gate/run-errors-lib.ts).
export function runSync(
  file: string,
  args: ReadonlyArray<string>,
  timeoutMs: number,
  masked?: {what: string; hidden: ReadonlyArray<string>}
): string {
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      killSignal: 'SIGKILL',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
    })
  } catch (e) {
    if (masked) throw maskedRunError(masked.what, e, timeoutMs, masked.hidden)
    if ((e as {code?: string}).code === 'ETIMEDOUT') {
      throw new Error(`${[file, ...args].join(' ')} did not finish within ${timeoutMs / 1000}s; killed it`, {
        cause: e,
      })
    }
    throw e
  }
}

// The app's pid in the simulator's `launchctl list`, or undefined when it isn't running.
export const pidFromLaunchctl = (out: string, bundleId: string): number | undefined => {
  for (const line of out.split('\n')) {
    const [pid, , label] = line.trim().split(/\s+/)
    if (!label?.startsWith(`UIKitApplication:${bundleId}[`)) continue
    const n = Number(pid)
    return Number.isInteger(n) && n > 0 ? n : undefined
  }
  return undefined
}

// The app's pid read off the host's process table, or undefined when it isn't running: a simulator app
// runs as a host process under its device's data folder. A few milliseconds; asking the simulator
// (`simctl spawn launchctl list`) takes half a second, blocking the event loop.
export const hostAppPid = (udid: string, executable: string): number | undefined => {
  // plain node runs this file too (release.mts), which cannot load lodash's extensionless paths
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = `/CoreSimulator/Devices/${esc(udid)}/data/Containers/Bundle/Application/[^/]+/[^/]+\\.app/${esc(executable)}$`
  let out: string
  try {
    out = execFileSync('pgrep', ['-f', pattern], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000})
  } catch (e) {
    // pgrep exits 1 when nothing matches
    if ((e as {status?: number}).status === 1) return undefined
    throw e
  }
  const n = Number(out.split('\n')[0])
  return Number.isInteger(n) && n > 0 ? n : undefined
}

type SimDevice = {name: string; udid: string; state?: string}

// The one simulator named `name`. Several with that name are refused rather than one picked, since
// the first listed may not be the one with the app (two booted iPads of the same model).
export function pickSimulator(devices: Record<string, ReadonlyArray<SimDevice>>, name: string): string {
  const found = Object.values(devices).flatMap(list => list.filter(d => d.name === name))
  if (found.length === 1) return found[0]!.udid
  if (!found.length) throw new Error(`Simulator not found: ${name}`)
  throw new Error(
    `${found.length} simulators are named ${name} (${found.map(d => `${d.udid} ${d.state ?? ''}`.trim()).join(', ')}); ` +
      'set KB_IOS_UDID to the one to use, or rename the others'
  )
}

export function udidForName(name: string): string {
  const json = runSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], 60_000)
  return pickSimulator((JSON.parse(json) as {devices: Record<string, Array<SimDevice>>}).devices, name)
}

// KB_IOS_UDID, else the one simulator named `name`
export const iosUdid = (name: string): string => process.env['KB_IOS_UDID'] ?? udidForName(name)

export function requireSmokeUser(): string {
  const u = process.env['KB_SMOKE_USER']
  if (!u) throw new Error('KB_SMOKE_USER is not set — set it to the expected logged-in username')
  return u
}

interface IosCapsOpts {
  wdaLocalPort?: number
}

export function iosCapabilities(udid: string, opts: IosCapsOpts = {}) {
  const {wdaLocalPort} = opts
  return {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': udid,
    'appium:bundleId': 'keybase.ios',
    'appium:noReset': true,
    'appium:newCommandTimeout': 120,
    // never isHeadless: the driver (appium-ios-simulator 8+) knows Xcode 27's DeviceHub, and in headless
    // mode it quits DeviceHub, the window a person watches the run in
    'appium:wdaLaunchTimeout': 120000,
    // Speed up session init / commands: don't wait for app quiescence on launch
    // and skip device log capture.
    'appium:waitForIdleTimeout': 0,
    'appium:skipLogCapture': true,
    // Reuse the prebuilt WDA read-only.
    'appium:usePrebuiltWDA': true,
    // WDA listens on 8100 by default; two simulators at once (the visual driver on a non-default
    // Appium port) each need their OWN WDA port or the second collides with the first. Serial runs
    // leave the port undefined.
    ...(wdaLocalPort
      ? {
          'appium:wdaLocalPort': wdaLocalPort,
          'appium:mjpegServerPort': wdaLocalPort + 100,
        }
      : {}),
  }
}
