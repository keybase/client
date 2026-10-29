import {eachFlowTest, flowTestName, summarizeFlows} from '../../shared/gate/release-lib'
import type {AttemptRecord} from './attempt'
import {buildPwReport, testFileFromStack, unranPendingTests, type GateTest} from './results-lib'

const attempt = (over: Partial<AttemptRecord>): AttemptRecord => ({
  annotations: [],
  attachments: [],
  attempt: 0,
  durationMs: 10,
  file: 'tests/e2e/ios-appium/flows/x.test.ts',
  status: 'passed',
  titlePath: ['d', 'title'],
  ...over,
})

const tests = (attempts: ReadonlyArray<AttemptRecord>) => {
  const out: Array<{name: string; test: GateTest}> = []
  eachFlowTest(buildPwReport(attempts, 'ios-flows').suites, 'ios-flows', (test, file, titles) => {
    out.push({name: flowTestName(file, titles), test})
  })
  return out
}

test('one passing attempt is expected, with one result', () => {
  const [t, ...rest] = tests([attempt({})])
  expect(rest).toEqual([])
  expect(t?.test.status).toBe('expected')
  expect(t?.test.results.map(r => r.status)).toEqual(['passed'])
})

test('a failed attempt then a passing one is flaky, with both results in order', () => {
  const [t] = tests([attempt({error: 'boom', status: 'failed'}), attempt({attempt: 1, durationMs: 20})])
  expect(t?.test.status).toBe('flaky')
  expect(t?.test.results).toEqual([
    {attachments: [], duration: 10, errors: [{message: 'boom'}], retry: 0, status: 'failed'},
    {attachments: [], duration: 20, errors: [], retry: 1, status: 'passed'},
  ])
})

test('a last attempt that failed is unexpected, and an all-skipped test is skipped', () => {
  const failed = attempt({status: 'failed'})
  const skipped = attempt({status: 'skipped', titlePath: ['d', 'other']})
  expect(tests([attempt({}), {...failed, attempt: 1}, skipped]).map(t => t.test.status)).toEqual(['unexpected', 'skipped'])
})

test('nested describes nest as suites under the file suite', () => {
  const report = buildPwReport([attempt({file: 'flows/x.test.ts', titlePath: ['a', 'b', 'title']})], 'ios-flows')
  const [file] = report.suites
  expect(file?.title).toBe('x.test.ts')
  expect(file?.specs).toEqual([])
  const a = file?.suites[0]
  expect(a?.title).toBe('a')
  expect(a?.specs).toEqual([])
  const b = a?.suites[0]
  expect(b?.title).toBe('b')
  expect(b?.specs.map(s => [s.title, s.file])).toEqual([['title', 'flows/x.test.ts']])
  expect(tests([attempt({file: 'flows/x.test.ts', titlePath: ['a', 'b', 'title']})]).map(t => t.name)).toEqual([
    'x › a › b › title',
  ])
})

test('tests of one file share its suite, in the order they first ran', () => {
  const report = buildPwReport(
    [
      attempt({titlePath: ['d', 'first']}),
      attempt({file: 'flows/y.test.ts', titlePath: ['top']}),
      attempt({titlePath: ['d', 'second']}),
    ],
    'ios-flows'
  )
  expect(report.suites.map(s => s.title)).toEqual(['x.test.ts', 'y.test.ts'])
  expect(report.suites[0]?.suites[0]?.specs.map(s => s.title)).toEqual(['first', 'second'])
  expect(report.suites[1]?.specs.map(s => s.title)).toEqual(['top'])
})

test('annotations from every attempt are kept once each, and attachments pass through', () => {
  const card = {description: 'opened', type: 'card-step'}
  const png = {contentType: 'image/png', name: 'step-01-opened', path: '/r/a/step-01-opened.png'}
  const report = buildPwReport(
    [
      attempt({annotations: [card], attachments: [png], status: 'failed'}),
      attempt({annotations: [card, {description: 'x', type: 'retried'}], attempt: 1}),
    ],
    'ios-flows'
  )
  const t = report.suites[0]?.suites[0]?.specs[0]?.tests[0]
  expect(t?.projectName).toBe('ios-flows')
  expect(t?.annotations).toEqual([card, {description: 'x', type: 'retried'}])
  expect(t?.results.map(r => r.attachments)).toEqual([[png], []])
})

test('a describe is credited to the first test file on its call stack', () => {
  const stack = [
    'Error',
    '    at describe (file:///r/tests/e2e/ios-appium/gate/hooks.ts:30:18)',
    '    at Suite.<anonymous> (file:///r/tests/e2e/ios-appium/flows/my%20flow.test.ts:5:3)',
    '    at file:///r/tests/e2e/ios-appium/gate.test.ts:4:1',
  ].join('\n')
  expect(testFileFromStack(stack)).toBe('/r/tests/e2e/ios-appium/flows/my flow.test.ts')
  expect(testFileFromStack('Error\n    at /r/flows/x.test.ts:1:1')).toBe('/r/flows/x.test.ts')
  expect(testFileFromStack('Error\n    at /r/gate/hooks.ts:1:1')).toBeUndefined()
})

test('pending tests that never began an attempt are the ones still to record', () => {
  const t = (name: string, pending: boolean) => ({isPending: () => pending, name})
  const skippedInBody = t('skipped in its body', true)
  const root = {
    suites: [{suites: [], tests: [t('nested pending', true), t('ran', false)]}],
    tests: [t('pending', true), skippedInBody],
  }
  expect(unranPendingTests(root, x => x === skippedInBody).map(x => x.name)).toEqual(['pending', 'nested pending'])
})

test('a skipped test is reported skipped, and the release summary lists it', () => {
  const report = buildPwReport([attempt({}), attempt({durationMs: 0, status: 'skipped', titlePath: ['d', 'later']})], 'ios-flows')
  expect(summarizeFlows(report, 'ios-flows', {})).toMatchObject({passed: 1, skipped: ['x › d › later']})
})
