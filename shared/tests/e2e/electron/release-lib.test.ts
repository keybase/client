import {
  emptyIncidentBook,
  incidentLines,
  nextWatch,
  noteAlarm,
  preflightProblems,
  probeSample,
  RELEASE_PORTS,
  WATCH_LOADING_THRESHOLD_MS,
  type IncidentBook,
  type PreflightState,
} from './release-lib'

const ok = (over: Partial<PreflightState> = {}): PreflightState => ({
  appPgid: undefined,
  kbfs: {ok: true, path: '/keybase/private/testuser'},
  lockHeld: undefined,
  peers: [
    {ok: true, role: 'second'},
    {ok: true, role: 'owner'},
  ],
  ports: [
    {holders: [], port: 4000},
    {holders: [], port: 9222},
  ],
  screen: {locked: false},
  setupCheck: {ok: true},
  smokeUser: 'testuser',
  whoami: {ok: true, user: 'testuser'},
  ...over,
})

describe('preflightProblems', () => {
  test('a ready machine has none', () => {
    expect(preflightProblems(ok())).toEqual([])
  })

  test('the main service on another account refuses, and never offers to switch it', () => {
    const p = preflightProblems(ok({whoami: {ok: true, user: 'testuser-mac'}}))
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('signed in as testuser-mac, not KB_SMOKE_USER')
    expect(p[0]).toContain('never switches it')
  })

  test('a signed out or silent main service refuses', () => {
    expect(preflightProblems(ok({whoami: {ok: true, user: ''}}))[0]).toContain('signed in as nobody')
    expect(preflightProblems(ok({whoami: {ok: false, error: 'no answer in 15s'}}))[0]).toContain('does not answer whoami (no answer in 15s)')
  })

  test('a port held by a process launch-app.mts did not start refuses, naming it', () => {
    const p = preflightProblems(
      ok({appPgid: 500, ports: [{holders: [{command: 'node server.js', pgid: 77, pid: 78}], port: 4000}]})
    )
    expect(p).toEqual([expect.stringContaining('port 4000 is held by pid 78 (node server.js), which launch-app.mts did not start')])
  })

  test('a port held by the app launch-app.mts started is fine', () => {
    const holders = [{command: 'Electron', pgid: 500, pid: 503}]
    expect(preflightProblems(ok({appPgid: 500, ports: [{holders, port: 9222}]}))).toEqual([])
    // no pidfile: the same holder is unknown
    expect(preflightProblems(ok({ports: [{holders, port: 9222}]}))).toHaveLength(1)
  })

  test("the main process inspector's port is checked with the app's", () => {
    expect(RELEASE_PORTS).toEqual([4000, 9222, 9229])
    const p = preflightProblems(ok({appPgid: 500, ports: [{holders: [{command: 'node --inspect', pgid: 77, pid: 78}], port: 9229}]}))
    expect(p).toEqual([expect.stringContaining('port 9229 is held by pid 78')])
  })

  test('a held visual gate lock refuses', () => {
    const p = preflightProblems(ok({lockHeld: 'visual gate lock held by pid 9 (visual:render) since 2026-10-27T00:00:00.000Z'}))
    expect(p).toEqual([expect.stringContaining('visual gate lock held by pid 9')])
  })

  test('a release lock held by another run refuses before anything else is checked', () => {
    const held = 'release lock held by pid 9 (yarn test:e2e:desktop:release) since 2026-10-27T00:00:00.000Z'
    expect(preflightProblems(ok({releaseLockHeld: held}))).toEqual([`${held}; another release run is going, wait for it to finish`])
    expect(preflightProblems(ok({releaseLockHeld: undefined}))).toEqual([])
  })

  test('a locked macOS session refuses, as does not knowing', () => {
    expect(preflightProblems(ok({screen: {locked: true}}))).toEqual([expect.stringContaining('the macOS session is locked')])
    expect(preflightProblems(ok({screen: {error: 'ioreg timed out'}}))).toEqual([expect.stringContaining('(ioreg timed out)')])
  })

  test('KBFS not answering refuses with the command to start it', () => {
    const p = preflightProblems(ok({kbfs: {error: 'no answer in 15s', ok: false, path: '/keybase/private/testuser'}}))
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('KBFS does not answer for /keybase/private/testuser (no answer in 15s)')
    expect(p[0]).toContain('kbfsfuse -debug -log-file /tmp/kb-e2e/kbfs.log /Volumes/Keybase &')
  })

  test('a failing setup check or peer refuses with what it said', () => {
    expect(preflightProblems(ok({setupCheck: {error: 'e2e peers are not ready:\n  KB_SECOND_PAPERKEY is not set', ok: false}}))[0]).toContain(
      'KB_SECOND_PAPERKEY is not set'
    )
    expect(preflightProblems(ok({peers: [{error: 'is not running', ok: false, role: 'second'}]}))).toEqual(['peer second: is not running'])
  })

  test('every problem is listed at once', () => {
    const p = preflightProblems(
      ok({
        kbfs: {error: 'x', ok: false, path: '/keybase/private/testuser'},
        lockHeld: 'held',
        ports: [{holders: [{command: 'c', pgid: 1, pid: 2}], port: 4000}],
        whoami: {ok: true, user: 'other'},
      })
    )
    expect(p).toHaveLength(4)
  })
  test('preflight refuses a port it could not check', () => {
    expect(preflightProblems(ok({ports: [{error: 'lsof exited 2: x', holders: [], port: 4000}]}))).toEqual([
      'could not tell whether port 4000 is free (lsof exited 2: x); fix lsof and rerun',
    ])
  })
})

describe('renderer watchdog', () => {
  test('probeSample: a mounted app is ok; no root or an empty root is blank; only the static placeholder is loading', () => {
    expect(probeSample({hasRoot: true, placeholderOnly: false, rootChildren: 1})).toEqual({kind: 'ok'})
    expect(probeSample({hasRoot: false, placeholderOnly: false, rootChildren: 0}).kind).toBe('blank')
    expect(probeSample({hasRoot: true, placeholderOnly: false, rootChildren: 0}).kind).toBe('blank')
    expect(probeSample({hasRoot: true, placeholderOnly: true, rootChildren: 1}).kind).toBe('loading')
  })

  const blank = {detail: '#root is empty', kind: 'blank'} as const
  const gone = {detail: 'no main.html page target', kind: 'gone'} as const
  const loading = {detail: '#root holds only the static loading placeholder', kind: 'loading'} as const
  const unanswered = {detail: 'Execution context was destroyed', kind: 'unanswered'} as const

  test('a blank renderer alarms only once it has been bad for the whole threshold', () => {
    let r = nextWatch({}, blank, 0)
    expect(r.alarm).toBeUndefined()
    r = nextWatch(r.state, gone, 5_000)
    expect(r.alarm).toBeUndefined()
    r = nextWatch(r.state, blank, 10_000)
    expect(r.alarm).toEqual({kind: 'blank', text: 'it is blank for 10s (#root is empty; first: #root is empty)'})
    // the clock starts over after an alarm
    expect(nextWatch(r.state, blank, 15_000).alarm).toBeUndefined()
  })

  test('one good poll resets the clock, so a reload that comes back in time never alarms', () => {
    let r = nextWatch({}, blank, 0)
    r = nextWatch(r.state, {kind: 'ok'}, 5_000)
    r = nextWatch(r.state, blank, 9_000)
    expect(nextWatch(r.state, blank, 18_000).alarm).toBeUndefined()
    expect(nextWatch(r.state, blank, 19_000).alarm?.text).toContain('for 10s')
  })

  test('a missing target or a silent renderer alarms the same way', () => {
    const r = nextWatch({}, gone, 0)
    expect(nextWatch(r.state, gone, 12_000).alarm).toEqual({kind: 'gone', text: expect.stringContaining('its target is gone for 12s')})
    const u = nextWatch({}, unanswered, 0)
    expect(nextWatch(u.state, unanswered, 10_000).alarm?.text).toContain('it does not answer')
  })

  test('the loading placeholder is a reload in progress: it alarms only after the loading allowance, past the reload deadline', () => {
    expect(WATCH_LOADING_THRESHOLD_MS).toBeGreaterThanOrEqual(30_000)
    // a slow but healthy reload: the old page stops answering, then the placeholder shows for 20s
    let r = nextWatch({}, unanswered, 0)
    for (let t = 2_000; t <= 22_000; t += 5_000) {
      r = nextWatch(r.state, loading, t)
      expect(r.alarm).toBeUndefined()
    }
    expect(nextWatch(r.state, {kind: 'ok'}, 24_000).alarm).toBeUndefined()
    // a renderer stuck on the placeholder alarms as blank once the whole allowance has passed
    let s = nextWatch({}, loading, 0)
    s = nextWatch(s.state, loading, 29_000)
    expect(s.alarm).toBeUndefined()
    expect(nextWatch(s.state, loading, 30_000).alarm).toEqual({
      kind: 'blank',
      text: 'it shows only the loading placeholder for 30s (#root holds only the static loading placeholder; first: #root holds only the static loading placeholder)',
    })
  })

  test('a placeholder poll restarts the short clock, but the whole bad stretch still counts against the loading allowance', () => {
    let r = nextWatch({}, unanswered, 0)
    r = nextWatch(r.state, loading, 8_000)
    r = nextWatch(r.state, unanswered, 9_000)
    expect(nextWatch(r.state, unanswered, 18_000).alarm).toBeUndefined()
    expect(nextWatch(r.state, unanswered, 19_000).alarm?.kind).toBe('unanswered')
    expect(nextWatch(r.state, unanswered, 30_000).alarm?.text).toContain('for 30s')
  })

  test('the first alarm of a run reloads; after it, one more record per phase and state, then only a count', () => {
    let b: IncidentBook = emptyIncidentBook()
    let n = noteAlarm(b, 'flows', 'blank', 'renderer went blank during flows: a')
    expect(n.action).toBe('reload')
    b = n.book
    n = noteAlarm(b, 'flows', 'blank', 'renderer went blank during flows: b')
    expect(n.action).toBe('record')
    b = n.book
    for (const t of ['c', 'd']) {
      n = noteAlarm(b, 'flows', 'blank', `renderer went blank during flows: ${t}`)
      expect(n.action).toBe('count')
      b = n.book
    }
    n = noteAlarm(b, 'flows', 'gone', 'renderer went blank during flows: gone')
    expect(n.action).toBe('record')
    b = n.book
    n = noteAlarm(b, 'render', 'blank', 'renderer went blank during render: e')
    expect(n.action).toBe('record')
    b = n.book
    expect(incidentLines(b)).toEqual([
      'renderer went blank during flows: a',
      'renderer went blank during flows: b (and 2 more times)',
      'renderer went blank during flows: gone',
      'renderer went blank during render: e',
    ])
  })
})
