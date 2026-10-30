import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {notTestAccountsProblem, pairWasFavorite, PAIR_FAVORITE_VAR, recordPairFavorite, TEST_ACCOUNT_PREFIX} from './repair-lib'

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

describe('the pair folder record', () => {
  let dir: string
  let file: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pair-folder-'))
    fs.chmodSync(dir, 0o700)
    file = path.join(dir, 'state', 'pair-folder.json')
  })
  afterEach(() => fs.rmSync(dir, {force: true, recursive: true}))

  test('no record and no override: not a favorite', () => {
    expect(pairWasFavorite({}, file)).toBe(false)
  })

  test('a record written is read back, at mode 600 in a mode 700 dir', () => {
    recordPairFavorite(file)
    expect(pairWasFavorite({}, file)).toBe(true)
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700)
    expect(fs.readdirSync(path.dirname(file))).toEqual(['pair-folder.json'])
  })

  test('the env override counts without a record; only 1 does', () => {
    expect(pairWasFavorite({[PAIR_FAVORITE_VAR]: '1'}, file)).toBe(true)
    expect(pairWasFavorite({[PAIR_FAVORITE_VAR]: '0'}, file)).toBe(false)
  })

  test('a record readable by others is refused', () => {
    recordPairFavorite(file)
    fs.chmodSync(file, 0o644)
    expect(() => pairWasFavorite({}, file)).toThrow(/mode 644/)
  })

  test('a record of another shape is refused', () => {
    fs.mkdirSync(path.dirname(file), {mode: 0o700})
    fs.writeFileSync(file, '{"x":1}\n', {mode: 0o600})
    expect(() => pairWasFavorite({}, file)).toThrow(/no pair folder record/)
  })
})
