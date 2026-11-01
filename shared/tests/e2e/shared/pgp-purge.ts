// Removing local PGP secret keys from a service's keyring with pgpPurge, shared by shared/profile.ts
// (the flows' purge of the key they made) and accounts/sweep.mts (an earlier run's key). pgpPurge
// removes every local key at once, so a purge goes only when every key the keyring holds may go.
// Node-safe: sweep.mts runs under plain node. No error names an account, fingerprint or file.
import * as fs from 'fs'
import * as path from 'path'
import {parseStampedName} from '../accounts/run-id.ts'
import type {PeerRpc} from './peer-rpc.ts'

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

const fingerprintRe = /^[0-9a-f]{40}$/
export const requireFingerprint = (fp: string) => {
  if (!fingerprintRe.test(fp)) throw new Error('refusing a PGP fingerprint that is not 40 hex characters')
  return fp
}

// The run whose stamped PGP identity (e2e-<runid>-pgp@example.com) is a key's one identity, or
// undefined for a key with any other identities (or none).
const pgpEmailRe = /^(e2e-[0-9a-z]{5}[0-9]-pgp)@example\.com$/
export const pgpKeyRunId = (emails: ReadonlyArray<string>) => {
  const [only] = emails
  const part = emails.length === 1 && only !== undefined ? pgpEmailRe.exec(only)?.[1] : undefined
  return part === undefined ? undefined : parseStampedName(part, 'dashed')?.runId
}

// Why a flow's purge of the keys `made` refuses the keyring's local keys `local`: a key no e2e run
// made (no one stamped identity on the account's sigchain) or one of this run's that the flow did not
// make. An earlier run's key goes with the purge. Undefined when the purge may go.
export const flowPurgeRefusal = (
  local: ReadonlyArray<string>,
  made: ReadonlySet<string>,
  emailsOf: ReadonlyMap<string, ReadonlyArray<string>>,
  currentRunId: string
) => {
  for (const fp of local) {
    if (made.has(fp)) continue
    const runId = pgpKeyRunId(emailsOf.get(fp) ?? [])
    if (runId === undefined) return 'holds a PGP key no e2e run made'
    if (runId === currentRunId) return 'holds a PGP key of this run that the flow did not make'
  }
  return undefined
}

type PurgeRes = {filenames?: Array<string> | null}

// The service's config dir, where pgpPurge writes its exports.
const configDir = async (rpc: PeerRpc) => {
  const {configPath} = await rpc.call<{configPath?: string}>('keybase.1.config.getConfig', {sessionID: 0})
  if (!configPath || !path.isAbsolute(configPath)) throw new Error('the service reports no absolute config path')
  return path.dirname(path.resolve(configPath))
}

const purgeCall = async (rpc: PeerRpc, dir: string, doPurge: boolean) => {
  const files = (await rpc.call<PurgeRes>('keybase.1.pgp.pgpPurge', {doPurge, sessionID: 0})).filenames ?? []
  removePurgeFiles(files, dir)
  return files.map(f => purgeFileFingerprint(f, dir))
}

// The fingerprints of the local PGP secret keys in the service's keyring (a dry-run pgpPurge, its
// exports deleted). Bound: the config 10, a purge 10.
export const localPgpFingerprints = async (rpc: PeerRpc) => purgeCall(rpc, await configDir(rpc), false)

// Removes every local PGP secret key from the service's keyring, and every export pgpPurge wrote,
// once `refusal` (given the keys listed right before) says nothing. A refusal purges nothing and is
// thrown. A key the real purge exported that the listing did not show, or one left after it, throws.
// Bound: the config 10, three purges 30, and `refusal`.
export const purgeLocalPgp = async (rpc: PeerRpc, refusal: (local: ReadonlyArray<string>) => Promise<string | undefined>) => {
  const dir = await configDir(rpc)
  const listed = await purgeCall(rpc, dir, false)
  if (!listed.length) return
  const why = await refusal(listed)
  if (why) throw new Error(`the keyring ${why}; nothing purged (the owner has to look at it)`)
  const purged = await purgeCall(rpc, dir, true)
  if (purged.some(fp => !listed.includes(fp))) throw new Error('the keyring held a PGP key the purge had not been cleared for')
  if ((await purgeCall(rpc, dir, false)).length) throw new Error('a local PGP secret key is left in the keyring after the purge')
}
