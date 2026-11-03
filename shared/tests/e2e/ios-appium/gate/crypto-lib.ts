// The iOS crypto flows' saltpack messages on the host. A message the host CLI or the second
// account's peer reads goes to it as a file (never argv: a CLI's argv is in its error), and one a CLI
// makes is written to a file (never stdout, which a failed CLI's error can quote), each in this run's
// folder, 0600, and deleted after. withoutArmor takes saltpack text out of an error before it is
// thrown. Framework-free, so jest tests it.
import * as fs from 'fs'
import * as path from 'path'

export const cryptoDir = (runId: string) => `/tmp/kb-e2e/crypto-${runId}`

const requirePlainDir = (dir: string) => {
  const st = fs.lstatSync(dir)
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error(`${dir} is not a plain folder`)
}

// The folder, made 0700 when it is not there.
export const ensureCryptoDir = (dir: string) => {
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  requirePlainDir(dir)
  fs.chmodSync(dir, 0o700)
}

// <dir>/<name>, which must not be there yet.
export const freshPath = (dir: string, name: string) => {
  if (!name || name !== path.basename(name) || name.startsWith('.')) throw new Error(`not a plain file name: ${name}`)
  ensureCryptoDir(dir)
  const p = path.join(dir, name)
  if (fs.existsSync(p)) throw new Error(`${p} is already there`)
  return p
}

// A plain file directly in the folder, or a refusal naming only the path.
const requireOwnFile = (dir: string, p: string) => {
  const st = fs.lstatSync(p)
  if (!st.isFile() || st.isSymbolicLink()) throw new Error(`refusing ${p}: not a plain file`)
  if (fs.realpathSync(path.dirname(p)) !== fs.realpathSync(dir)) throw new Error(`refusing ${p}: not in ${dir}`)
}

// Writes `text` to a new 0600 file at `p` (a freshPath).
export const writeOwnFile = (p: string, text: string) => {
  fs.writeFileSync(p, text, {flag: 'wx', mode: 0o600})
}

// What a CLI wrote to `p` in the folder, made 0600 before it is read.
export const readOwnFile = (dir: string, p: string) => {
  requireOwnFile(dir, p)
  fs.chmodSync(p, 0o600)
  return fs.readFileSync(p, 'utf8')
}

// Deletes one file a test made in the folder. A file the test never got to make is not there, and
// that is fine.
export const removeOwnFile = (dir: string, p: string) => {
  if (!fs.lstatSync(p, {throwIfNoEntry: false})) return
  requireOwnFile(dir, p)
  fs.unlinkSync(p)
}

// Removes the folder; rmdir fails when a test left a file in it.
export const removeCryptoDir = (dir: string) => {
  if (!fs.lstatSync(dir, {throwIfNoEntry: false})) return
  requirePlainDir(dir)
  fs.rmdirSync(dir)
}

export type ArmorKind = 'ENCRYPTED' | 'SIGNED'

// The kind of the one armored saltpack message `text` is, or undefined.
export const armorKind = (text: string): ArmorKind | undefined => {
  const m = /^BEGIN KEYBASE SALTPACK (ENCRYPTED|SIGNED) MESSAGE\.[\s\S]+\. END KEYBASE SALTPACK (ENCRYPTED|SIGNED) MESSAGE\.$/.exec(
    text.trim()
  )
  return m && m[1] === m[2] ? (m[1] as ArmorKind) : undefined
}

// Saltpack text taken out of `message`: whole armored blocks (a block cut off at the end of the
// message too), and runs of the armor's 15-character words.
export const withoutArmor = (message: string) =>
  message
    .replace(/BEGIN KEYBASE SALTPACK [A-Z ]*?MESSAGE\.[\s\S]*?(?:END KEYBASE SALTPACK [A-Z ]*?MESSAGE\.|$)/g, '<saltpack message>')
    .replace(/[0-9A-Za-z]{15}(?:\s+[0-9A-Za-z]{15})+/g, '<saltpack text>')

// One character of the armored body, midway through it, changed to another of its alphabet.
export const tamper = (armored: string) => {
  const start = armored.indexOf('. ') + 2
  const end = armored.lastIndexOf('. END')
  if (start < 2 || end <= start) throw new Error('not an armored saltpack message')
  const at = Math.floor((start + end) / 2)
  const offset = [...armored.slice(at, end)].findIndex(c => /[0-9A-Za-z]/.test(c))
  if (offset < 0) throw new Error('the armored body has no character to change')
  const i = at + offset
  const c = armored.charAt(i)
  return armored.slice(0, i) + (c === 'a' ? 'b' : 'a') + armored.slice(i + 1)
}
