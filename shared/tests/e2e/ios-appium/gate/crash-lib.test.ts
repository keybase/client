import {crashMessage, type CrashDeps, type CrashReport, GONE_MESSAGE, makeCrashRecovery, REPORT_WAIT_MS} from './crash-lib'

const RUN_START = 1_000_000

const fake = () => {
  const s = {
    clock: RUN_START,
    logs: [] as Array<string>,
    pid: 42 as number | undefined,
    poisoned: false,
    relaunches: 0,
    relaunchFails: false,
    reports: [] as Array<CrashReport>,
    smokeFails: false,
    smokes: 0,
  }
  const deps: CrashDeps = {
    appPid: () => s.pid,
    log: line => s.logs.push(line),
    now: () => s.clock,
    relaunch: async () => {
      s.relaunches++
      await Promise.resolve()
      if (s.relaunchFails) throw new Error('no runtime')
      s.pid = 43
    },
    reportsSince: since => s.reports.filter(r => r.mtimeMs >= since),
    sleep: async ms => {
      s.clock += ms
      await Promise.resolve()
    },
    smoke: async () => {
      s.smokes++
      await Promise.resolve()
      if (s.smokeFails) throw new Error('signed in as KB_SECOND_USER')
    },
    stop: () => {
      s.poisoned = true
    },
    stopped: () => s.poisoned,
  }
  return {deps, s}
}

test('a running app is left alone', async () => {
  const {deps, s} = fake()
  const r = makeCrashRecovery(deps, RUN_START)
  expect(await r.recover({crashOnly: false})).toBeUndefined()
  expect(s.relaunches).toBe(0)
})

test('a crashed app is relaunched, read back on smoke, and its newest report named', async () => {
  const {deps, s} = fake()
  const r = makeCrashRecovery(deps, RUN_START)
  s.reports = [
    {mtimeMs: RUN_START - 1, path: '/r/Keybase-before-run.ips'},
    {mtimeMs: RUN_START + 5, path: '/r/Keybase-older.ips'},
    {mtimeMs: RUN_START + 9, path: '/r/Keybase-newest.ips'},
  ]
  s.pid = undefined
  expect(await r.recover({crashOnly: true})).toBe(crashMessage('/r/Keybase-newest.ips'))
  expect(crashMessage('/r/x.ips')).toMatch(/^the app crashed \(its crash report: \/r\/x\.ips\)/)
  expect(s.relaunches).toBe(1)
  expect(s.smokes).toBe(1)
  expect(s.logs).toEqual(['the app crashed; its crash report: /r/Keybase-newest.ips'])
})

test('a report from before the app was last seen running is not its crash', async () => {
  const {deps, s} = fake()
  const r = makeCrashRecovery(deps, RUN_START)
  // a crash a flow's own relaunch covered: the app was seen running after it
  s.reports = [{mtimeMs: RUN_START + 5, path: '/r/Keybase-earlier.ips'}]
  s.clock = RUN_START + 10
  await r.recover({crashOnly: false})
  s.pid = undefined
  expect(await r.recover({crashOnly: false})).toBe(GONE_MESSAGE)
  expect(s.relaunches).toBe(1)
})

test('a report is claimed once', async () => {
  const {deps, s} = fake()
  const r = makeCrashRecovery(deps, RUN_START)
  s.reports = [{mtimeMs: RUN_START + 5, path: '/r/Keybase-one.ips'}]
  s.pid = undefined
  await r.recover({crashOnly: false})
  // gone again before the clock moved past the report
  s.clock = RUN_START
  s.pid = undefined
  expect(await r.recover({crashOnly: false})).toBe(GONE_MESSAGE)
})

test("at a body's end, an app gone with no report is left alone after the report wait", async () => {
  const {deps, s} = fake()
  const r = makeCrashRecovery(deps, RUN_START)
  s.pid = undefined
  expect(await r.recover({crashOnly: true})).toBeUndefined()
  expect(s.relaunches).toBe(0)
  expect(s.clock - RUN_START).toBeGreaterThanOrEqual(REPORT_WAIT_MS)
  expect(s.clock - RUN_START).toBeLessThan(REPORT_WAIT_MS + 2_000)
})

test('in a root hook, an app gone with no report is relaunched and the test told so', async () => {
  const {deps, s} = fake()
  const r = makeCrashRecovery(deps, RUN_START)
  s.pid = undefined
  expect(await r.recover({crashOnly: false})).toBe(GONE_MESSAGE)
  expect(s.relaunches).toBe(1)
  expect(s.logs).toEqual(['the app was not running and left no crash report'])
})

test('a report written during the wait is found', async () => {
  const {deps, s} = fake()
  const sleep = deps.sleep
  deps.sleep = async ms => {
    await sleep(ms)
    if (s.clock >= RUN_START + 3_000) s.reports = [{mtimeMs: RUN_START + 2_500, path: '/r/Keybase-late.ips'}]
  }
  const r = makeCrashRecovery(deps, RUN_START)
  s.pid = undefined
  expect(await r.recover({crashOnly: true})).toBe(crashMessage('/r/Keybase-late.ips'))
})

test('the relaunch runs through the caller-given runner', async () => {
  const {deps, s} = fake()
  const r = makeCrashRecovery(deps, RUN_START)
  s.pid = undefined
  const ran: Array<string> = []
  await r.recover({
    crashOnly: false,
    relaunch: async f => {
      ran.push('in the attempt')
      await f()
    },
  })
  expect(ran).toEqual(['in the attempt'])
  expect(s.relaunches).toBe(1)
})

type Fake = ReturnType<typeof fake>['s']
const breaks: Array<[string, (s: Fake) => void, RegExp]> = [
  ['relaunch', s => (s.relaunchFails = true), /bringing it back failed: no runtime/],
  ['read-back', s => (s.smokeFails = true), /bringing it back failed: signed in as KB_SECOND_USER/],
]
for (const [what, breakIt, why] of breaks) {
  test(`a failed ${what} stops the gate, and no later call relaunches until the stop is cleared`, async () => {
    const {deps, s} = fake()
    const r = makeCrashRecovery(deps, RUN_START)
    s.reports = [{mtimeMs: RUN_START + 5, path: '/r/Keybase-c.ips'}]
    breakIt(s)
    s.pid = undefined
    const stoppedWhy = await r.recover({crashOnly: true})
    expect(stoppedWhy).toMatch(why)
    expect(stoppedWhy).toMatch(/^stopping the gate: the app was gone \(its crash report: \/r\/Keybase-c\.ips\)/)
    expect(s.poisoned).toBe(true)
    expect(s.logs.at(-1)).toBe(stoppedWhy)
    const relaunches = s.relaunches
    expect(await r.recover({crashOnly: false})).toBeUndefined()
    expect(s.relaunches).toBe(relaunches)
    // something else brought the app back and cleared the stop: a later crash is recovered again
    s.poisoned = false
    s.relaunchFails = false
    s.smokeFails = false
    s.pid = undefined
    s.reports = [{mtimeMs: RUN_START + 6, path: '/r/Keybase-d.ips'}]
    expect(await r.recover({crashOnly: false})).toBe(crashMessage('/r/Keybase-d.ips'))
    expect(s.relaunches).toBe(relaunches + 1)
  })
}

test('a call while a recovery runs waits for it and gets its answer, with one relaunch', async () => {
  const {deps, s} = fake()
  let release: () => void = () => {}
  deps.relaunch = async () => {
    s.relaunches++
    await new Promise<void>(resolve => {
      release = resolve
    })
    s.pid = 43
  }
  const r = makeCrashRecovery(deps, RUN_START)
  s.reports = [{mtimeMs: RUN_START + 5, path: '/r/Keybase-c.ips'}]
  s.pid = undefined
  const first = r.recover({crashOnly: true})
  await new Promise(resolve => setImmediate(resolve))
  expect(r.recovering()).toBeDefined()
  const second = r.recover({crashOnly: false})
  release()
  expect(await first).toBe(crashMessage('/r/Keybase-c.ips'))
  expect(await second).toBe(crashMessage('/r/Keybase-c.ips'))
  expect(s.relaunches).toBe(1)
  expect(r.recovering()).toBeUndefined()
})

test("a root hook waiting on a body's check that left a gone app brings it back itself", async () => {
  const {deps, s} = fake()
  let wake: () => void = () => {}
  deps.sleep = async ms => {
    s.clock += ms
    await new Promise<void>(resolve => {
      wake = resolve
    })
  }
  const r = makeCrashRecovery(deps, RUN_START)
  s.pid = undefined
  const body = r.recover({crashOnly: true})
  const hook = r.recover({crashOnly: false})
  for (let i = 0; i < 40 && s.relaunches === 0; i++) {
    await new Promise(resolve => setImmediate(resolve))
    wake()
  }
  expect(await body).toBeUndefined()
  expect(await hook).toBe(GONE_MESSAGE)
  expect(s.relaunches).toBe(1)
})
