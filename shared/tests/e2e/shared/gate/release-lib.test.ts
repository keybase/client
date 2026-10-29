import {
  flowProblems,
  flowsLine,
  flowsOk,
  parseLsof,
  parseTimeoutMin,
  releaseFailed,
  renderLine,
  summarizeFlows,
  summarizeRender,
  summaryLines,
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
    expect(t).toEqual({failed: 2, fresh: ['settings/x'], known: ['window/menubar'], nowPasses: ['chat/content-top'], passed: 2})
    expect(renderLine(t)).toBe('2 rendered, 2 failed (1 known on master, 1 new); 1 known failures now pass')
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
    expect(parseTimeoutMin(undefined)).toEqual({minutes: 150})
    expect(parseTimeoutMin('')).toEqual({minutes: 150})
    expect(parseTimeoutMin('2.5')).toEqual({minutes: 2.5})
    // the longest a timer can wait
    expect(parseTimeoutMin('35791')).toEqual({minutes: 35791})
  })
  test('anything else is refused, naming the value', () => {
    for (const bad of ['0', '-5', 'abc', 'Infinity', '10m', '35792']) {
      expect(parseTimeoutMin(bad)).toEqual({error: expect.stringContaining(`KB_E2E_RELEASE_TIMEOUT_MIN=${JSON.stringify(bad)}`)})
    }
  })
})
