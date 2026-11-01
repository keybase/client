// Whether a run's artifact holds a secret from the env file (the second account's password, a
// paper key): as plain bytes, inside a zip (a Playwright trace, the HTML report's data), or inside
// a base64 run (the HTML report embeds its zip as a data URL). No zip library: the zip's central
// directory is read here and its entries inflated with zlib.
import * as zlib from 'zlib'

// a base64 run long enough to be an embedded file rather than an id or hash
const base64Run = /[A-Za-z0-9+/]{200,}={0,2}/g
const maxDepth = 3

const u16 = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
const u32 = (b: Uint8Array, at: number) => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0

export const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04

// Each entry's uncompressed bytes. Only stored (0) and deflated (8) entries; others are skipped,
// and a zip with no end of central directory record yields nothing.
export const zipEntries = (zip: Uint8Array): Array<Uint8Array> => {
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (u32(zip, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return []
  const count = u16(zip, eocd + 10)
  let at = u32(zip, eocd + 16)
  const out: Array<Uint8Array> = []
  for (let n = 0; n < count && u32(zip, at) === 0x02014b50; n++) {
    const method = u16(zip, at + 10)
    const size = u32(zip, at + 20)
    const nameLen = u16(zip, at + 28)
    const extraLen = u16(zip, at + 30)
    const commentLen = u16(zip, at + 32)
    const local = u32(zip, at + 42)
    at += 46 + nameLen + extraLen + commentLen
    if (u32(zip, local) !== 0x04034b50) continue
    const dataAt = local + 30 + u16(zip, local + 26) + u16(zip, local + 28)
    const data = zip.subarray(dataAt, dataAt + size)
    try {
      if (method === 0) out.push(data)
      else if (method === 8) out.push(zlib.inflateRawSync(data))
    } catch {
      // a damaged entry holds nothing readable
    }
  }
  return out
}

const contains = (hay: Uint8Array, needle: Buffer) => Buffer.from(hay.buffer, hay.byteOffset, hay.byteLength).includes(needle)

// A secret under 8 characters would match ordinary text, so it is not looked for, except a paper
// key's device name: two of its words (lowercase, joined by a space), as short as 7 characters.
const scannable = (s: string) => s.length >= 8 || /^[a-z]+ [a-z]+$/.test(s)

const latin1 = (data: Uint8Array) => Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('latin1')

// Whether `found` holds for `data`, or for what is inside its zip or its base64 runs.
const holdsWhere = (data: Uint8Array, found: (d: Uint8Array) => boolean, depth: number): boolean => {
  if (found(data)) return true
  if (depth >= maxDepth) return false
  if (isZip(data) && zipEntries(data).some(e => holdsWhere(e, found, depth + 1))) return true
  for (const m of latin1(data).matchAll(base64Run)) {
    if (holdsWhere(Buffer.from(m[0], 'base64'), found, depth + 1)) return true
  }
  return false
}

// A saltpack armor header of any message type ("BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE.", "BEGIN
// SALTPACK DETACHED SIGNATURE."): a saltpack message is kept out of every artifact by construction,
// and this is the backstop for one that got in anyway.
const saltpackArmor = /BEGIN (?:KEYBASE )?SALTPACK [A-Z]+(?: [A-Z]+)*\./

// Whether `data` holds any of `secrets` (empty ones ignored) or, with `armor`, a saltpack message's
// armor, looking into zips and base64 runs in one walk (the decoding is the slow part of a scan).
export const holdsSecretOrArmor = (data: Uint8Array, secrets: ReadonlyArray<string>, armor: boolean): boolean => {
  const needles = secrets.filter(scannable).map(s => Buffer.from(s, 'utf8'))
  if (!needles.length && !armor) return false
  return holdsWhere(data, d => needles.some(n => contains(d, n)) || (armor && saltpackArmor.test(latin1(d))), 0)
}

// Every value `read` has returned, across samples: a password rotated mid-run was typed (and could
// sit in an artifact) under its old value, and one written as KB_SECOND_PASSWORD_NEXT may never be
// promoted. Kept in memory only.
export const secretLedger = (read: () => ReadonlyArray<string>) => {
  const seen = new Set<string>()
  return {
    all: () => [...seen],
    sample: () => {
      for (const s of read()) if (s) seen.add(s)
    },
  }
}

// The run's verdict line: the paths are named, a secret never is.
export const secretScanLine = (hits: ReadonlyArray<string>, scanned: number) =>
  hits.length
    ? `secret found in ${hits.length} artifacts (deleted): ${hits.join(', ')}`
    : `no secret in ${scanned} artifacts`
