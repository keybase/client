import {
  appSignedFromAppinfo,
  iosPreflightProblems,
  isWdaResidue,
  parsePs,
  strayChildren,
  simulatorFromList,
  type IosPreflightState,
} from './release-lib'

const UDID = 'B338EAF5-6A0E-4CAF-BD25-446C674751FB'

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
    expect(only(ok({hostWhoami: {error: 'no answer in 15s', ok: false}}))).toContain('does not answer whoami (no answer in 15s)')
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

  test('a port held by a Metro an earlier release run left is not a problem', () => {
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
    expect(only(ok({peers: [{error: 'no socket', ok: false, role: 'owner'}]}))).toBe('peer owner: no socket')
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
  // a shell (10) runs yarn (11), which runs the release (12) beside a tee (13) and a forked subshell
  // whose command line names the release (16); the release's wdio launcher is gone and its worker
  // (14) was reparented to launchd; a render (17) it started is still its child
  const rows = [
    {command: 'zsh -c yarn test:e2e:ios:release | tee run.log', pgid: 10, pid: 10, ppid: 1},
    {command: 'zsh -c node tests/e2e/ios-appium/release.mts | grep x', pgid: 10, pid: 16, ppid: 10},
    {command: 'node yarn test:e2e:ios:release', pgid: 10, pid: 11, ppid: 10},
    {command: 'node tests/e2e/ios-appium/release.mts', pgid: 10, pid: 12, ppid: 11},
    {command: 'tee run.log', pgid: 10, pid: 13, ppid: 10},
    {command: 'node node_modules/@wdio/local-runner/build/run.js run tests/e2e/ios-appium/wdio.gate.conf.ts', pgid: 10, pid: 14, ppid: 1},
    {command: 'node tests/e2e/visual/cli.mts render --ios', pgid: 99, pid: 15, ppid: 1},
    {command: 'node tests/e2e/visual/cli.mts render --ios', pgid: 10, pid: 17, ppid: 12},
  ]

  test("an orphaned test runner in the run's process group, or one still its child, is a stray", () => {
    expect(strayChildren(rows, 12)).toEqual([14, 17])
  })

  test('the run itself, its ancestors, its siblings and other groups are not', () => {
    expect(strayChildren(rows.filter(r => r.pid !== 14 && r.pid !== 17), 12)).toEqual([])
  })
})

describe('parsePs', () => {
  test('reads pid, ppid, pgid and the whole command', () => {
    expect(parsePs('  12   1  10 node a b\n\n')).toEqual([{command: 'node a b', pgid: 10, pid: 12, ppid: 1}])
  })
})
