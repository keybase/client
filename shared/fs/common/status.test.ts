/// <reference types="jest" />
import {getJournalWaitDuration} from './status'

const NOW = 1_000_000

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('missing endEstimate waits the upper bound', () => {
  expect(getJournalWaitDuration(undefined, 100, 4000)).toBe(4000)
})

test('endEstimate of 0 is treated as missing', () => {
  expect(getJournalWaitDuration(0, 100, 4000)).toBe(4000)
})

test('an estimate inside the range is used as-is', () => {
  expect(getJournalWaitDuration(NOW + 1234, 100, 4000)).toBe(1234)
})

test('an estimate further out than upper is clamped to upper', () => {
  expect(getJournalWaitDuration(NOW + 999999, 100, 4000)).toBe(4000)
})

test('an estimate sooner than lower is clamped to lower', () => {
  expect(getJournalWaitDuration(NOW + 5, 100, 4000)).toBe(100)
})

test('an estimate in the past is clamped to lower', () => {
  expect(getJournalWaitDuration(NOW - 100000, 100, 4000)).toBe(100)
})

test('boundary values are kept, not clamped', () => {
  expect(getJournalWaitDuration(NOW + 100, 100, 4000)).toBe(100)
  expect(getJournalWaitDuration(NOW + 4000, 100, 4000)).toBe(4000)
})
