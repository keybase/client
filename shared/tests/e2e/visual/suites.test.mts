/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {SUITES, isSuiteName} from './suites.ts'
import {tour} from './tour.ts'
import {matchEntries} from './tour-types.ts'

test('every suite pattern names a tour entry on some platform', () => {
  for (const [name, patterns] of Object.entries(SUITES)) {
    for (const p of patterns) assert.ok(matchEntries(tour, p).length > 0, `suite ${name}: ${p} names no tour entry`)
  }
})

test('isSuiteName knows only the suites', () => {
  assert.equal(isSuiteName('layout'), true)
  assert.equal(isSuiteName('toString'), false)
  assert.equal(isSuiteName('nope'), false)
})
