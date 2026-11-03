/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {buildChecklist, buildReport, chooseCardStep, parseStepName, sortSteps, type CardData} from './generate-report-shared.mts'

const card = (label: string, passed: boolean, extra: Partial<CardData> = {}): CardData => ({
  diff: null,
  durationMs: 10,
  errorMessage: passed ? null : 'boom',
  label,
  passed,
  prevScreenshotPath: null,
  screenshotPath: null,
  ...extra,
})

test('parseStepName reads the counter and the name', () => {
  assert.deepEqual(parseStepName('step-03-modal-open'), {n: 3, slug: 'modal-open'})
  assert.equal(parseStepName('screenshot'), null)
  assert.equal(parseStepName('step-x-nope'), null)
})

test('sortSteps orders by NN, not attachment order, and drops non-steps', () => {
  const out = sortSteps([{name: 'step-10-c'}, {name: 'screenshot'}, {name: 'step-02-b'}, {name: 'step-01-a'}])
  assert.deepEqual(out.map(s => s.name), ['step-01-a', 'step-02-b', 'step-10-c'])
})

test('failed cards come before passed cards', () => {
  const html = buildReport('t', [{cards: [card('passing-one', true), card('failing-one', false)]}], 'now', '/tmp/x/out.html')
  assert.ok(html.indexOf('failing-one') < html.indexOf('passing-one'))
})

test('a card shows its step strip in order and failure details', () => {
  const steps = [
    {name: 'one', path: '/tmp/x/s1.png'},
    {name: 'two', path: '/tmp/x/s2.png'},
  ]
  const html = buildReport(
    't',
    [{cards: [card('c', false, {details: [{name: 'app-log-tail', text: 'LOGLINE <b>'}], steps})]}],
    'now',
    '/tmp/x/out.html'
  )
  assert.ok(html.indexOf('s1.png') < html.indexOf('s2.png'))
  assert.ok(html.includes('LOGLINE &lt;b&gt;'))
  assert.ok(html.includes('app-log-tail'))
})

test('checklist marks reached and not-reached entries', () => {
  const md = buildChecklist(
    [
      {doByHand: 'do a', id: 'a', title: 'Thing A'},
      {doByHand: 'do b', id: 'b', title: 'Thing B'},
    ],
    new Map([['a', 'electron-debug/x/step-02-manual-a.png']])
  )
  const lines = md.trim().split('\n')
  assert.equal(lines[0], '- [ ] Thing A: do a ([screenshot](electron-debug/x/step-02-manual-a.png))')
  assert.equal(lines[1], '- [ ] Thing B: do b (not reached this run)')
})

test('the card step is the marked one, else the first', () => {
  const steps = [{name: 'step-01-a'}, {name: 'step-02-b'}, {name: 'step-03-c'}]
  assert.equal(chooseCardStep(steps, ['step-02-b'])?.name, 'step-02-b')
  assert.equal(chooseCardStep(steps, [])?.name, 'step-01-a')
  assert.equal(chooseCardStep(steps, ['step-09-gone'])?.name, 'step-01-a')
  assert.equal(chooseCardStep([], []), undefined)
})

test('a failed card shows its failure shot separately only when it is not the card image', () => {
  const same = buildReport(
    't',
    [{cards: [card('c', false, {failureScreenshotPath: '/tmp/x/c.png', screenshotPath: '/tmp/x/c.png'})]}],
    'now',
    '/tmp/x/out.html'
  )
  assert.equal(same.split('c.png').length - 1, 1)
  assert.ok(!same.includes('AT FAILURE'))
  const other = buildReport(
    't',
    [{cards: [card('c', false, {failureScreenshotPath: '/tmp/x/c-failure.png', screenshotPath: '/tmp/x/c.png'})]}],
    'now',
    '/tmp/x/out.html'
  )
  assert.ok(other.includes('c-failure.png'))
  assert.ok(other.includes('AT FAILURE'))
})
