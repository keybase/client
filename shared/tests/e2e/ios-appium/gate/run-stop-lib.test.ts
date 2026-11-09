import {DEFAULT_MAX_CONSECUTIVE_FAILURES, makeFailureStreak, maxConsecutiveFailures} from './run-stop-lib'

test('a streak of failures stops the run; a pass starts the count again', () => {
  const note = makeFailureStreak(3)
  expect(note('a', true)).toBeUndefined()
  expect(note('b', true)).toBeUndefined()
  expect(note('c', false)).toBeUndefined()
  expect(note('d', true)).toBeUndefined()
  expect(note('e', true)).toBeUndefined()
  expect(note('f', true)).toBe('3 tests in a row failed (d; e; f), so something every flow needs is broken')
})

test('a long streak names its first three tests', () => {
  const note = makeFailureStreak(4)
  for (const t of ['a', 'b', 'c']) note(t, true)
  expect(note('d', true)).toBe('4 tests in a row failed (a; b; c; ...), so something every flow needs is broken')
})

test('0 turns the stop off', () => {
  const note = makeFailureStreak(0)
  for (let i = 0; i < 50; i++) expect(note(`t${i}`, true)).toBeUndefined()
})

test('the limit comes from the environment, else the default', () => {
  expect(maxConsecutiveFailures({})).toBe(DEFAULT_MAX_CONSECUTIVE_FAILURES)
  expect(maxConsecutiveFailures({KB_E2E_MAX_CONSECUTIVE_FAILURES: '0'})).toBe(0)
  expect(maxConsecutiveFailures({KB_E2E_MAX_CONSECUTIVE_FAILURES: '12'})).toBe(12)
  expect(() => maxConsecutiveFailures({KB_E2E_MAX_CONSECUTIVE_FAILURES: 'lots'})).toThrow('not a whole number')
})
