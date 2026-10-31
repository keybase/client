import {runKeybase} from './peer-service'
import {followingIn, followsSecond, requireFollowTarget, setFollowSecondFromCli} from './people'

jest.mock('./peer-service', () => ({requireMainIsSmoke: jest.fn(async () => Promise.resolve()), runKeybase: jest.fn()}))

const saved = {...process.env}
beforeEach(() => {
  Object.assign(process.env, {KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
  jest.mocked(runKeybase).mockReset()
})
afterEach(() => {
  process.env = {...saved}
})

const listing = (...users: Array<string>) => ['Username', '=========', ...users].join('\n')

describe('followingIn', () => {
  test('reads the usernames under the header', () => {
    expect(followingIn(listing('alice', 'testuser_mac2'))).toEqual(['alice', 'testuser_mac2'])
    expect(followingIn(listing())).toEqual([])
  })

  test('throws on an answer without the header, so a failed or changed list never reads as "not following"', () => {
    for (const out of ['', 'alice\nbob', 'Username\nalice', 'Username\n=========\nnot a name']) {
      expect(() => followingIn(out)).toThrow(/^keybase list-following/)
    }
  })
})

test('requireFollowTarget refuses anyone but the second account, naming nobody', () => {
  expect(requireFollowTarget('testuser-mac')).toBe('testuser-mac')
  for (const user of ['testuser', 'stranger', 'TESTUSER-MAC', '']) {
    let m = ''
    try {
      requireFollowTarget(user)
    } catch (e) {
      m = e instanceof Error ? e.message : String(e)
    }
    expect(m).toMatch(/^refusing /)
    for (const n of ['testuser', 'stranger']) expect(m).not.toContain(n)
  }
})

test('followsSecond reads list-following with its header', async () => {
  jest.mocked(runKeybase).mockResolvedValue(listing('alice', 'testuser-mac'))
  await expect(followsSecond()).resolves.toBe(true)
  expect(jest.mocked(runKeybase).mock.calls[0]?.[0]).toEqual(['list-following', '-H'])
})

test('setFollowSecondFromCli is a no-op when the follow state already is the one wanted', async () => {
  jest.mocked(runKeybase).mockResolvedValue(listing('alice'))
  await setFollowSecondFromCli(false)
  expect(jest.mocked(runKeybase).mock.calls.map(c => c[0][0])).toEqual(['list-following'])
})

test('setFollowSecondFromCli follows the second account and reads it back; a failed write names nobody', async () => {
  let follows = false
  jest.mocked(runKeybase).mockImplementation(async args => {
    if (args[0] === 'follow') follows = true
    return Promise.resolve(listing(...(follows ? ['testuser-mac'] : [])))
  })
  await setFollowSecondFromCli(true)
  expect(jest.mocked(runKeybase).mock.calls.map(c => c[0])).toEqual([['list-following', '-H'], ['follow', 'testuser-mac', '-y'], ['list-following', '-H']])

  jest.mocked(runKeybase).mockReset()
  jest.mocked(runKeybase).mockImplementation(async args =>
    args[0] === 'unfollow' ? Promise.reject(new Error('keybase unfollow testuser-mac: testuser cannot')) : Promise.resolve(listing('testuser-mac'))
  )
  const err = await setFollowSecondFromCli(false).catch((e: unknown) => e as Error)
  expect(String(err)).toContain('<second>')
  expect(String(err)).not.toMatch(/testuser/)
})
