import {
  censusPhaseResult,
  commonPreflightProblems,
  flowProblems,
  flowsPhaseResult,
  flowsLine,
  flowsOk,
  parseLsof,
  parseTimeoutMin,
  releaseFailed,
  reportPhaseResult,
  renderLine,
  summarizeFlows,
  summarizeRender,
  summaryLines,
  writtenSince,
  type PwReport,
} from './release-lib'

const report = (tests: Array<{file: string; describe?: string; title: string; status: string; error?: string}>): PwReport => ({
  suites: tests.map(t => {
    const spec = {
      file: `flows/${t.file}.test.ts`,
      tests: [
        {projectName: 'electron-flows', results: [{errors: t.error ? [{message: `\x1b[31m${t.error}\x1b[39m\nstack`}] : [], status: 'x'}], status: t.status},
        {projectName: 'electron-flows-dark', results: [], status: 'unexpected'},
      ],
      title: t.title,
    }
    return t.describe
      ? {suites: [{specs: [spec], title: t.describe}], title: `flows/${t.file}.test.ts`}
      : {specs: [spec], title: `flows/${t.file}.test.ts`}
  }),
})

describe('known failures', () => {
  const known = {'a › paging › slow': 'Task 10: slow', 'shared title': 'Task 10: by title'}

  test('summarizeFlows counts known failures as failures and splits them from new ones', () => {
    const s = summarizeFlows(
      report([
        {describe: 'paging', file: 'a', status: 'unexpected', title: 'slow', error: 'moved'},
        {file: 'a', status: 'unexpected', title: 'broken'},
        {file: 'b', status: 'expected', title: 'shared title'},
        {file: 'b', status: 'flaky', title: 'retried'},
        {file: 'b', status: 'skipped', title: 'skipped one'},
      ]),
      'electron-flows',
      known
    )
    expect(s).toMatchObject({
      failed: 2,
      flaky: ['b › retried'],
      fresh: ['a › broken'],
      known: ['a › paging › slow'],
      nowPasses: ['b › shared title'],
      passed: 1,
      skipped: ['b › skipped one'],
    })
    expect(flowsLine(s)).toBe('1 passed, 2 failed (1 known on master, 1 new), 1 flaky, 1 skipped; 1 known failures now pass')
    expect(flowsOk(s, 1)).toBe(false)
  })

  test('a flaky test fails the flows even when playwright exits 0, named as flaky', () => {
    const s = summarizeFlows(
      report([
        {file: 'b', status: 'expected', title: 'fine'},
        {describe: 'group', file: 'b', status: 'flaky', title: 'retried'},
      ]),
      'electron-flows',
      {}
    )
    expect(s.passed).toBe(1)
    expect(s.failed).toBe(0)
    expect(flowsOk(s, 0)).toBe(false)
    expect(flowProblems(s)).toEqual(['flaky: b › group › retried'])
  })

  test('a skipped test fails the flows even when playwright exits 0, named as skipped', () => {
    const s = summarizeFlows(
      report([
        {file: 'b', status: 'expected', title: 'fine'},
        {file: 'c', status: 'skipped', title: 'not run'},
      ]),
      'electron-flows',
      {}
    )
    expect(flowsOk(s, 0)).toBe(false)
    expect(flowProblems(s)).toEqual(['skipped: c › not run'])
    expect(flowProblems(summarizeFlows(report([{file: 'b', status: 'expected', title: 'fine'}]), 'electron-flows', {}))).toEqual([])
  })

  test('a run error or a non-zero exit fails the flows even with no failed test', () => {
    const s = summarizeFlows({errors: ['\x1b[31mglobal setup threw\x1b[39m\nat x'], suites: []}, 'electron-flows', {})
    expect(s.runErrors).toEqual(['global setup threw'])
    expect(flowsOk(s, 1)).toBe(false)
    expect(flowsOk(summarizeFlows(report([{file: 'b', status: 'expected', title: 't'}]), 'electron-flows', {}), 1)).toBe(false)
    expect(flowsOk(summarizeFlows(report([{file: 'b', status: 'expected', title: 't'}]), 'electron-flows', {}), 0)).toBe(true)
  })

  test('summarizeRender labels known tour entries', () => {
    const t = summarizeRender(
      [
        {id: 'window/menubar', status: 'failed'},
        {id: 'settings/x', status: 'failed'},
        {id: 'chat/content-top', status: 'ok'},
        {id: 'settings/y', status: 'unstable'},
      ],
      {'chat/content-top': 'c', 'window/menubar': 'm'}
    )
    expect(t).toEqual({failed: 2, fresh: ['settings/x'], known: ['window/menubar'], nowPasses: ['chat/content-top'], passed: 2, recaptured: []})
    expect(renderLine(t)).toBe('2 rendered, 2 failed (1 known on master, 1 new); 1 known failures now pass')
  })

  test('renderLine counts the entries that passed on a second capture after the inspector page dropped', () => {
    const t = summarizeRender(
      [
        {id: 'settings/display', note: 'recaptured after the inspector page dropped: x', status: 'ok'},
        {id: 'settings/about', note: 'recaptured after the inspector page dropped: y', status: 'unstable'},
        {id: 'settings/chat', status: 'ok'},
      ],
      {}
    )
    expect(t.recaptured).toEqual(['settings/display', 'settings/about'])
    expect(renderLine(t)).toBe('3 rendered, 0 failed, 2 recaptured after the inspector page dropped')
    // a row without a note, as every desktop row is, adds nothing to the line
    expect(renderLine(summarizeRender([{id: 'settings/chat', status: 'ok'}], {}))).toBe('1 rendered, 0 failed')
  })
})

describe('summary', () => {
  test('one line per phase; any failed phase fails the release', () => {
    const phases = [
      {line: 'ready', ms: 4_000, name: 'preflight', ok: true},
      {line: '1 passed, 1 failed', ms: 125_000, name: 'flows', ok: false},
    ]
    expect(summaryLines(phases)).toEqual(['ok   preflight  ready (4s)', 'FAIL flows      1 passed, 1 failed (2m05s)'])
    expect(releaseFailed(phases)).toBe(true)
    expect(releaseFailed([phases[0]!])).toBe(false)
  })
})

describe('parseLsof', () => {
  test('exit 0 lists the listening pids; exit 1 with no output is a free port', () => {
    expect(parseLsof({status: 0, stderr: '', stdout: '123\n456\n'})).toEqual({pids: [123, 456]})
    expect(parseLsof({status: 1, stderr: '', stdout: ''})).toEqual({pids: []})
  })
  test('any other result is an error, never a free port', () => {
    expect(parseLsof({status: 1, stderr: 'lsof: unacceptable port specification', stdout: ''})).toEqual({
      error: 'lsof exited 1: lsof: unacceptable port specification',
    })
    expect(parseLsof({error: 'spawnSync lsof ENOENT', status: null, stderr: '', stdout: ''})).toEqual({error: 'spawnSync lsof ENOENT'})
    expect(parseLsof({status: null, stderr: '', stdout: ''})).toEqual({error: 'lsof exited null: (no output)'})
  })
})

describe('parseTimeoutMin', () => {
  test('unset uses the default; a positive number is taken', () => {
    expect(parseTimeoutMin(undefined, 150)).toEqual({minutes: 150})
    expect(parseTimeoutMin('', 150)).toEqual({minutes: 150})
    expect(parseTimeoutMin('2.5', 150)).toEqual({minutes: 2.5})
    // the longest a timer can wait
    expect(parseTimeoutMin('35791', 150)).toEqual({minutes: 35791})
  })
  test('anything else is refused, naming the value', () => {
    for (const bad of ['0', '-5', 'abc', 'Infinity', '10m', '35792']) {
      expect(parseTimeoutMin(bad, 150)).toEqual({error: expect.stringContaining(`KB_E2E_RELEASE_TIMEOUT_MIN=${JSON.stringify(bad)}`)})
    }
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

describe('commonPreflightProblems', () => {
  const lockedWhy = 'a locked session throttles the simulator'
  const problems = (s: Parameters<typeof commonPreflightProblems>[0], platform: Array<string> = []) => commonPreflightProblems(s, () => [...platform], {lockedWhy})

  test('another release run holding the lock is the only problem named', () => {
    expect(problems({lockHeld: 'x', releaseLockHeld: 'release lock held by pid 9'}, ['platform'])).toEqual([
      'release lock held by pid 9; another release run is going, wait for it to finish',
    ])
  })

  test("the platform's problems come first, then each common one", () => {
    expect(
      problems(
        {
          kbfs: {error: 'timed out', ok: false, path: '/keybase/private/testuser'},
          lockHeld: 'visual gate lock held by pid 4',
          peers: [{error: 'no socket', ok: false, role: 'owner'}, {ok: true, role: 'second'}],
          screen: {locked: true},
          setupCheck: {error: 'team missing\n', ok: false},
        },
        ['platform']
      )
    ).toEqual([
      'platform',
      'visual gate lock held by pid 4; wait for that run to finish',
      'the macOS session is locked, and a locked session throttles the simulator; unlock it and rerun',
      'KBFS does not answer for /keybase/private/testuser (timed out); start it: ~/go/bin/kbfsfuse -debug -log-file /tmp/kb-e2e/kbfs.log /Volumes/Keybase &',
      'peer owner: no socket; yarn test:e2e:accounts:setup provisions and signs in the peers',
      'yarn test:e2e:accounts:setup --check failed:\n    team missing',
    ])
  })

  test('not knowing whether the session is locked refuses; nothing checked is fine', () => {
    expect(problems({screen: {error: 'ioreg failed'}})).toEqual(['could not tell whether the macOS session is locked (ioreg failed); fix ioreg and rerun'])
    expect(problems({})).toEqual([])
  })
})
