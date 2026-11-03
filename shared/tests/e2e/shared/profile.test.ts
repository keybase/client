import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from '../accounts/run-id'
import {mainRpc} from './main-rpc'
import type {InvokeHandler, PeerRpc} from './peer-rpc'
import {ensurePeer, runKeybase} from './peer-service'
import {
  BURN_ADDRESS,
  peerMakePgpKey,
  pgpList,
  purgeFileFingerprint,
  purgePeerPgp,
  recordProofSig,
  recordedSigCount,
  removePurgeFiles,
  requireThisRunPgpEmail,
  restoreProfileFields,
  revokeLeftovers,
  sigIDsBefore,
  sigsList,
  stampedPgpEmail,
} from './profile'

jest.mock('./peer-service', () => ({ensurePeer: jest.fn(), requireMainIsSmoke: jest.fn(async () => Promise.resolve()), runKeybase: jest.fn()}))
jest.mock('./main-rpc', () => ({mainRpc: jest.fn()}))

const saved = {...process.env}
const run = newRunId()
const other = newRunId(Date.now() - 3_600_000)
let dir = ''
beforeEach(() => {
  Object.assign(process.env, {
    KB_E2E_RUN_ID: run,
    KB_E2E_TEAM: 'testteam',
    KB_OWNER_HOME: '/x/owner',
    KB_OWNER_PAPERKEY: 'echo foxtrot golf hotel',
    KB_SECOND_HOME: '/x/second',
    KB_SECOND_PAPERKEY: 'alpha bravo charlie delta',
    KB_SECOND_USER: 'testuser-mac',
    KB_SMOKE_USER: 'testuser',
  })
  jest.mocked(runKeybase).mockReset()
  jest.mocked(mainRpc).mockReset()
  jest.mocked(ensurePeer).mockReset()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-'))
})
afterEach(() => {
  process.env = {...saved}
  fs.rmSync(dir, {force: true, recursive: true})
})

const fp = 'ab'.repeat(20)
const otherFp = 'cd'.repeat(20)

const messageOf = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === 'function' ? p() : p)
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  return undefined
}

// A second peer whose CLI answers `cli` and whose RPC connections answer `call` (with the handler the
// connection was opened with).
const fakePeer = (opts: {
  call?: (method: string, arg: Record<string, unknown>, onInvoke?: InvokeHandler) => unknown
  cli?: (args: Array<string>) => string
}) => {
  const log: Array<string> = []
  const peer = {
    cli: jest.fn(async (args: Array<string>) => {
      log.push(`cli ${args.join(' ')}`)
      return Promise.resolve(opts.cli?.(args) ?? '')
    }),
    home: dir,
    role: 'second',
    rpc: jest.fn(async (onInvoke?: InvokeHandler): Promise<PeerRpc> =>
      Promise.resolve({
        call: async <T,>(method: string, arg: object) => {
          log.push(`rpc ${method}`)
          return Promise.resolve(opts.call?.(method, arg as Record<string, unknown>, onInvoke) as T)
        },
        close: () => log.push('close'),
      })
    ),
    user: 'testuser-mac',
  }
  jest.mocked(ensurePeer).mockResolvedValue(peer as never)
  return {log, peer}
}

describe('the PGP identity', () => {
  test("is this run's stamped example.com address, and any other is refused naming none", async () => {
    expect(stampedPgpEmail()).toBe(`e2e-${run}-pgp@example.com`)
    expect(requireThisRunPgpEmail(stampedPgpEmail())).toBe(stampedPgpEmail())
    for (const email of [`e2e-${other}-pgp@example.com`, `e2e-${run}-pgp@example.org`, 'testuser@keybase.io', `x${stampedPgpEmail()}`]) {
      const m = await messageOf(() => requireThisRunPgpEmail(email))
      expect(m).toMatch(/^refusing /)
      for (const n of [run, other, 'testuser', 'example']) expect(m).not.toContain(n)
    }
  })
})

describe('peerMakePgpKey', () => {
  test("makes a key with the stamped identity on the second peer and never pushes its private half", async () => {
    const answers: Array<unknown> = []
    let ids: unknown
    const {log} = fakePeer({
      call: (method, arg, onInvoke) => {
        if (method === 'keybase.1.pgp.pgpKeyGenDefault') {
          ids = (arg['createUids'] as {ids: unknown}).ids
          answers.push(onInvoke?.('keybase.1.pgpUi.keyGenerated', {key: {fingerprint: fp.toUpperCase()}}))
          answers.push(onInvoke?.('keybase.1.pgpUi.shouldPushPrivate', {prompt: true}))
          return null
        }
        if (method === 'keybase.1.account.hasServerKeys') return {hasServerKeys: false}
        throw new Error(`unexpected ${method}`)
      },
    })
    await expect(peerMakePgpKey('drop')).resolves.toBe(fp)
    expect(ids).toEqual([{comment: '', email: `e2e-${run}-pgp@example.com`, username: `e2e-${run}-drop`}])
    expect(answers).toEqual([null, false])
    expect(log).toEqual(['rpc keybase.1.pgp.pgpKeyGenDefault', 'rpc keybase.1.account.hasServerKeys', 'close'])
  })

  test('refuses a label that is not plain, before any call', async () => {
    const {log} = fakePeer({})
    expect(await messageOf(peerMakePgpKey('a b'))).toMatch(/^refusing /)
    expect(log).toEqual([])
  })

  test('fails when the account holds a server-synced key after the keygen', async () => {
    fakePeer({
      call: (method, _arg, onInvoke) => {
        if (method === 'keybase.1.pgp.pgpKeyGenDefault') onInvoke?.('keybase.1.pgpUi.keyGenerated', {key: {fingerprint: fp}})
        return method === 'keybase.1.account.hasServerKeys' ? {hasServerKeys: true} : null
      },
    })
    expect(await messageOf(peerMakePgpKey('drop'))).toMatch(/server-synced/)
  })
})

describe('the purge guards', () => {
  test("delete only the named key's pgpPurge exports in the config dir, and refuse every other file", async () => {
    const mine = path.join(dir, `kb-0001-${fp}.saltpack`)
    const theirs = path.join(dir, `kb-0002-${otherFp}.saltpack`)
    const plain = path.join(dir, 'config.json')
    const elsewhere = path.join(os.tmpdir(), `kb-0003-${fp}.saltpack`)
    for (const f of [mine, theirs, plain]) fs.writeFileSync(f, 'x')
    expect(purgeFileFingerprint(mine, dir)).toBe(fp)
    const m = await messageOf(() => removePurgeFiles([mine, theirs, plain, elsewhere], dir, fp))
    expect(m).toMatch(/refusing/)
    expect(m).not.toContain(otherFp)
    expect(fs.existsSync(mine)).toBe(false)
    expect(fs.existsSync(theirs)).toBe(true)
    expect(fs.existsSync(plain)).toBe(true)
  })

  test('without a fingerprint every pgpPurge export in the dir goes (the desktop purge)', () => {
    const files = [fp, otherFp].map((f, i) => path.join(dir, `kb-000${i}-${f}.saltpack`))
    for (const f of files) fs.writeFileSync(f, 'x')
    removePurgeFiles(files, dir)
    expect(files.filter(f => fs.existsSync(f))).toEqual([])
  })
})

describe('purgePeerPgp', () => {
  const runFp = 'ef'.repeat(20)
  const oldFp = '12'.repeat(20)
  // the peer's pgpPurge: each call writes an export per local key; a real purge then drops the keys.
  // Its sigchain names otherFp nothing, runFp this run's identity and oldFp an earlier run's.
  const purgingPeer = (local: Array<string>) => {
    let keys = [...local]
    let n = 0
    const key = (fingerprint: string, email: string) => ({base: {kid: fingerprint}, fingerprint, identities: [{email}]})
    return fakePeer({
      call: (method, arg) => {
        if (method === 'keybase.1.config.getConfig') return {configPath: path.join(dir, 'config.json')}
        if (method === 'keybase.1.user.loadUserPlusKeysV2') {
          return {
            current: {deviceKeys: {d: {base: {kid: 'd'}}}, pgpKeys: {r: key(runFp, stampedPgpEmail()), o: key(oldFp, `e2e-${other}-pgp@example.com`)}, username: 'testuser-mac'},
          }
        }
        if (method !== 'keybase.1.pgp.pgpPurge') throw new Error(`unexpected ${method}`)
        const filenames = keys.map(k => {
          const f = path.join(dir, `kb-${String(++n).padStart(4, '0')}-${k}.saltpack`)
          fs.writeFileSync(f, 'x')
          return f
        })
        if (arg['doPurge']) keys = []
        return {filenames}
      },
      cli: () => JSON.stringify({them: {id: 'uid'}}),
    })
  }

  test("purges the peer's key and leaves no export behind", async () => {
    const {log} = purgingPeer([fp])
    await purgePeerPgp([fp])
    expect(fs.readdirSync(dir)).toEqual([])
    expect(log.filter(l => l.includes('pgpPurge'))).toHaveLength(3)
  })

  test("an earlier run's stamped key goes with the purge", async () => {
    const {log} = purgingPeer([fp, oldFp])
    await purgePeerPgp([fp])
    expect(log.filter(l => l.includes('pgpPurge'))).toHaveLength(3)
    expect(fs.readdirSync(dir)).toEqual([])
  })

  test("purges nothing when the keyring holds a key no run made, or this run's that it did not make, and names none", async () => {
    for (const held of [otherFp, runFp]) {
      const {log} = purgingPeer([fp, held, oldFp])
      const m = await messageOf(purgePeerPgp([fp]))
      expect(m).toMatch(/nothing purged/)
      for (const f of [otherFp, runFp, oldFp, run, 'testuser']) expect(m).not.toContain(f)
      expect(log.filter(l => l.includes('pgpPurge'))).toHaveLength(1)
      // the dry run's exports are gone too, the other keys' included
      expect(fs.readdirSync(dir)).toEqual([])
    }
    // this run's key the flow made goes
    purgingPeer([fp, runFp])
    await purgePeerPgp([fp, runFp])
  })

  test('refuses a fingerprint that is not one, before any call', async () => {
    const {log} = purgingPeer([fp])
    expect(await messageOf(purgePeerPgp(['../x']))).toMatch(/^refusing /)
    expect(log).toEqual([])
  })
})

describe('the second peer reads', () => {
  const sig = (s: Partial<{ctime: number; revoked: boolean; sig_id: string; statement: string; type: string}>) => ({
    ctime: Math.floor(Date.now() / 1000),
    revoked: false,
    sig_id: 'sig',
    statement: '',
    type: 'self',
    ...s,
  })

  test('sigsList holds the eldest link, else it throws (so a failed list never reads as gone)', async () => {
    fakePeer({cli: () => JSON.stringify([sig({sig_id: 'e', type: 'eldest'}), sig({sig_id: 'p', statement: 'dns://x', type: 'proof'})])})
    expect((await sigsList()).map(s => s.sigID)).toEqual(['e', 'p'])
    fakePeer({cli: () => JSON.stringify([sig({sig_id: 'p', type: 'proof'})])})
    expect(await messageOf(sigsList())).toMatch(/eldest/)
    fakePeer({cli: () => 'not json'})
    expect(await messageOf(sigsList())).toBeDefined()
  })

  test('pgpList holds a live device key, else it throws', async () => {
    const upk = (pgpKeys: object, deviceKeys: object) => ({current: {deviceKeys, pgpKeys, username: 'testuser-mac'}})
    const live = {d: {base: {kid: 'd'}}}
    const key = {base: {kid: 'k1'}, fingerprint: Uint8Array.from(Buffer.from(fp, 'hex')), identities: [{email: stampedPgpEmail()}]}
    fakePeer({
      call: m => (m === 'keybase.1.user.loadUserPlusKeysV2' ? upk({k1: key}, live) : null),
      cli: () => JSON.stringify({them: {id: 'uid'}}),
    })
    expect(await pgpList()).toEqual([{emails: [stampedPgpEmail()], fingerprint: fp, kid: 'k1', revoked: false}])
    fakePeer({
      call: m => (m === 'keybase.1.user.loadUserPlusKeysV2' ? upk({}, {d: {base: {kid: 'd', revocation: {}}}}) : null),
      cli: () => JSON.stringify({them: {id: 'uid'}}),
    })
    expect(await messageOf(pgpList())).toMatch(/device key/)
  })

  // a peer whose sigchain is `sigs` and whose keys are `pgp`, taking revokes and drops
  const chainPeer = (sigs: Array<ReturnType<typeof sig>>, pgp: Record<string, object>) => {
    const state = {pgp, sigs}
    const peer = fakePeer({
      call: m => (m === 'keybase.1.user.loadUserPlusKeysV2' ? {current: {deviceKeys: {d: {base: {kid: 'd'}}}, pgpKeys: state.pgp, username: 'testuser-mac'}} : null),
      cli: args => {
        if (args[0] === 'sigs' && args[1] === 'revoke') state.sigs = state.sigs.map(s => (s.sig_id === args[2] ? {...s, revoked: true} : s))
        if (args[0] === 'pgp' && args[1] === 'drop') state.pgp = Object.fromEntries(Object.entries(state.pgp).filter(([k]) => k !== args[2]))
        if (args[0] === 'sigs' && args[1] === 'list') return JSON.stringify(state.sigs)
        return JSON.stringify({them: {id: 'uid'}})
      },
    })
    return {...peer, state}
  }

  test('recordProofSig records the one new proof of its kind, and refuses none or two', async () => {
    const {state} = chainPeer([sig({sig_id: 'eldest', type: 'eldest'}), sig({sig_id: 'oldburn', statement: BURN_ADDRESS, type: 'cryptocurrency'})], {})
    const before = await sigIDsBefore()
    expect(await messageOf(recordProofSig('bitcoin', before))).toMatch(/0 new bitcoin proofs/)
    state.sigs.push(sig({sig_id: 'myburn', statement: BURN_ADDRESS, type: 'cryptocurrency'}))
    await expect(recordProofSig('bitcoin', before)).resolves.toBe('myburn')
    state.sigs.push(sig({sig_id: 'd1', statement: `dns://e2e${run}.example.com`, type: 'proof'}))
    state.sigs.push(sig({sig_id: 'd2', statement: `dns://e2e${run}.example.com`, type: 'proof'}))
    expect(await messageOf(recordProofSig('dns', before))).toMatch(/2 new dns proofs/)
    await revokeLeftovers()
  })

  test('recordProofSig with allowNone records nothing for no new proof, the one new proof of its kind, and refuses two', async () => {
    const {log, state} = chainPeer(
      [
        sig({sig_id: 'eldest', type: 'eldest'}),
        sig({sig_id: 'oldburn', statement: BURN_ADDRESS, type: 'cryptocurrency'}),
        sig({sig_id: 'otherdns', statement: `dns://e2e${other}.example.com`, type: 'proof'}),
      ],
      {}
    )
    const before = await sigIDsBefore()
    // none new: nothing recorded, so nothing is revoked
    await expect(recordProofSig('dns', before, {allowNone: true})).resolves.toBeUndefined()
    expect(recordedSigCount()).toBe(0)
    // a new sig of another kind or a revoked one of this kind is not this add's
    state.sigs.push(sig({sig_id: 'newburn', statement: BURN_ADDRESS, type: 'cryptocurrency'}))
    state.sigs.push(sig({revoked: true, sig_id: 'gonedns', statement: `dns://e2e${run}.example.com`, type: 'proof'}))
    await expect(recordProofSig('dns', before, {allowNone: true})).resolves.toBeUndefined()
    // one new: recorded, and revoked by revokeLeftovers
    state.sigs.push(sig({sig_id: 'mydns', statement: `dns://e2e${run}.example.com`, type: 'proof'}))
    await expect(recordProofSig('dns', before, {allowNone: true})).resolves.toBe('mydns')
    expect(recordedSigCount()).toBe(1)
    await revokeLeftovers()
    expect(log.filter(l => l.includes(' revoke '))).toEqual(['cli sigs revoke mydns'])
    expect(recordedSigCount()).toBe(0)
    // two new: refused, never guessed at
    state.sigs.push(sig({sig_id: 'd1', statement: `dns://e2e${run}.example.com`, type: 'proof'}))
    state.sigs.push(sig({sig_id: 'd2', statement: `dns://e2e${run}.example.com`, type: 'proof'}))
    expect(await messageOf(recordProofSig('dns', before, {allowNone: true}))).toMatch(/2 new dns proofs/)
  })

  test("revokeLeftovers revokes only the recorded proof sigs and this run's keys, and reads back that none is left", async () => {
    const {log, state} = chainPeer(
      [
        sig({sig_id: 'eldest', type: 'eldest'}),
        sig({sig_id: 'otherdns', statement: `dns://e2e${other}.example.com`, type: 'proof'}),
        sig({sig_id: 'oldburn', statement: BURN_ADDRESS, type: 'cryptocurrency'}),
        sig({sig_id: 'gh', statement: 'github://testuser-mac', type: 'proof'}),
      ],
      {
        k1: {base: {kid: 'k1'}, fingerprint: fp, identities: [{email: stampedPgpEmail()}]},
        k2: {base: {kid: 'k2'}, fingerprint: otherFp, identities: [{email: `e2e-${other}-pgp@example.com`}]},
      }
    )
    const before = await sigIDsBefore()
    state.sigs.push(sig({sig_id: 'mydns', statement: `dns://e2e${run}.example.com`, type: 'proof'}))
    await recordProofSig('dns', before)
    state.sigs.push(sig({sig_id: 'myburn', statement: BURN_ADDRESS, type: 'cryptocurrency'}))
    await recordProofSig('bitcoin', new Set([...before, 'mydns']))
    await revokeLeftovers()
    expect(log.filter(l => / revoke | drop /.test(l))).toEqual(['cli sigs revoke mydns', 'cli sigs revoke myburn', 'cli pgp drop k1'])
    // once read back revoked, nothing is recorded any more
    log.length = 0
    await revokeLeftovers()
    expect(log.filter(l => / revoke | drop /.test(l))).toEqual([])
  })
})

describe('restoreProfileFields', () => {
  const lookup = (p: {bio: string; full_name: string; location: string}) => JSON.stringify({them: {profile: p}})

  test('is a no-op when the fields already are the original', async () => {
    jest.mocked(runKeybase).mockResolvedValue(lookup({bio: 'b', full_name: 'n', location: 'l'}))
    await restoreProfileFields({bio: 'b', fullName: 'n', location: 'l'})
    expect(jest.mocked(mainRpc)).not.toHaveBeenCalled()
  })

  test('puts the original back and reads it back', async () => {
    let p = {bio: `e2e-${run}-bio`, full_name: `e2e-${run}-name`, location: `e2e-${run}-loc`}
    jest.mocked(runKeybase).mockImplementation(async () => Promise.resolve(lookup(p)))
    jest.mocked(mainRpc).mockImplementation(async (_m: string, arg: object) => {
      const a = arg as {bio: string; fullName: string; location: string}
      p = {bio: a.bio, full_name: a.fullName, location: a.location}
      return Promise.resolve(undefined as never)
    })
    await restoreProfileFields({bio: 'b', fullName: 'n', location: 'l'})
    expect(jest.mocked(mainRpc).mock.calls).toEqual([['keybase.1.user.profileEdit', {bio: 'b', fullName: 'n', location: 'l'}]])
  })
})
