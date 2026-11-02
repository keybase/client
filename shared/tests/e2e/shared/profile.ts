// Profiles and proofs: the smoke account's profile fields on the host, and the second account's
// proofs, sigs and PGP keys through its peer, with the writes that put them back. A proof or key a
// flow makes is this run's (a proof sig whose id was recorded right after its add, a key on this run's
// stamped identity), and only those are ever revoked or dropped here. The PGP key a
// flow drops from the phone is made on the second peer (the phone cannot make one): its private half
// stays in the peer's keyring, never on the server, and is purged after (with earlier runs' stamped
// keys: pgpPurge takes every local key, shared/pgp-purge.ts). No error names an account,
// fingerprint or file. Framework-free: shared by the desktop and iOS flows.
import {loadE2EAccounts, loadE2EEnv} from '../accounts/env.ts'
import {waitFor} from './deadline.ts'
import {mainRpc} from './main-rpc.ts'
import {pgpKeyGenAnswers, type PeerRpc} from './peer-rpc.ts'
import {flowPurgeRefusal, purgeLocalPgp, requireFingerprint} from './pgp-purge.ts'
import {parseLookup, parsePicLookup, parseSigsList, parseUpkPgpKeys, pgpEmailsByFingerprint, type PgpKey, type Sig, type Upk} from './profile-parse.ts'
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

// The smoke account's avatar url (square_192) as the server has it, '' when it has none: the
// server's own answer, not the host service's avatar cache.
export const smokeAvatarUrl = async () => {
  const {smokeUser} = loadE2EAccounts()
  await requireMainIsSmoke({smokeUser})
  const args = ['apicall', '-m', 'GET', 'image/username_pic_lookups', '-a', `usernames=${smokeUser}`, '-a', 'formats=square_192']
  return parsePicLookup(await readBack(async () => runKeybase(args, {timeoutMs: 30_000})))
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

export * from './profile-parse.ts'

const SECOND = 'the second account'

// The second account as the server has it (user/lookup through the second peer).
const secondLookup = async (fields: string) => {
  const {secondUser} = loadE2EAccounts()
  return parseLookup(await secondCli(['apicall', '-m', 'GET', 'user/lookup', '-a', `username=${secondUser}`, '-a', `fields=${fields}`]), SECOND)
}

// The second account's bitcoin addresses, as the server lists them.
export const cryptoAddresses = async () =>
  ((await secondLookup('cryptocurrency_addresses')).cryptocurrency_addresses?.bitcoin ?? []).map(a => ({address: a.address, sigID: a.sig_id}))

// The second account's sigchain, revoked links included (`keybase sigs list -j -r`).
export const sigsList = async (): Promise<Array<Sig>> => parseSigsList(await secondCli(['sigs', 'list', '-j', '-r']), SECOND)

// The second account's PGP keys, revoked ones included, from its user-plus-keys through the second peer.
export const pgpList = async (): Promise<Array<PgpKey>> => {
  const {id} = await secondLookup('basics')
  const upk = await withSecondRpc(async rpc => rpc.call<Upk>('keybase.1.user.loadUserPlusKeysV2', {oa: 0, pollForKID: '', sessionID: 0, uid: id}))
  return parseUpkPgpKeys(upk, loadE2EAccounts().secondUser, SECOND)
}

// -- PGP keys made on the second peer --------------------------------------------------------------

// This run's PGP identity, and a guard for it: a key on any other identity is never made, dropped or
// purged here.
export const stampedPgpEmail = () => `e2e-${e2eRunId()}-pgp@example.com`
export const requireThisRunPgpEmail = (email: string) => {
  if (email !== stampedPgpEmail()) throw new Error("refusing a PGP identity that is not this run's stamped address")
  return email
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

export {purgeFileFingerprint, removePurgeFiles} from './pgp-purge.ts'

// Removes the local secret halves of the keys `fingerprints` (the flow made them) from the second
// peer's keyring, with the stamped keys of earlier runs it holds (a run killed before its purge).
// Purges nothing when the keyring holds a key no e2e run made, or one of this run's not in
// `fingerprints` (flowPurgeRefusal). Bound: the peer 45, its connect 10, purgeLocalPgp 40, and for a
// key not made, the lookup 60 and the keys 10.
export const purgePeerPgp = async (fingerprints: ReadonlyArray<string>) => {
  const made = new Set(fingerprints.map(requireFingerprint))
  await withSecondRpc(async rpc =>
    purgeLocalPgp(rpc, async local => {
      if (local.every(fp => made.has(fp))) return undefined
      const {id} = await secondLookup('basics')
      const upk = await rpc.call<Upk>('keybase.1.user.loadUserPlusKeysV2', {oa: 0, pollForKID: '', sessionID: 0, uid: id})
      return flowPurgeRefusal(local, made, pgpEmailsByFingerprint(upk), e2eRunId())
    })
  )
}

// The sig ids of the proofs this run added to the second account, each read back from its sigchain
// right after the add (recordProofSig). Only these are ever revoked here: the burn address is the same
// every run, so its statement alone cannot say which run added it.
const recordedSigs = new Set<string>()

export type ProofKind = 'bitcoin' | 'dns'
const proofOf = (kind: ProofKind) =>
  kind === 'bitcoin'
    ? (s: Sig) => s.type === 'cryptocurrency' && s.statement === BURN_ADDRESS
    : (s: Sig) => s.type === 'proof' && s.statement === `dns://e2e${e2eRunId()}.example.com`

// The ids on the second account's sigchain now, for recordProofSig to compare with after an add.
export const sigIDsBefore = async () => new Set((await sigsList()).map(s => s.sigID))

// Records the one live `kind` proof on the second account's sigchain that was not there `before`,
// and returns its id. Throws unless there is exactly one: an add that made none or two is never
// guessed at. With `allowNone` (a cleanup after an add that may not have reached the server) none
// records nothing and returns undefined; two still throw.
export async function recordProofSig(kind: ProofKind, before: ReadonlySet<string>): Promise<string>
export async function recordProofSig(kind: ProofKind, before: ReadonlySet<string>, opts: {allowNone: true}): Promise<string | undefined>
export async function recordProofSig(kind: ProofKind, before: ReadonlySet<string>, opts?: {allowNone: true}) {
  const added = (await sigsList()).filter(s => !s.revoked && !before.has(s.sigID) && proofOf(kind)(s))
  const [sig] = added
  if (!sig && opts?.allowNone) return undefined
  if (!sig || added.length > 1) throw new Error(`the second account's sigchain shows ${added.length} new ${kind} proofs after the add, not one`)
  recordedSigs.add(sig.sigID)
  return sig.sigID
}

// How many proof sigs are recorded and not yet read back revoked: a cleanup sizes its bound by it.
export const recordedSigCount = () => recordedSigs.size

const liveRecorded = (sigs: ReadonlyArray<Sig>) => sigs.filter(s => !s.revoked && recordedSigs.has(s.sigID))
const runKeys = (keys: ReadonlyArray<PgpKey>) => keys.filter(k => !k.revoked && k.emails.includes(stampedPgpEmail()))

// Revokes, through the second peer, each recorded proof sig and each key on this run's identity still
// on the second account, then reads back that none is. Bound: a revoke per leftover (60s each), then 60s of reads.
export const revokeLeftovers = async () => {
  for (const s of liveRecorded(await sigsList())) await secondCli(['sigs', 'revoke', s.sigID])
  for (const k of runKeys(await pgpList())) await secondCli(['pgp', 'drop', k.kid])
  await waitFor(
    'no sig or PGP key of this run left on the second account',
    async () => (liveRecorded(await sigsList()).length || runKeys(await pgpList()).length ? undefined : true),
    {timeout: 60_000}
  )
  recordedSigs.clear()
}
