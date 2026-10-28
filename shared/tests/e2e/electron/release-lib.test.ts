import {knownFlowCause, knownNote, knownVerdict} from './known-failures'
import {
  flowsLine,
  flowProblems,
  flowsOk,
  renderLine,
  summarizeFlows,
  summarizeRender,
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

  test('match by file and title path, or the title path alone', () => {
    expect(knownFlowCause('a', ['paging', 'slow'], known)).toBe('Task 10: slow')
    expect(knownFlowCause('b', ['shared title'], known)).toBe('Task 10: by title')
    expect(knownFlowCause('b', ['paging', 'slow'], known)).toBeUndefined()
  })

  test('a known failure is labelled but still a failure; a passing one asks to be removed', () => {
    expect(knownVerdict(false, 'x')).toBe('known failure')
    expect(knownNote('known failure', 'Task 10: slow')).toBe('known on master: Task 10: slow')
    expect(knownVerdict(true, 'x')).toBe('known now passes')
    expect(knownNote('known now passes', 'x')).toContain('known failure now passes — remove it')
    expect(knownVerdict(false, undefined)).toBe('new failure')
    expect(knownNote('new failure', undefined)).toBeUndefined()
  })

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
      'electron-flows'
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
      'electron-flows'
    )
    expect(flowsOk(s, 0)).toBe(false)
    expect(flowProblems(s)).toEqual(['skipped: c › not run'])
    expect(flowProblems(summarizeFlows(report([{file: 'b', status: 'expected', title: 'fine'}]), 'electron-flows'))).toEqual([])
  })

  test('a run error or a non-zero exit fails the flows even with no failed test', () => {
    const s = summarizeFlows({errors: ['\x1b[31mglobal setup threw\x1b[39m\nat x'], suites: []}, 'electron-flows')
    expect(s.runErrors).toEqual(['global setup threw'])
    expect(flowsOk(s, 1)).toBe(false)
    expect(flowsOk(summarizeFlows(report([{file: 'b', status: 'expected', title: 't'}]), 'electron-flows'), 1)).toBe(false)
    expect(flowsOk(summarizeFlows(report([{file: 'b', status: 'expected', title: 't'}]), 'electron-flows'), 0)).toBe(true)
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
