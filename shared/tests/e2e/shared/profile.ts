// Profiles and proofs: the smoke account's profile fields on the host, and the second account's
// proofs, sigs and PGP keys through its peer, with the writes that put them back. A proof or key a
// flow makes is this run's (a stamped DNS domain, a burn address added since the run started, a key
// on this run's stamped identity), and only those are ever revoked or dropped here. The PGP key a
// flow drops from the phone is made on the second peer (the phone cannot make one): its private half
// stays in the peer's keyring, never on the server, and is purged after. No error names an account,
// fingerprint or file. Framework-free: shared by the desktop and iOS flows.
import * as fs from 'fs'
import * as path from 'path'
import {loadE2EAccounts, loadE2EEnv} from '../accounts/env.ts'
import {parseRunId} from '../accounts/run-id.ts'
import {waitFor} from './deadline.ts'
import {mainRpc} from './main-rpc.ts'
import {pgpKeyGenAnswers, type PeerRpc} from './peer-rpc.ts'
import {ensurePeer, requireMainIsSmoke, runKeybase} from './peer-service.ts'
import {e2eRunId} from './run-marker.ts'
import {readBack} from './teams.ts'

// -- the smoke account's profile -----------------------------------------------------------------

export type ProfileFields = {bio: string; fullName: string; location: string}

// The smoke account's profile fields as the server has them.
export const profileFields = async (): Promise<ProfileFields> => {
  const {smokeUser} = loadE2EAccounts()
  await requireMainIsSmoke({smokeUser})
  const out = await readBack(async () =>
    runKeybase(['apicall', '-m', 'GET', 'user/lookup', '-a', `username=${smokeUser}`, '-a', 'fields=profile'], {timeoutMs: 30_000})
  )
  const p = (JSON.parse(out) as {them?: {profile?: {bio?: string | null; full_name?: string | null; location?: string | null} | null}}).them?.profile
  if (!p) throw new Error('user/lookup returned no profile for the smoke account')
  return {bio: p.bio ?? '', fullName: p.full_name ?? '', location: p.location ?? ''}
}

const sameFields = (a: ProfileFields, b: ProfileFields) => a.bio === b.bio && a.fullName === b.fullName && a.location === b.location

// Puts the smoke account's profile fields back to `original` through the host's main service and
// reads them back; a no-op when they already are. Bound: a read, the edit, then 30s of reads.
export const restoreProfileFields = async (original: ProfileFields) => {
  if (sameFields(await profileFields(), original)) return
  await mainRpc('keybase.1.user.profileEdit', {bio: original.bio, fullName: original.fullName, location: original.location})
  await waitFor('the original profile fields put back', async () => (sameFields(await profileFields(), original) ? true : undefined), {
    timeout: 30_000,
  })
}

// -- the second account, through its peer ---------------------------------------------------------

// a burn address: provably unspendable
export const BURN_ADDRESS = '1BitcoinEaterAddressDontSendf59kuE'

const secondPeer = async () => ensurePeer('second', loadE2EEnv())
const secondCli = async (args: Array<string>, timeoutMs = 60_000) => readBack(async () => (await secondPeer()).cli(args, timeoutMs))

const withSecondRpc = async <R,>(f: (rpc: PeerRpc) => Promise<R>, onInvoke?: Parameters<typeof pgpKeyGenAnswers>[0]) => {
  const peer = await secondPeer()
  const rpc = await peer.rpc(onInvoke && pgpKeyGenAnswers(onInvoke))
  try {
    return await f(rpc)
  } finally {
    rpc.close()
  }
}

type Lookup = {them?: {id?: string; cryptocurrency_addresses?: {bitcoin?: Array<{address: string; sig_id: string}> | null} | null} | null}

// The second account as the server has it (user/lookup through the second peer). Parse-anchored: the
// answer names the account's uid.
const secondLookup = async (fields: string) => {
  const {secondUser} = loadE2EAccounts()
  const out = await secondCli(['apicall', '-m', 'GET', 'user/lookup', '-a', `username=${secondUser}`, '-a', `fields=${fields}`])
  const them = (JSON.parse(out) as Lookup).them
  if (!them?.id) throw new Error('user/lookup returned no uid for the second account')
  return {...them, id: them.id}
}

// The second account's bitcoin addresses, as the server lists them.
export const cryptoAddresses = async () =>
  ((await secondLookup('cryptocurrency_addresses')).cryptocurrency_addresses?.bitcoin ?? []).map(a => ({address: a.address, sigID: a.sig_id}))

export type Sig = {ctime: number; revoked: boolean; sigID: string; statement: string; type: string}
type SigJSON = {ctime?: number; revoked?: boolean; sig_id?: string; statement?: string; type?: string}

// The second account's sigchain, revoked links included (`keybase sigs list -j -r`). Parse-anchored:
// the list holds the account's eldest link, else this throws, so a list that failed or changed shape
// never reads as a sig being gone.
export const sigsList = async (): Promise<Array<Sig>> => {
  const parsed = JSON.parse(await secondCli(['sigs', 'list', '-j', '-r'])) as unknown
  if (!Array.isArray(parsed)) throw new Error('keybase sigs list: the answer is not a list')
  const sigs = (parsed as Array<SigJSON>).map(s => ({
    ctime: s.ctime ?? 0,
    revoked: !!s.revoked,
    sigID: s.sig_id ?? '',
    statement: s.statement ?? '',
    type: s.type ?? '',
  }))
  if (!sigs.some(s => s.type === 'eldest')) throw new Error("keybase sigs list: the second account's list holds no eldest link")
  return sigs
}

export type PgpKey = {emails: Array<string>; fingerprint: string; kid: string; revoked: boolean}
type KeyBase = {base?: {kid?: string; revocation?: unknown}}
type Upk = {
  current?: {
    deviceKeys?: Record<string, KeyBase> | null
    pgpKeys?: Record<string, KeyBase & {fingerprint?: string | Uint8Array; identities?: Array<{email?: string}> | null}> | null
    username?: string
  }
}
const hex = (fp: string | Uint8Array | undefined) => (typeof fp === 'string' ? fp : Buffer.from(fp ?? []).toString('hex')).toLowerCase()

// The second account's PGP keys, from its user-plus-keys through the second peer. Parse-anchored: the
// answer is the second account's and holds a live device key, else this throws.
export const pgpList = async (): Promise<Array<PgpKey>> => {
  const {id} = await secondLookup('basics')
  const upk = await withSecondRpc(async rpc => rpc.call<Upk>('keybase.1.user.loadUserPlusKeysV2', {oa: 0, pollForKID: '', sessionID: 0, uid: id}))
  const cur = upk.current
  if (cur?.username !== loadE2EAccounts().secondUser || !Object.values(cur.deviceKeys ?? {}).some(k => !k.base?.revocation)) {
    throw new Error("the second account's keys hold no live device key")
  }
  return Object.values(cur.pgpKeys ?? {}).map(k => ({
    emails: (k.identities ?? []).map(i => i.email ?? ''),
    fingerprint: hex(k.fingerprint),
    kid: k.base?.kid ?? '',
    revoked: !!k.base?.revocation,
  }))
}

// -- PGP keys made on the second peer --------------------------------------------------------------

// This run's PGP identity, and a guard for it: a key on any other identity is never made, dropped or
// purged here.
export const stampedPgpEmail = () => `e2e-${e2eRunId()}-pgp@example.com`
export const requireThisRunPgpEmail = (email: string) => {
  if (email !== stampedPgpEmail()) throw new Error("refusing a PGP identity that is not this run's stamped address")
  return email
}

const fingerprintRe = /^[0-9a-f]{40}$/
const requireFingerprint = (fp: string) => {
  if (!fingerprintRe.test(fp)) throw new Error('refusing a PGP fingerprint that is not 40 hex characters')
  return fp
}

// Makes a PGP key on the second peer with this run's identity (name `e2e-<runid>-<label>`), its private
// half kept only in the peer's keyring, and returns its fingerprint. Checks after that the account has
// no server-synced key (a forced password change would drop one). Bound: the keygen (5 minutes).
export const peerMakePgpKey = async (label: string) => {
  if (!/^[a-z0-9]{1,8}$/.test(label)) throw new Error('refusing a PGP key label that is not 1 to 8 lowercase letters or digits')
  const identity = {comment: '', email: requireThisRunPgpEmail(stampedPgpEmail()), username: `e2e-${e2eRunId()}-${label}`}
  let made = ''
  await withSecondRpc(
    async rpc => {
      await rpc.call('keybase.1.pgp.pgpKeyGenDefault', {createUids: {ids: [identity], useDefault: false}, sessionID: 1}, 300_000)
      const {hasServerKeys} = await rpc.call<{hasServerKeys: boolean}>('keybase.1.account.hasServerKeys', {sessionID: 0})
      if (hasServerKeys) throw new Error('the second account has a server-synced PGP key after the keygen')
    },
    fp => (made = fp.toLowerCase())
  )
  return requireFingerprint(made)
}

// pgpPurge writes each local secret key, encrypted to the account, to `kb-NNNN-<fingerprint>.saltpack`
// in the service's config dir.
const purgeFileName = /^kb-\d{4}-([0-9a-f]{40})\.saltpack$/

// The fingerprint in a file pgpPurge wrote into `dir`; throws for any other path.
export const purgeFileFingerprint = (file: string, dir: string) => {
  const m = purgeFileName.exec(path.basename(file))
  if (path.dirname(path.resolve(file)) !== dir || !m?.[1]) throw new Error('refusing to touch a file that is not a pgpPurge export in the config dir')
  return m[1]
}

// Deletes exactly the files pgpPurge reported, each a plain file in the service's config dir, and,
// given `fingerprint`, only that key's. One that is refused or fails does not stop the others; every
// failure is thrown together after.
export const removePurgeFiles = (files: ReadonlyArray<string>, dir: string, fingerprint?: string) => {
  const errors: Array<Error> = []
  for (const file of files) {
    try {
      const fp = purgeFileFingerprint(file, dir)
      if (fingerprint !== undefined && fp !== fingerprint) throw new Error("refusing to delete another key's pgpPurge export")
      const st = fs.lstatSync(file)
      if (!st.isFile() || st.isSymbolicLink()) throw new Error('refusing to delete a pgpPurge export that is not a plain file')
      fs.unlinkSync(file)
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)))
    }
  }
  const [first] = errors
  if (first && errors.length === 1) throw first
  if (errors.length > 1) throw new AggregateError(errors, errors.map(e => e.message).join('; '))
}

// Removes the local secret half of the key `fingerprint` from the second peer's keyring, deleting only
// that key's exports from the peer's config dir. Purges nothing when the keyring holds any other key.
export const purgePeerPgp = async (fingerprint: string) => {
  const fp = requireFingerprint(fingerprint)
  await withSecondRpc(async rpc => {
    const {configPath} = await rpc.call<{configPath?: string}>('keybase.1.config.getConfig', {sessionID: 0})
    if (!configPath || !path.isAbsolute(configPath)) throw new Error('the second peer reports no absolute config path')
    const dir = path.dirname(path.resolve(configPath))
    const purge = async (doPurge: boolean) =>
      (await rpc.call<{filenames?: Array<string> | null}>('keybase.1.pgp.pgpPurge', {doPurge, sessionID: 0})).filenames ?? []
    // a dry run lists the local keys, writing each to an export
    const listed = await purge(false)
    const fps = listed.map(f => purgeFileFingerprint(f, dir))
    removePurgeFiles(listed.filter((_f, i) => fps[i] === fp), dir, fp)
    if (fps.some(f => f !== fp)) {
      throw new Error("the second peer's keyring holds a PGP key this run did not make; nothing purged (the owner has to look at it)")
    }
    if (!fps.length) return
    removePurgeFiles(await purge(true), dir, fp)
    const left = await purge(false)
    removePurgeFiles(left, dir, fp)
    if (left.length) throw new Error("a local PGP secret key is left in the second peer's keyring after the purge")
  })
}

// This run's sigs on the second account still live: its DNS proof, and the burn address added since
// the run started (the address is the same every run).
const runSigs = (sigs: ReadonlyArray<Sig>) => {
  const run = e2eRunId()
  const startS = (parseRunId(run)?.startMs ?? Date.now()) / 1000
  return sigs.filter(
    s =>
      !s.revoked &&
      ((s.type === 'proof' && s.statement === `dns://e2e${run}.example.com`) ||
        (s.type === 'cryptocurrency' && s.statement === BURN_ADDRESS && s.ctime >= startS))
  )
}
const runKeys = (keys: ReadonlyArray<PgpKey>) => keys.filter(k => !k.revoked && k.emails.includes(stampedPgpEmail()))

// Revokes, through the second peer, each of this run's sigs and keys still on the second account,
// then reads back that none is. Bound: a revoke per leftover (60s each), then 60s of reads.
export const revokeLeftovers = async () => {
  for (const s of runSigs(await sigsList())) await secondCli(['sigs', 'revoke', s.sigID])
  for (const k of runKeys(await pgpList())) await secondCli(['pgp', 'drop', k.kid])
  await waitFor(
    'no sig or PGP key of this run left on the second account',
    async () => (runSigs(await sigsList()).length || runKeys(await pgpList()).length ? undefined : true),
    {timeout: 60_000}
  )
}
