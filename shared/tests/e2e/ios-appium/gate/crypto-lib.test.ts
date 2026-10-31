import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  armorKind,
  cryptoDir,
  ensureCryptoDir,
  freshPath,
  readOwnFile,
  removeCryptoDir,
  removeOwnFile,
  tamper,
  withoutArmor,
  writeOwnFile,
} from './crypto-lib'

const words = (n: number) => Array.from({length: n}, (_, i) => `${'abcdefghijklmn'}${i % 10}`).join(' ')
const armored = (kind: string) => `BEGIN KEYBASE SALTPACK ${kind} MESSAGE. ${words(12)}. END KEYBASE SALTPACK ${kind} MESSAGE.`

let root: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-lib-'))
})
afterEach(() => {
  fs.rmSync(root, {force: true, recursive: true})
})

test('the folder is per run', () => {
  expect(cryptoDir('abc123')).toBe('/tmp/kb-e2e/crypto-abc123')
})

test('a file is written 0600 in a 0700 folder, read back and removed, and the folder then goes', () => {
  const dir = path.join(root, 'crypto-x')
  const p = freshPath(dir, 'in.saltpack')
  expect(fs.statSync(dir).mode & 0o777).toBe(0o700)
  writeOwnFile(p, 'text')
  expect(fs.statSync(p).mode & 0o777).toBe(0o600)
  expect(readOwnFile(dir, p)).toBe('text')
  expect(() => removeCryptoDir(dir)).toThrow()
  removeOwnFile(dir, p)
  expect(fs.existsSync(p)).toBe(false)
  // a second remove, and a remove of a file never made, are fine
  removeOwnFile(dir, p)
  removeCryptoDir(dir)
  expect(fs.existsSync(dir)).toBe(false)
  removeCryptoDir(dir)
})

test('a file a CLI wrote readable by others is made 0600 before it is read', () => {
  const dir = path.join(root, 'crypto-x')
  const p = freshPath(dir, 'out.saltpack')
  fs.writeFileSync(p, 'made', {mode: 0o644})
  expect(readOwnFile(dir, p)).toBe('made')
  expect(fs.statSync(p).mode & 0o777).toBe(0o600)
})

test('refuses a name that is not plain, a file already there, and a file outside the folder', () => {
  const dir = path.join(root, 'crypto-x')
  for (const name of ['', '.hidden', '../up', 'a/b']) expect(() => freshPath(dir, name)).toThrow('not a plain file name')
  const p = freshPath(dir, 'once')
  writeOwnFile(p, 'x')
  expect(() => freshPath(dir, 'once')).toThrow('already there')
  expect(() => writeOwnFile(p, 'y')).toThrow()
  const outside = path.join(root, 'outside')
  fs.writeFileSync(outside, 'x')
  expect(() => removeOwnFile(dir, outside)).toThrow('not in')
  expect(fs.existsSync(outside)).toBe(true)
})

test('refuses a folder or file that is a link', () => {
  const real = path.join(root, 'real')
  fs.mkdirSync(real)
  const link = path.join(root, 'crypto-link')
  fs.symlinkSync(real, link)
  expect(() => ensureCryptoDir(link)).toThrow('not a plain folder')
  const dir = path.join(root, 'crypto-x')
  ensureCryptoDir(dir)
  const target = path.join(root, 'target')
  fs.writeFileSync(target, 'x')
  const p = path.join(dir, 'l')
  fs.symlinkSync(target, p)
  expect(() => readOwnFile(dir, p)).toThrow('not a plain file')
  expect(() => removeOwnFile(dir, p)).toThrow('not a plain file')
})

test('armorKind reads one whole armored message of either kind', () => {
  expect(armorKind(armored('ENCRYPTED'))).toBe('ENCRYPTED')
  expect(armorKind(`\n${armored('SIGNED')}\n`)).toBe('SIGNED')
  expect(armorKind(armored('ENCRYPTED').replace('END KEYBASE SALTPACK ENCRYPTED', 'END KEYBASE SALTPACK SIGNED'))).toBeUndefined()
  expect(armorKind(armored('ENCRYPTED').slice(0, -10))).toBeUndefined()
  expect(armorKind('e2e-run-crypto-self-0011')).toBeUndefined()
})

test('withoutArmor takes armored blocks and runs of armor words out of a message', () => {
  const msg = `keybase decrypt failed: ${armored('ENCRYPTED')} (exit 1)`
  expect(withoutArmor(msg)).toBe('keybase decrypt failed: <saltpack message> (exit 1)')
  expect(withoutArmor(`cut: BEGIN KEYBASE SALTPACK SIGNED MESSAGE. ${words(3)}`)).toBe('cut: <saltpack message>')
  expect(withoutArmor(`body: ${words(4)}.`)).toBe('body: <saltpack text>.')
  const plain = 'peer second at /tmp/kb-e2e/homes/second is not running'
  expect(withoutArmor(plain)).toBe(plain)
})

test('tamper changes one body character and nothing else', () => {
  const a = armored('ENCRYPTED')
  const t = tamper(a)
  expect(t).not.toBe(a)
  expect(t).toHaveLength(a.length)
  const diff = [...a].filter((c, i) => c !== t[i])
  expect(diff).toHaveLength(1)
  expect(armorKind(t)).toBe('ENCRYPTED')
  expect(() => tamper('no armor here')).toThrow('not an armored saltpack message')
})
