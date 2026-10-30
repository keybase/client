// Pieces of setup's repair of a block flow's leftovers (setup.mts), kept apart for unit tests.
import * as fs from 'fs'
import * as path from 'path'
import {e2eConfigDir} from './env.ts'
import {checkMode} from './paper-key-ledger.ts'

// The prefix every e2e test account's username has. The repair writes to the accounts (blocks, a
// conversation's status, favorites), so it acts only on accounts that have it.
export const TEST_ACCOUNT_PREFIX = 'cnojima106'

// Why the repair must not write, or undefined when both accounts are test accounts. Never names an
// account.
export const notTestAccountsProblem = (smokeUser: string, secondUser: string) =>
  smokeUser.startsWith(TEST_ACCOUNT_PREFIX) && secondUser.startsWith(TEST_ACCOUNT_PREFIX)
    ? undefined
    : `refusing to repair: KB_SMOKE_USER and KB_SECOND_USER must both be e2e test accounts (names starting ${TEST_ACCOUNT_PREFIX})`

// Whether the smoke+second folder was a favorite, recorded by setup once it has seen it so, in the
// gate's own state dir: ~/.config/keybase-e2e/pair-folder.json, mode 600 in the mode 700 dir. The
// repair makes an ignored folder a favorite again only when it was one. The env var is a manual
// override (1), never written.
export const PAIR_FAVORITE_VAR = 'KB_PAIR_FOLDER_FAVORITE'
export const pairFolderRecordPath = () => path.join(e2eConfigDir(), 'pair-folder.json')

type PairFolderRecord = {wasFavorite: boolean}

const readRecord = (file: string): PairFolderRecord | undefined => {
  if (!fs.existsSync(file)) return undefined
  checkMode(file, 0o600)
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  const r = (parsed ?? {}) as Partial<Record<keyof PairFolderRecord, unknown>>
  if (typeof r.wasFavorite !== 'boolean') throw new Error(`${file} holds no pair folder record`)
  return {wasFavorite: r.wasFavorite}
}

export const pairWasFavorite = (vars: Record<string, string | undefined>, file = pairFolderRecordPath()) =>
  vars[PAIR_FAVORITE_VAR] === '1' || readRecord(file)?.wasFavorite === true

// Records that the folder is a favorite, written whole to a temporary file and renamed over the
// record, so a reader never sees half of it.
export const recordPairFavorite = (file = pairFolderRecordPath()) => {
  if (readRecord(file)?.wasFavorite) return
  const dir = path.dirname(file)
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  checkMode(dir, 0o700)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify({wasFavorite: true} satisfies PairFolderRecord)}\n`, {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}
