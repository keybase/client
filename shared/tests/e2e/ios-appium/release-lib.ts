// The iOS release command's decisions, kept free of I/O so they can be tested: whether a run may
// start (iosPreflightProblems), what simctl and ps say about the simulator, and what the secret scan
// reads.
import * as path from 'path'
import type {PortHolder} from '../shared/gate/ports.ts'
import {commonPreflightProblems, serviceAccountName, toSecond, type CommonPreflightState} from '../shared/gate/release-lib.ts'

// What the run's children listen on, which must be free when it starts.
const PORT_NAMES: Record<number, string> = {4723: 'Appium', 8081: 'Metro', 8100: 'WebDriverAgent'}
export const IOS_RELEASE_PORTS: ReadonlyArray<number> = [8081, 4723, 8100]
const portName = (port: number) => `${port}${PORT_NAMES[port] ? ` (${PORT_NAMES[port]})` : ''}`

export type IosPreflightState = CommonPreflightState & {
  // the host's own service, which the sweep and setup run through; `user` '' when nobody
  hostWhoami: {ok: true; user: string} | {ok: false; error: string}
  smokeUser: string
  secondUser: string
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
}

// Every reason the run must not start, each saying what to do about it. Empty: go ahead.
export const iosPreflightProblems = (s: IosPreflightState): Array<string> =>
  commonPreflightProblems(
    s,
    () => {
      const out: Array<string> = []
      if (!s.hostWhoami.ok) {
        out.push(
          `the host's keybase service does not answer whoami (${s.hostWhoami.error}); start it (keybase ctl start) and sign it in as KB_SMOKE_USER (keybase login --switch ${s.smokeUser})`
        )
      } else if (s.hostWhoami.user !== s.smokeUser) {
        out.push(
          `the host's keybase service is signed in as ${serviceAccountName(s.hostWhoami.user, s)}, not KB_SMOKE_USER; ` +
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
      return out
    },
    {lockedWhy: 'a locked session throttles the simulator'}
  )

// The run's push flows need the permission, which the owner grants once on the simulator: asking for
// it from the app opens the Settings app, so the run never does.
export const pushPermissionProblem = (has: boolean, device: string): string | undefined =>
  has
    ? undefined
    : `push notifications are off for keybase.ios on ${device}; turn them on once by hand ` +
      '(on the simulator: Settings > Apps > Keybase > Notifications > Allow Notifications), then rerun; ' +
      'the release command never asks for them, as asking opens the Settings app'

// The app follows the simulator's appearance only on "Respect system settings": on a fixed theme a dark
// run would capture light screens (or the other way around) and every flow would still pass.
export const themeProblem = (drawsDark: boolean, theme: 'light' | 'dark', device: string): string | undefined =>
  drawsDark === (theme === 'dark')
    ? undefined
    : `keybase.ios on ${device} does not draw ${theme} with the simulator in ${theme} appearance; set its theme to ` +
      '"Respect system settings" (Settings > Display), then rerun'

// The run starts with location never asked: the location flow's restore (from locationd's own record)
// is then a reset, and its first fix is a fresh one.
export const locationStartProblem = (p: {background: string; foreground: string}, device: string, udid: string): string | undefined =>
  p.foreground === 'undetermined' && p.background === 'undetermined'
    ? undefined
    : `location is already ${p.foreground === p.background ? p.foreground : `${p.foreground} (background ${p.background})`} for keybase.ios on ${device}, ` +
      'and the location flow starts from never asked; reset it once by hand ' +
      `(xcrun simctl privacy ${udid} reset location keybase.ios, then relaunch the app), then rerun`

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

// startMs: when it started, to the second (from its elapsed time, read at `now`)
export type PsRow = {pid: number; ppid: number; pgid: number; startMs: number; command: string}

// ps's etime, `[[dd-]hh:]mm:ss`, in seconds
const etimeSeconds = (etime: string) => {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(etime)
  if (!m) return undefined
  return ((Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3])) * 60 + Number(m[4])
}

// `ps -axww -o pid=,ppid=,pgid=,etime=,command=`, read at `now`
export const parsePs = (text: string, now: number): Array<PsRow> =>
  text.split('\n').flatMap(l => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(l)
    const elapsed = m ? etimeSeconds(m[4] ?? '') : undefined
    return m && elapsed !== undefined
      ? [{command: m[5] ?? '', pgid: Number(m[3]), pid: Number(m[1]), ppid: Number(m[2]), startMs: now - elapsed * 1000}]
      : []
  })

// What a stopped child left behind: a wdio launcher stopped by the run's deadline or an interrupt
// does not stop its worker, which goes on driving the app. Such a process is one of the e2e scripts in
// the run's process group (children are not detached), started since the run did (`runStart`), that is
// either still the run's descendant or was orphaned (reparented to launchd). Pipeline siblings share
// the group, and a forked shell's command line can name the e2e scripts too, but their parent is alive
// and not the run: left alone. An orphan from before the run (launchd and `bash -c` can hand one
// group to unrelated runs) is someone else's.
export const strayChildren = (rows: ReadonlyArray<PsRow>, self: number, runStart: number): Array<number> => {
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
    .filter(
      r =>
        r.pgid === me.pgid &&
        !ancestors.has(r.pid) &&
        r.startMs >= toSecond(runStart) &&
        r.command.includes('tests/e2e/') &&
        (r.ppid === 1 || descends(r))
    )
    .map(r => r.pid)
}

// Whether process group `pgid` is a Metro: it holds Metro's port, or one of its processes is `yarn
// rn:start` or `expo start`. A pidfile's group id outlives the group, and the system may hand it to
// an unrelated group later.
export const isMetroGroup = (rows: ReadonlyArray<PsRow>, pgid: number, metroPortPgids: ReadonlyArray<number>) =>
  metroPortPgids.includes(pgid) || rows.some(r => r.pgid === pgid && /\brn:start\b|\bexpo start\b/.test(r.command))

// What the secret scan reads once a run that took the release lock ends. A run refused at preflight
// wrote only its logs, and the rest of tests/results may be another live run's files (the visual gate
// run whose lock refused it): only the logs. Otherwise everything under tests/results, and the visual
// gate's render root too when KB_VISUAL_RESULTS puts it outside (scanned however the render ended).
export const secretScanDirs = (o: {preflightPassed: boolean; resultsDir: string; logsDir: string; renderRoot: string}) => {
  if (!o.preflightPassed) return [o.logsDir]
  const outside = path.relative(o.resultsDir, o.renderRoot).startsWith('..')
  return [o.resultsDir, ...(outside ? [o.renderRoot] : [])]
}
