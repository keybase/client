// The iOS release command's decisions, kept free of I/O so they can be tested: whether a run may
// start (iosPreflightProblems), what simctl and ps say about the simulator, and whether the census and
// report phases wrote this run's outputs.
import type {PortHolder} from '../shared/gate/ports.ts'
import type {Outcome} from '../shared/gate/release-lib.ts'
import {KBFS_START_COMMAND} from '../electron/release-lib.ts'

// What the run's children listen on, which must be free when it starts.
const PORT_NAMES: Record<number, string> = {4723: 'Appium', 8081: 'Metro', 8100: 'WebDriverAgent'}
export const IOS_RELEASE_PORTS: ReadonlyArray<number> = [8081, 4723, 8100]
const portName = (port: number) => `${port}${PORT_NAMES[port] ? ` (${PORT_NAMES[port]})` : ''}`

export type IosPreflightState = {
  // the release lock's live holder, when another release run holds it: nothing else is checked
  releaseLockHeld?: string
  // the host's own service, which the sweep and setup run through; `user` '' when nobody
  hostWhoami: {ok: true; user: string} | {ok: false; error: string}
  smokeUser: string
  // the simulator the run drives (KB_IOS_DEVICE)
  device: string
  // visible: a Simulator or DeviceHub window process is running (no API says the device's window
  // is on screen)
  simulator: {booted: boolean; visible: boolean} | {error: string}
  // left out until the simulator is booted
  appSigned?: boolean | {error: string}
  // `ours`: every holder is harness residue the run stops once preflight passes (the Metro an earlier
  // release run recorded, on 8081, or the WebDriverAgent an earlier Appium session left on this
  // simulator, on 8100); `error` when lsof could not say who listens
  ports: ReadonlyArray<{port: number; holders: ReadonlyArray<PortHolder>; ours: boolean; error?: string}>
  // the visual gate lock's holder, when a live process holds it
  lockHeld?: string
  screen?: {locked: boolean} | {error: string}
  // left out when not checked: KBFS while the host service is not on the smoke account, peers and
  // setup until every check above them passes
  kbfs?: Outcome & {path: string}
  peers?: ReadonlyArray<{role: string} & Outcome>
  setupCheck?: Outcome
}

// Every reason the run must not start, each saying what to do about it. Empty: go ahead.
export const iosPreflightProblems = (s: IosPreflightState): Array<string> => {
  if (s.releaseLockHeld) return [`${s.releaseLockHeld}; another release run is going, wait for it to finish`]
  const out: Array<string> = []
  if (!s.hostWhoami.ok) {
    out.push(
      `the host's keybase service does not answer whoami (${s.hostWhoami.error}); start it (keybase ctl start) and sign it in as KB_SMOKE_USER (keybase login --switch ${s.smokeUser})`
    )
  } else if (s.hostWhoami.user !== s.smokeUser) {
    out.push(
      `the host's keybase service is signed in as ${s.hostWhoami.user || 'nobody'}, not KB_SMOKE_USER; ` +
        `switch it back yourself (keybase login --switch ${s.smokeUser}); the release command never switches it`
    )
  }
  if ('error' in s.simulator) {
    out.push(`could not read the simulator ${s.device} (${s.simulator.error}); check KB_IOS_DEVICE names an available simulator (xcrun simctl list devices available) and that xcrun simctl answers, then rerun`)
  } else if (!s.simulator.booted) {
    out.push(`the simulator ${s.device} is not booted; boot it (xcrun simctl boot ${s.device}) and open its window (open -a Simulator || open -a DeviceHub)`)
  } else if (!s.simulator.visible) {
    out.push(`the simulator ${s.device} has no window open, and a hidden simulator renders throttled; open it (open -a Simulator || open -a DeviceHub)`)
  }
  if (typeof s.appSigned === 'object') {
    out.push(`could not read keybase.ios on ${s.device} (${s.appSigned.error}); install a signed dev build (yarn ios)`)
  } else if (s.appSigned === false) {
    out.push(
      `keybase.ios on ${s.device} is not a signed dev build (it has no group.keybase app group), and an unsigned install loses the login; ` +
        'reinstall a signed one (yarn ios); the release command never installs'
    )
  }
  for (const {error, port, holders, ours} of s.ports) {
    if (error !== undefined) out.push(`could not tell whether port ${portName(port)} is free (${error}); fix lsof and rerun`)
    if (ours) continue
    for (const h of holders) {
      out.push(`port ${portName(port)} is held by pid ${h.pid} (${h.command}), which this run did not start; stop it to free the port`)
    }
  }
  if (s.lockHeld) out.push(`${s.lockHeld}; wait for that run to finish`)
  if (s.screen && 'error' in s.screen) out.push(`could not tell whether the macOS session is locked (${s.screen.error}); fix ioreg and rerun`)
  else if (s.screen?.locked) out.push('the macOS session is locked, and a locked session throttles the simulator; unlock it and rerun')
  if (s.kbfs && !s.kbfs.ok) out.push(`KBFS does not answer for ${s.kbfs.path} (${s.kbfs.error}); start it: ${KBFS_START_COMMAND}`)
  for (const p of s.peers ?? []) {
    if (!p.ok) out.push(`peer ${p.role}: ${p.error}; yarn test:e2e:accounts:setup provisions and signs in the peers`)
  }
  if (s.setupCheck && !s.setupCheck.ok) out.push(`yarn test:e2e:accounts:setup --check failed:\n    ${s.setupCheck.error.trim().split('\n').join('\n    ')}`)
  return out
}

// `xcrun simctl list devices booted -j`: whether `device` is among them.
export const simulatorFromList = (json: string, device: string): {booted: boolean} | {error: string} => {
  let devices: Record<string, Array<{name?: string; state?: string}>>
  try {
    devices = (JSON.parse(json) as {devices: typeof devices}).devices
    if (typeof devices !== 'object') throw new Error('no devices')
  } catch {
    return {error: `simctl list printed no device json: ${json.slice(0, 80)}`}
  }
  return {booted: Object.values(devices).some(ds => ds.some(d => d.name === device && d.state === 'Booted'))}
}

// `xcrun simctl appinfo <udid> keybase.ios`: a signed dev build has its app group's container, which
// an unsigned install (no entitlements) lacks.
export const appSignedFromAppinfo = (appinfo: string) => /GroupContainers\s*=\s*\{[^}]*"group\.keybase"\s*=/.test(appinfo)

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The WebDriverAgent an earlier Appium session left on this simulator: the runner app, which holds
// port 8100, and the xcodebuild that drives it. Appium starts both outside its own process group,
// so they outlive it.
export const isWdaResidue = (command: string, udid: string) => {
  const u = escapeRe(udid)
  return (
    new RegExp(`/CoreSimulator/Devices/${u}/.*/WebDriverAgentRunner-Runner\\.app/`).test(command) ||
    new RegExp(`xcodebuild test-without-building .*WebDriverAgent.*-destination id=${u}(\\s|$)`).test(command)
  )
}

export type PsRow = {pid: number; ppid: number; pgid: number; command: string}

// `ps -axww -o pid=,ppid=,pgid=,command=`
export const parsePs = (text: string): Array<PsRow> =>
  text.split('\n').flatMap(l => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l)
    return m ? [{command: m[4] ?? '', pgid: Number(m[3]), pid: Number(m[1]), ppid: Number(m[2])}] : []
  })

// What a stopped child left behind: a wdio launcher stopped by the run's deadline or an interrupt
// does not stop its worker, which goes on driving the app. Such a process is one of the e2e scripts in
// the run's process group (children are not detached) that is either still the run's descendant or
// was orphaned (reparented to launchd). Pipeline siblings share the group, and a forked shell's
// command line can name the e2e scripts too, but their parent is alive and not the run: left alone.
export const strayChildren = (rows: ReadonlyArray<PsRow>, self: number): Array<number> => {
  const byPid = new Map(rows.map(r => [r.pid, r]))
  const me = byPid.get(self)
  if (!me) return []
  const ancestors = new Set<number>()
  for (let r: PsRow | undefined = me; r && !ancestors.has(r.pid); r = byPid.get(r.ppid)) ancestors.add(r.pid)
  const descends = (r: PsRow) => {
    const seen = new Set<number>()
    for (let p = byPid.get(r.ppid); p && !seen.has(p.pid); p = byPid.get(p.ppid)) {
      if (p.pid === self) return true
      seen.add(p.pid)
    }
    return false
  }
  return rows
    .filter(r => r.pgid === me.pgid && !ancestors.has(r.pid) && r.command.includes('tests/e2e/') && (r.ppid === 1 || descends(r)))
    .map(r => r.pid)
}

// Whether process group `pgid` is a Metro: it holds Metro's port, or one of its processes is `yarn
// rn:start` or `expo start`. A pidfile's group id outlives the group, and the system may hand it to
// an unrelated group later.
export const isMetroGroup = (rows: ReadonlyArray<PsRow>, pgid: number, metroPortPgids: ReadonlyArray<number>) =>
  metroPortPgids.includes(pgid) || rows.some(r => r.pgid === pgid && /\brn:start\b|\bexpo start\b/.test(r.command))

// A finished child, as the release run's runChild reports it.
type PhaseChild = {code: number | null; stdout: string; logError?: string}
// An output the phase must have written: `mtimeMs` left out when the file does not exist.
type PhaseOutput = {path: string; mtimeMs?: number}

export const logFailed = (c: Pick<PhaseChild, 'logError'>) => (c.logError ? ` (its log could not be written: ${c.logError})` : '')
const writtenSince = (o: PhaseOutput, start: number) => o.mtimeMs !== undefined && o.mtimeMs >= start

// The census phase passes only on what its own child did: its `census: routes …` line, and a census
// json written since the phase started (a file from an earlier run is not this run's census).
export const censusPhaseResult = (c: PhaseChild, json: PhaseOutput, start: number) => {
  const line = /^census: (routes .+)$/m.exec(c.stdout)?.[1]
  if (line === undefined) return {line: `census exited ${c.code} and printed no census line${logFailed(c)}`, ok: false}
  if (!writtenSince(json, start)) return {line: `${line}; ${json.path} was not written by this run${logFailed(c)}`, ok: false}
  return {line: `${line}${logFailed(c)}`, ok: c.code === 0 && !c.logError}
}

// The report phase passes only on a report written since the phase started.
export const reportPhaseResult = (c: PhaseChild, report: PhaseOutput, start: number) => {
  if (c.code !== 0) return {line: `report generator exited ${c.code}${logFailed(c)}`, ok: false}
  if (!writtenSince(report, start)) return {line: `report generator exited 0 and ${report.path} was not written by this run${logFailed(c)}`, ok: false}
  return {line: `${report.path}${logFailed(c)}`, ok: !c.logError}
}
