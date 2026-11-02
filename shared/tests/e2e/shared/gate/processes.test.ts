import {consoleLocked, pidAlive, stopGroup} from './processes'

describe('consoleLocked', () => {
  test('reads the root entry', () => {
    expect(consoleLocked('+-o Root  <class IORegistryEntry>\n    {\n      "IOConsoleLocked" = Yes\n    }')).toBe(true)
    expect(consoleLocked('    {\n      "IOConsoleLocked" = No\n    }')).toBe(false)
  })
  test('refuses output without it', () => {
    expect(() => consoleLocked('+-o Root')).toThrow(/IOConsoleLocked/)
  })
})

test('this process lives, and no group 1 is ever signalled', async () => {
  expect(pidAlive(process.pid)).toBe(true)
  await expect(stopGroup(1)).rejects.toThrow('refusing to signal process group 1')
})
