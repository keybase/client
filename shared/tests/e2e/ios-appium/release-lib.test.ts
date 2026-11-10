import {
  appSignedFromAppinfo,
  iosPreflightProblems,
  isMetroGroup,
  isWdaResidue,
  locationStartProblem,
  parsePs,
  pushPermissionProblem,
  themeProblem,
  secretScanDirs,
  strayChildren,
  simulatorFromList,
  type IosPreflightState,
} from './release-lib'

const UDID = '00000000-1111-2222-3333-444444444444'

const ok = (over: Partial<IosPreflightState> = {}): IosPreflightState => ({
  appSigned: true,
  device: 'iPhoneTest',
  hostWhoami: {ok: true, user: 'testuser'},
  kbfs: {ok: true, path: '/keybase/private/testuser'},
  peers: [
    {ok: true, role: 'second'},
    {ok: true, role: 'owner'},
  ],
  ports: [
    {holders: [], ours: false, port: 8081},
    {holders: [], ours: false, port: 4723},
    {holders: [], ours: false, port: 8100},
  ],
  screen: {locked: false},
  setupCheck: {ok: true},
  simulator: {booted: true, visible: true},
  secondUser: 'testuser-mac',
  smokeUser: 'testuser',
  ...over,
})

const only = (s: IosPreflightState) => {
  const p = iosPreflightProblems(s)
  expect(p).toHaveLength(1)
  return p[0] ?? ''
}

describe('iosPreflightProblems', () => {
  test('a ready machine has none', () => {
    expect(iosPreflightProblems(ok())).toEqual([])
  })

  test('the host service on another account refuses, naming the switch command', () => {
    const p = only(ok({hostWhoami: {ok: true, user: 'testuser-mac'}}))
    expect(p).toContain('signed in as <second>, not KB_SMOKE_USER')
    expect(only(ok({hostWhoami: {ok: true, user: 'someone'}}))).not.toContain('someone')
    expect(p).toContain('keybase login --switch testuser')
    expect(p).toContain('never switches it')
  })

  test('a signed out or silent host service refuses', () => {
    expect(only(ok({hostWhoami: {ok: true, user: ''}}))).toContain('signed in as nobody')
    const silent = only(ok({hostWhoami: {error: 'no answer in 15s', ok: false}}))
    expect(silent).toContain('does not answer whoami (no answer in 15s)')
    expect(silent).toContain('keybase ctl start')
  })

  test('a simulator that is not booted names the boot command', () => {
    const p = only(ok({simulator: {booted: false, visible: false}}))
    expect(p).toContain('xcrun simctl boot iPhoneTest')
  })

  test('a booted simulator with no window names the command that opens one', () => {
    expect(only(ok({simulator: {booted: true, visible: false}}))).toContain('open -a Simulator || open -a DeviceHub')
  })

  test('a simulator simctl cannot read refuses', () => {
    expect(only(ok({simulator: {error: 'simctl list did not finish within 60s'}}))).toContain('could not read the simulator iPhoneTest (simctl list did not finish within 60s)')
  })

  test('an unsigned install names a signed reinstall and says the gate never installs', () => {
    const p = only(ok({appSigned: false}))
    expect(p).toContain('yarn ios')
    expect(p).toContain('never installs')
  })

  test('an app that cannot be read refuses', () => {
    expect(only(ok({appSigned: {error: 'No application record found'}}))).toContain('could not read keybase.ios on iPhoneTest (No application record found)')
  })

  test('a port held by a process this run did not start refuses, naming it', () => {
    const p = only(ok({ports: [{holders: [{command: 'node server.js', pgid: 77, pid: 78}], ours: false, port: 4723}]}))
    expect(p).toContain('port 4723 (Appium) is held by pid 78 (node server.js)')
  })

  test('harness residue on a port (an earlier Metro or WebDriverAgent) is not a problem', () => {
    expect(iosPreflightProblems(ok({ports: [{holders: [{command: 'node expo start', pgid: 50, pid: 51}], ours: true, port: 8081}]}))).toEqual([])
  })

  test('lsof failing on a port refuses', () => {
    expect(only(ok({ports: [{error: 'lsof exited 2', holders: [], ours: false, port: 8100}]}))).toContain('could not tell whether port 8100 (WebDriverAgent) is free (lsof exited 2)')
  })

})

describe('simulatorFromList', () => {
  const list = (state: string) => JSON.stringify({devices: {'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [{name: 'iPhoneTest', state, udid: UDID}]}})

  test('a booted device is booted', () => {
    expect(simulatorFromList(list('Booted'), 'iPhoneTest')).toEqual({booted: true})
  })

  test('a shut down or missing device is not', () => {
    expect(simulatorFromList(list('Shutdown'), 'iPhoneTest')).toEqual({booted: false})
    expect(simulatorFromList(list('Booted'), 'iPadTest')).toEqual({booted: false})
  })

  test('output that is not simctl json is an error', () => {
    expect(simulatorFromList('nope', 'iPhoneTest')).toEqual({error: expect.stringContaining('simctl list printed no device json')})
  })
})

describe('appSignedFromAppinfo', () => {
  test('an app with the group.keybase app group is signed', () => {
    const info = `{\n    GroupContainers =     {\n        "group.keybase" = "file:///x/AppGroup/1/";\n    };\n    IsDeveloperApp = 1;\n}`
    expect(appSignedFromAppinfo(info)).toBe(true)
  })

  test('an app with no group containers is not', () => {
    expect(appSignedFromAppinfo(`{\n    GroupContainers =     {\n    };\n    IsDeveloperApp = 1;\n}`)).toBe(false)
    expect(appSignedFromAppinfo(`{\n    IsDeveloperApp = 1;\n}`)).toBe(false)
  })
})

describe('isWdaResidue', () => {
  test("the WebDriverAgent runner in this simulator's container is residue", () => {
    expect(isWdaResidue(`/Users/x/Library/Developer/CoreSimulator/Devices/${UDID}/data/Containers/Bundle/Application/C9/WebDriverAgentRunner-Runner.app/WebDriverAgentRunner-Runner`, UDID)).toBe(true)
  })

  test("Appium's WebDriverAgent xcodebuild for this simulator is residue", () => {
    expect(
      isWdaResidue(
        `/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild test-without-building -project /Users/x/.appium/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj -scheme WebDriverAgentRunner -destination id=${UDID} IPHONEOS_DEPLOYMENT_TARGET=15.0`,
        UDID
      )
    ).toBe(true)
  })

  test("another simulator's WebDriverAgent, or anything else, is not", () => {
    expect(isWdaResidue('/Users/x/Library/Developer/CoreSimulator/Devices/OTHER/data/WebDriverAgentRunner-Runner.app/WebDriverAgentRunner-Runner', UDID)).toBe(false)
    expect(isWdaResidue(`xcodebuild test-without-building -scheme WebDriverAgentRunner -destination id=OTHER`, UDID)).toBe(false)
    expect(isWdaResidue(`node server.js --udid ${UDID}`, UDID)).toBe(false)
  })
})

describe('strayChildren', () => {
  const runStart = 100_500
  // a shell (10) runs yarn (11), which runs the release (12) beside a tee (13) and a forked subshell
  // whose command line names the release (16); the release's wdio launcher is gone and its worker
  // (14) was reparented to launchd; a render (17) it started is still its child
  const rows = [
    {command: 'zsh -c yarn test:e2e:ios:release | tee run.log', pgid: 10, pid: 10, ppid: 1, startMs: 90_000},
    {command: 'zsh -c node tests/e2e/ios-appium/release.mts | grep x', pgid: 10, pid: 16, ppid: 10, startMs: 90_000},
    {command: 'node yarn test:e2e:ios:release', pgid: 10, pid: 11, ppid: 10, startMs: 90_000},
    {command: 'node tests/e2e/ios-appium/release.mts', pgid: 10, pid: 12, ppid: 11, startMs: 100_000},
    {command: 'tee run.log', pgid: 10, pid: 13, ppid: 10, startMs: 90_000},
    {command: 'node node_modules/@wdio/local-runner/build/run.js run tests/e2e/ios-appium/wdio.gate.conf.ts', pgid: 10, pid: 14, ppid: 1, startMs: 200_000},
    {command: 'node tests/e2e/visual/cli.mts render --ios', pgid: 99, pid: 15, ppid: 1, startMs: 200_000},
    // a render started in the run's first second, which ps keeps to the second
    {command: 'node tests/e2e/visual/cli.mts render --ios', pgid: 10, pid: 17, ppid: 12, startMs: 100_000},
  ]

  test("an orphaned test runner in the run's process group, or one still its child, is a stray", () => {
    expect(strayChildren(rows, 12, runStart)).toEqual([14, 17])
  })

  test('the run itself, its ancestors, its siblings and other groups are not', () => {
    expect(strayChildren(rows.filter(r => r.pid !== 14 && r.pid !== 17), 12, runStart)).toEqual([])
  })

  test("an orphan in the run's group that started before the run is someone else's", () => {
    const earlier = {command: 'node tests/e2e/ios-appium/wdio.gate.conf.ts', pgid: 10, pid: 18, ppid: 1, startMs: 99_000}
    expect(strayChildren([...rows, earlier], 12, runStart)).toEqual([14, 17])
  })
})

describe('parsePs', () => {
  test('reads pid, ppid, pgid, the start time and the whole command', () => {
    expect(parsePs('  12   1  10    01:05 node a b\n\n', 100_000)).toEqual([{command: 'node a b', pgid: 10, pid: 12, ppid: 1, startMs: 35_000}])
  })

  test('reads elapsed times in hours and days', () => {
    const [h, d] = parsePs('1 1 1 02:00:00 a\n2 1 1 1-00:00:01 b', 1e9)
    expect(h?.startMs).toBe(1e9 - 7_200_000)
    expect(d?.startMs).toBe(1e9 - 86_401_000)
  })

  test('a line with no elapsed time is skipped', () => {
    expect(parsePs('12 1 10 node a b', 100_000)).toEqual([])
  })
})

describe('isMetroGroup', () => {
  const rows = [
    {command: 'node /x/yarn.js rn:start', pgid: 50, pid: 50, ppid: 1, startMs: 0},
    {command: 'node /x/node_modules/.bin/expo start --clear', pgid: 51, pid: 52, ppid: 51, startMs: 0},
    {command: '/usr/bin/some-daemon', pgid: 60, pid: 60, ppid: 1, startMs: 0},
  ]

  test('a group running yarn rn:start or expo start, or holding the port, is a Metro', () => {
    expect(isMetroGroup(rows, 50, [])).toBe(true)
    expect(isMetroGroup(rows, 51, [])).toBe(true)
    expect(isMetroGroup(rows, 60, [60])).toBe(true)
  })

  test('a recycled group id running something else is not', () => {
    expect(isMetroGroup(rows, 60, [])).toBe(false)
    expect(isMetroGroup(rows, 70, [51])).toBe(false)
  })
})

describe('secretScanDirs', () => {
  const dirs = {logsDir: '/s/tests/results/ios-logs', resultsDir: '/s/tests/results', renderRoot: '/s/tests/results/visual/render'}

  test('a run refused at preflight scans only its logs, never the rest of tests/results', () => {
    expect(secretScanDirs({...dirs, preflightPassed: false})).toEqual(['/s/tests/results/ios-logs'])
    expect(secretScanDirs({...dirs, preflightPassed: false, renderRoot: '/elsewhere/render'})).toEqual(['/s/tests/results/ios-logs'])
  })

  test('a run past preflight scans tests/results, which holds the render root', () => {
    expect(secretScanDirs({...dirs, preflightPassed: true})).toEqual(['/s/tests/results'])
  })

  test('a render root outside tests/results is scanned too', () => {
    expect(secretScanDirs({...dirs, preflightPassed: true, renderRoot: '/elsewhere/render'})).toEqual(['/s/tests/results', '/elsewhere/render'])
    expect(secretScanDirs({...dirs, preflightPassed: true, renderRoot: '/s/tests/results-other/render'})).toEqual(['/s/tests/results', '/s/tests/results-other/render'])
  })
})

test("the run refuses a phone without push permission, naming the owner's one-time grant", () => {
  expect(pushPermissionProblem(true, 'iPhoneTest')).toBeUndefined()
  expect(pushPermissionProblem(false, 'iPhoneTest')).toBe(
    'push notifications are off for keybase.ios on iPhoneTest; turn them on once by hand ' +
      '(on the simulator: Settings > Apps > Keybase > Notifications > Allow Notifications), then rerun; ' +
      'the release command never asks for them, as asking opens the Settings app'
  )
})

test('the run refuses a phone whose location was ever asked, naming the reset for keybase.ios', () => {
  const never = {background: 'undetermined', foreground: 'undetermined'}
  expect(locationStartProblem(never, 'iPhoneTest', UDID)).toBeUndefined()
  const reset = `reset it once by hand (xcrun simctl privacy ${UDID} reset location keybase.ios, then relaunch the app), then rerun`
  expect(locationStartProblem({background: 'granted', foreground: 'granted'}, 'iPhoneTest', UDID)).toBe(
    `location is already granted for keybase.ios on iPhoneTest, and the location flow starts from never asked; ${reset}`
  )
  expect(locationStartProblem({background: 'undetermined', foreground: 'granted'}, 'iPhoneTest', UDID)).toMatch(
    /^location is already granted \(background undetermined\) for keybase\.ios on iPhoneTest, /
  )
  expect(locationStartProblem({background: 'denied', foreground: 'undetermined'}, 'iPhoneTest', UDID)).toMatch(/reset location keybase\.ios/)
})

test('the run refuses an app that does not draw the run theme, naming the setting', () => {
  expect(themeProblem(true, 'dark', 'iPhoneTest')).toBeUndefined()
  expect(themeProblem(false, 'light', 'iPhoneTest')).toBeUndefined()
  expect(themeProblem(false, 'dark', 'iPhoneTest')).toBe(
    'keybase.ios on iPhoneTest does not draw dark with the simulator in dark appearance; set its theme to ' +
      '"Respect system settings" (Settings > Display), then rerun'
  )
  expect(themeProblem(true, 'light', 'iPhoneTest')).toMatch(/does not draw light/)
})
