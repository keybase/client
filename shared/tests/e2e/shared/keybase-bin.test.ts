import {expectSpawnList} from './keybase-bin'

test('each argument is braced, and a brace or backslash in one is refused', () => {
  expect(expectSpawnList(['keybase', 'team', 'delete', 'e2e-x'], 'x')).toBe('{keybase} {team} {delete} {e2e-x}')
  expect(() => expectSpawnList(['keybase', 'team} {x'], 'keybase team')).toThrow('refusing to run keybase team: braces or backslashes in its arguments')
  expect(() => expectSpawnList(['a\\b'], 'x')).toThrow(/braces or backslashes/)
})
