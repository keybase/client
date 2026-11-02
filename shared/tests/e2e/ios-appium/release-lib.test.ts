import {
  appSignedFromAppinfo,
  censusPhaseResult,
  flowsPhaseResult,
  iosPreflightProblems,
  isMetroGroup,
  isWdaResidue,
  parsePs,
  reportPhaseResult,
  secretScanDirs,
  strayChildren,
  simulatorFromList,
  writtenSince,
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

  test('another release run holding the lock is the only problem named', () => {
    expect(iosPreflightProblems(ok({hostWhoami: {error: 'x', ok: false}, releaseLockHeld: 'release lock held by pid 9'}))).toEqual([
      'release lock held by pid 9; another release run is going, wait for it to finish',
    ])
  })

  test('the host service on another account refuses, naming the switch command', () => {
    const p = only(ok({hostWhoami: {ok: true, user: 'testuser-mac'}}))
    expect(p).toContain('signed in as testuser-mac, not KB_SMOKE_USER')
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

  test('the visual gate lock held refuses', () => {
    expect(only(ok({lockHeld: 'visual gate lock held by pid 4'}))).toBe('visual gate lock held by pid 4; wait for that run to finish')
  })

  test('a locked macOS session refuses', () => {
    expect(only(ok({screen: {locked: true}}))).toContain('the macOS session is locked')
    expect(only(ok({screen: {error: 'ioreg failed'}}))).toContain('could not tell whether the macOS session is locked (ioreg failed)')
  })

  test('KBFS not answering names its start command', () => {
    expect(only(ok({kbfs: {error: 'timed out', ok: false, path: '/keybase/private/testuser'}}))).toContain('kbfsfuse')
  })

  test('a failing peer refuses, naming its role', () => {
    expect(only(ok({peers: [{error: 'no socket', ok: false, role: 'owner'}]}))).toBe('peer owner: no socket; yarn test:e2e:accounts:setup provisions and signs in the peers')
  })

  test('a failing setup check refuses with its output', () => {
    expect(only(ok({setupCheck: {error: 'team missing\n', ok: false}}))).toBe('yarn test:e2e:accounts:setup --check failed:\n    team missing')
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

describe('censusPhaseResult', () => {
  const start = 1_000
  const line = 'census: routes 8 covered, 0 unclaimed'
  const json = (mtimeMs?: number) => ({path: '/r/ios-census.json', ...(mtimeMs === undefined ? {} : {mtimeMs})})

  it('passes on its census line and a census json written since the phase started', () => {
    expect(censusPhaseResult({code: 0, stdout: `x\n${line}\n`}, json(1_500), start)).toEqual({line: 'routes 8 covered, 0 unclaimed', ok: true})
  })

  it('fails when the child printed no census line, whatever it exited', () => {
    expect(censusPhaseResult({code: 0, stdout: 'nothing\n'}, json(1_500), start)).toEqual({line: 'census exited 0 and printed no census line', ok: false})
  })

  it('fails on a census json left from before the phase, or none', () => {
    expect(censusPhaseResult({code: 0, stdout: line}, json(999), start)).toEqual({
      line: 'routes 8 covered, 0 unclaimed; /r/ios-census.json was not written by this run',
      ok: false,
    })
    expect(censusPhaseResult({code: 0, stdout: line}, json(), start).ok).toBe(false)
  })

  it('fails on a nonzero exit and on a log write failure, keeping the line', () => {
    expect(censusPhaseResult({code: 1, stdout: line}, json(1_500), start)).toEqual({line: 'routes 8 covered, 0 unclaimed', ok: false})
    expect(censusPhaseResult({code: 0, logError: 'EIO', stdout: line}, json(1_500), start)).toEqual({
      line: 'routes 8 covered, 0 unclaimed (its log could not be written: EIO)',
      ok: false,
    })
  })
})

describe('reportPhaseResult', () => {
  const start = 1_000
  const report = (mtimeMs?: number) => ({path: '/r/ios-report.html', ...(mtimeMs === undefined ? {} : {mtimeMs})})

  it('passes on a report written since the phase started', () => {
    expect(reportPhaseResult({code: 0, stdout: ''}, report(1_000), start)).toEqual({line: '/r/ios-report.html', ok: true})
  })

  it('passes on a report written in the second the phase started', () => {
    expect(reportPhaseResult({code: 0, stdout: ''}, report(1_000), 1_700)).toEqual({line: '/r/ios-report.html', ok: true})
  })

  it('fails on a report left from before the phase, or none', () => {
    expect(reportPhaseResult({code: 0, stdout: ''}, report(999), start)).toEqual({
      line: 'report generator exited 0 and /r/ios-report.html was not written by this run',
      ok: false,
    })
    expect(reportPhaseResult({code: 0, stdout: ''}, report(), start).ok).toBe(false)
  })

  it('fails on a nonzero exit and on a log write failure', () => {
    expect(reportPhaseResult({code: 2, stdout: ''}, report(1_500), start)).toEqual({line: 'report generator exited 2', ok: false})
    expect(reportPhaseResult({code: 0, logError: 'EIO', stdout: ''}, report(1_500), start)).toEqual({
      line: '/r/ios-report.html (its log could not be written: EIO)',
      ok: false,
    })
  })
})

describe('writtenSince', () => {
  test('a file written in the same second the phase started counts, as file times may be kept to the second', () => {
    expect(writtenSince({mtimeMs: 5_000, path: '/r/x'}, 5_900)).toBe(true)
  })

  test('a file from an earlier second, or none, does not', () => {
    expect(writtenSince({mtimeMs: 4_999, path: '/r/x'}, 5_000)).toBe(false)
    expect(writtenSince({path: '/r/x'}, 5_000)).toBe(false)
  })
})

describe('flowsPhaseResult', () => {
  const start = 1_000
  const results = (mtimeMs?: number) => ({path: '/r/results.json', ...(mtimeMs === undefined ? {} : {mtimeMs})})
  const summary = {failed: 0, flaky: [], fresh: [], known: [], nowPasses: [], passed: 3, runErrors: [], skipped: []}

  it('summarizes a results json written since the phase started', () => {
    expect(flowsPhaseResult({code: 0, stdout: ''}, results(1_500), start, () => summary)).toEqual({line: '3 passed, 0 failed, 0 flaky, 0 skipped', ok: true, summary})
  })

  it('never reads a results json left from before the phase, or none', () => {
    let reads = 0
    const read = () => {
      reads++
      return summary
    }
    expect(flowsPhaseResult({code: 1, stdout: ''}, results(999), start, read)).toEqual({line: 'wdio exited 1 and wrote no /r/results.json', ok: false})
    expect(flowsPhaseResult({code: 0, logError: 'EIO', stdout: ''}, results(), start, read)).toEqual({
      line: 'wdio exited 0 and wrote no /r/results.json (its log could not be written: EIO)',
      ok: false,
    })
    expect(reads).toBe(0)
  })

  it('fails on a nonzero wdio exit and on a log write failure, keeping the summary line', () => {
    expect(flowsPhaseResult({code: 1, stdout: ''}, results(1_500), start, () => summary)).toMatchObject({line: '3 passed, 0 failed, 0 flaky, 0 skipped (wdio exited 1)', ok: false})
    expect(flowsPhaseResult({code: 0, logError: 'EIO', stdout: ''}, results(1_500), start, () => summary)).toMatchObject({
      line: '3 passed, 0 failed, 0 flaky, 0 skipped (its log could not be written: EIO)',
      ok: false,
    })
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
