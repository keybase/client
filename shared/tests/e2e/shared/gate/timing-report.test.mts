/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {summarize} from './timing-report.mts'

test('idle is test time with nothing in flight, charged to the call that ended it', () => {
  const r = summarize([
    {end: 10_000, kind: 'test', name: 'flow > a test', start: 0, status: 'passed'},
    {end: 1_000, kind: 'command', name: 'click', site: 'flows/a.test.ts:5', start: 0},
    // nested inside the click: no gap
    {end: 900, kind: 'eval', name: 'eval', site: 'helpers/x.ts:9', start: 100},
    // 3s with nothing in flight, ended by this eval
    {end: 4_500, kind: 'eval', name: 'eval', site: 'gate/screens.ts:70', start: 4_000},
    {end: 9_000, kind: 'expect', name: 'Expect "toBeVisible"', site: 'flows/a.test.ts:7', start: 5_000},
    // outside the test: ignored
    {end: 20_500, kind: 'command', name: 'click', site: 'flows/b.test.ts:1', start: 20_000},
  ])
  assert.equal(r.tests, 1)
  assert.equal(r.testMs, 10_000)
  // 1000-4000, 4500-5000 and 9000-10000
  assert.equal(r.idleMs, 4_500)
  assert.deepEqual(r.idleBySite, [
    ['gate/screens.ts:70 (before eval eval)', 3_000, 1],
    ['(after the last call, to the test end)', 1_000, 1],
    ['flows/a.test.ts:7 (before expect Expect "toBeVisible")', 500, 1],
  ])
  assert.equal(r.expectMs, 4_000)
  assert.deepEqual(r.expectBySite, [['flows/a.test.ts:7 Expect "toBeVisible"', 4_000, 1]])
})

test("the hooks between two tests count toward the test after them", () => {
  const r = summarize([
    {end: 1_000, kind: 'test', name: 'first', start: 0, status: 'passed'},
    {end: 900, kind: 'command', name: 'click', site: 'flows/a.test.ts:1', start: 0},
    // a root hook after the first test ends, before the second's beforeTest marks its start
    {end: 3_000, kind: 'command', name: 'gate: before, the account check', site: '', start: 2_000},
    {end: 5_000, kind: 'test', name: 'second', start: 4_000, status: 'passed'},
    {end: 5_000, kind: 'command', name: 'click', site: 'flows/b.test.ts:1', start: 4_000},
  ])
  // the second test's window runs from 1000: idle 1000-2000 and 3000-4000, the hook 2000-3000
  assert.equal(r.testMs, 5_000)
  assert.equal(r.idleMs, 2_100)
  assert.deepEqual(r.slowestTests[0], ['second', 4_000, 1])
  assert.ok(r.commandBySite.some(([k]) => k.includes('gate: before, the account check')))
})
