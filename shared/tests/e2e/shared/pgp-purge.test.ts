import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from '../accounts/run-id'
import {flowPurgeRefusal, pgpKeyRunId, purgeLocalPgp} from './pgp-purge'
import type {PeerRpc} from './peer-rpc'

const run = newRunId()
const old = newRunId(Date.now() - 3_600_000)
const [a, b, c] = ['aa', 'bb', 'cc'].map(x => x.repeat(20)) as [string, string, string]

test('pgpKeyRunId reads the run of a key whose one identity is a stamped address', () => {
  expect(pgpKeyRunId([`e2e-${old}-pgp@example.com`])).toBe(old)
  for (const emails of [[], [`e2e-${old}-pgp@example.com`, 'x@example.com'], [`e2e-${old}-pgp@example.org`], ['testuser@keybase.io']]) {
    expect(pgpKeyRunId(emails)).toBeUndefined()
  }
})

test("flowPurgeRefusal takes the flow's keys and earlier runs', and refuses an unstamped key or this run's it did not make", () => {
  const emails = new Map([
    [b, [`e2e-${old}-pgp@example.com`]],
    [c, [`e2e-${run}-pgp@example.com`]],
  ])
  expect(flowPurgeRefusal([a, b], new Set([a]), emails, run)).toBeUndefined()
  expect(flowPurgeRefusal([a, c], new Set([a, c]), emails, run)).toBeUndefined()
  expect(flowPurgeRefusal([a, c], new Set([a]), emails, run)).toMatch(/this run/)
  expect(flowPurgeRefusal([b, a], new Set(), emails, run)).toMatch(/no e2e run made/)
})

describe('purgeLocalPgp', () => {
  let dir = ''
  beforeEach(() => (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgp-purge-'))))
  afterEach(() => fs.rmSync(dir, {force: true, recursive: true}))

  // a keyring holding `keys`; `onPurge` changes it right before a real purge exports
  const keyring = (keys: Array<string>, onPurge?: (keys: Array<string>) => void) => {
    let n = 0
    const calls: Array<boolean> = []
    const rpc = {
      call: async (method: string, arg: {doPurge?: boolean}) => {
        if (method === 'keybase.1.config.getConfig') return Promise.resolve({configPath: path.join(dir, 'config.json')})
        calls.push(!!arg.doPurge)
        if (arg.doPurge) onPurge?.(keys)
        const filenames = keys.map(k => {
          const f = path.join(dir, `kb-${String(n++).padStart(4, '0')}-${k}.saltpack`)
          fs.writeFileSync(f, 'x')
          return f
        })
        if (arg.doPurge) keys.length = 0
        return Promise.resolve({filenames})
      },
    } as unknown as PeerRpc
    return {calls, rpc}
  }

  test('purges once the refusal says nothing, and leaves no export', async () => {
    const {calls, rpc} = keyring([a, b])
    const seen: Array<ReadonlyArray<string>> = []
    await purgeLocalPgp(rpc, async local => {
      seen.push(local)
      return Promise.resolve(undefined)
    })
    expect(seen).toEqual([[a, b]])
    expect(calls).toEqual([false, true, false])
    expect(fs.readdirSync(dir)).toEqual([])
  })

  test('a refusal purges nothing; an empty keyring asks nothing', async () => {
    const {calls, rpc} = keyring([a])
    await expect(purgeLocalPgp(rpc, async () => Promise.resolve('holds x'))).rejects.toThrow('the keyring holds x; nothing purged')
    expect(calls).toEqual([false])
    expect(fs.readdirSync(dir)).toEqual([])
    const empty = keyring([])
    await purgeLocalPgp(empty.rpc, async () => Promise.reject(new Error('asked')))
    expect(empty.calls).toEqual([false])
  })

  test('a key that showed up between the listing and the purge throws', async () => {
    const {rpc} = keyring([a], keys => keys.push(c))
    await expect(purgeLocalPgp(rpc, async () => Promise.resolve(undefined))).rejects.toThrow(/not been cleared/)
    expect(fs.readdirSync(dir)).toEqual([])
  })
})
