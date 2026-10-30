import {notTestAccountsProblem, pairWasFavorite, PAIR_FAVORITE_VAR, TEST_ACCOUNT_PREFIX} from './repair-lib'

describe('notTestAccountsProblem', () => {
  test('two test accounts may be repaired', () => {
    expect(notTestAccountsProblem(`${TEST_ACCOUNT_PREFIX}a`, `${TEST_ACCOUNT_PREFIX}b`)).toBeUndefined()
  })

  test('either one not a test account refuses, naming neither', () => {
    for (const [a, b] of [
      ['testuser', `${TEST_ACCOUNT_PREFIX}b`],
      [`${TEST_ACCOUNT_PREFIX}a`, 'testuser-mac'],
      ['', ''],
    ] as const) {
      const p = notTestAccountsProblem(a, b)
      expect(p).toMatch(/^refusing to repair/)
      if (a) expect(p).not.toContain(a)
      if (b) expect(p).not.toContain(b)
    }
  })
})

describe('pairWasFavorite', () => {
  test('only the recorded 1 counts', () => {
    expect(pairWasFavorite({[PAIR_FAVORITE_VAR]: '1'})).toBe(true)
    expect(pairWasFavorite({[PAIR_FAVORITE_VAR]: '0'})).toBe(false)
    expect(pairWasFavorite({})).toBe(false)
  })
})
