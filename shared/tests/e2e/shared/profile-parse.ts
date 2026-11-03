// The parsers of the second account's server reads (user/lookup, its sigchain, its user-plus-keys),
// shared by shared/profile.ts (the flows' read-backs), accounts/sweep.mts and the desktop PGP flow, so
// their safety checks cannot drift apart. Pure and import-free: sweep.mts runs under plain node.
// `who` names the account in an error by its role ("the second account"), never by its name.

export type LookupThem = {
  id: string
  cryptocurrency_addresses?: {bitcoin?: Array<{address: string; sig_id: string}> | null} | null
}

// A user/lookup answer. Parse-anchored: it names the account's uid, else this throws.
export const parseLookup = (out: string, who: string): LookupThem => {
  const them = (JSON.parse(out) as {them?: Partial<LookupThem> | null}).them
  if (!them?.id) throw new Error(`user/lookup returned no uid for ${who}`)
  return {...them, id: them.id}
}

// An image/username_pic_lookups or image/team_avatar_lookups answer for one name and the square_192
// format: its url, '' when the name has no avatar. Parse-anchored: an answer that is not OK or does
// not hold exactly one picture with that format throws, so it never reads as "no avatar".
export const parsePicLookup = (out: string): string => {
  const parsed = JSON.parse(out) as {pictures?: Array<{square_192?: unknown} | null> | null; status?: {code?: number} | null}
  if (parsed.status?.code !== 0) throw new Error('the avatar lookup did not answer OK')
  const pics = parsed.pictures
  const url = Array.isArray(pics) && pics.length === 1 ? pics[0]?.square_192 : undefined
  if (typeof url !== 'string') throw new Error('the avatar lookup holds no square_192 picture for the one name asked')
  return url
}

export type Sig = {ctime: number; revoked: boolean; sigID: string; statement: string; type: string}
type SigJSON = {ctime?: number; revoked?: boolean; sig_id?: string; statement?: string; type?: string}

// `keybase sigs list -j -r` (revoked links included). Parse-anchored: the list holds the account's
// eldest link, else this throws, so a list that failed or changed shape never reads as a sig being gone.
export const parseSigsList = (out: string, who: string): Array<Sig> => {
  const parsed = JSON.parse(out) as unknown
  if (!Array.isArray(parsed)) throw new Error('keybase sigs list: the answer is not a list')
  const sigs = (parsed as Array<SigJSON>).map(s => ({
    ctime: s.ctime ?? 0,
    revoked: !!s.revoked,
    sigID: s.sig_id ?? '',
    statement: s.statement ?? '',
    type: s.type ?? '',
  }))
  if (!sigs.some(s => s.type === 'eldest')) throw new Error(`keybase sigs list: ${who}'s list holds no eldest link`)
  return sigs
}

export type PgpKey = {emails: Array<string>; fingerprint: string; kid: string; revoked: boolean}
type KeyBase = {base?: {kid?: string; revocation?: unknown}}
type PgpKeyJSON = KeyBase & {fingerprint?: string | Uint8Array; identities?: Array<{email?: string}> | null}
type Incarnation = {deviceKeys?: Record<string, KeyBase> | null; pgpKeys?: Record<string, PgpKeyJSON> | null; username?: string}
export type Upk = {current?: Incarnation; pastIncarnations?: Array<Incarnation> | null}

const hex = (fp: string | Uint8Array | undefined) => (typeof fp === 'string' ? fp : Buffer.from(fp ?? []).toString('hex')).toLowerCase()
const pgpKeyOf = (k: PgpKeyJSON): PgpKey => ({
  emails: (k.identities ?? []).map(i => i.email ?? ''),
  fingerprint: hex(k.fingerprint),
  kid: k.base?.kid ?? '',
  revoked: !!k.base?.revocation,
})

// The current incarnation's PGP keys, revoked ones included, from loadUserPlusKeysV2. Parse-anchored:
// the answer is `user`'s and holds a live device key, else this throws.
export const parseUpkPgpKeys = (upk: Upk, user: string, who: string): Array<PgpKey> => {
  const cur = upk.current
  if (cur?.username !== user || !Object.values(cur.deviceKeys ?? {}).some(k => !k.base?.revocation)) {
    throw new Error(`${who}'s keys hold no live device key`)
  }
  return Object.values(cur.pgpKeys ?? {}).map(pgpKeyOf)
}

// Every PGP key the account's sigchain ever held (past incarnations and revoked keys included), by
// fingerprint: what names a key that is now only in a local keyring.
export const pgpEmailsByFingerprint = (upk: Upk): Map<string, Array<string>> => {
  const out = new Map<string, Array<string>>()
  for (const inc of [...(upk.pastIncarnations ?? []), ...(upk.current ? [upk.current] : [])]) {
    for (const k of Object.values(inc.pgpKeys ?? {})) {
      const key = pgpKeyOf(k)
      out.set(key.fingerprint, key.emails)
    }
  }
  return out
}
