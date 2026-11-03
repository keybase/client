import * as zlib from 'zlib'
import {holdsSecretOrArmor, isZip, secretLedger, secretScanLine, zipEntries} from './secret-scan-lib'

const secret = 'e2e-abcdefghijklmnopqrstuvwx'
const paperKey = 'abandon ability able about above absent absorb abstract absurd abuse access accident acid'

// A one-entry zip, stored or deflated, as a Playwright trace or the HTML report's data is.
const zipOf = (name: string, body: Buffer, deflate: boolean) => {
  const data = deflate ? zlib.deflateRawSync(body) : body
  const n = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(deflate ? 8 : 0, 8)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(body.length, 22)
  local.writeUInt16LE(n.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(deflate ? 8 : 0, 10)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(body.length, 24)
  central.writeUInt16LE(n.length, 28)
  central.writeUInt32LE(0, 42)
  const cdAt = local.length + n.length + data.length
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length + n.length, 12)
  eocd.writeUInt32LE(cdAt, 16)
  return Buffer.concat([local, n, data, central, n, eocd])
}

test('finds a secret as plain text, in an aria snapshot line', () => {
  expect(holdsSecretOrArmor(Buffer.from(`- textbox "Password": ${secret}\n`), [secret], false)).toBe(true)
  expect(holdsSecretOrArmor(Buffer.from('- textbox "Password"\n'), [secret], false)).toBe(false)
})

test('finds saltpack armor of any message type, plain, in a zip and in a base64 run', () => {
  for (const header of [
    'BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE.',
    'BEGIN KEYBASE SALTPACK SIGNED MESSAGE.',
    'BEGIN KEYBASE SALTPACK DETACHED SIGNATURE.',
    'BEGIN SALTPACK ENCRYPTED MESSAGE.',
    'BEGIN SALTPACK SIGNCRYPTED MESSAGE.',
  ]) {
    const armor = `${header} kiOUtMhcc4NXXRb XMxIeCbf5rCmoht.`
    expect(holdsSecretOrArmor(Buffer.from(`log: ${armor}`), [], true)).toBe(true)
    expect(holdsSecretOrArmor(zipOf('trace.trace', Buffer.from(armor), true), [], true)).toBe(true)
    expect(holdsSecretOrArmor(Buffer.from(`base64,${Buffer.from(`${'x'.repeat(400)} ${armor}`).toString('base64')}`), [], true)).toBe(true)
  }
  for (const clean of ['the crypto output: <saltpack message>', 'BEGIN KEYBASE', 'saltpack encrypt', 'BEGIN KEYBASE SALTPACK']) {
    expect(holdsSecretOrArmor(Buffer.from(clean), [], true)).toBe(false)
  }
})

test('finds a paper key, and ignores empty or short secrets', () => {
  expect(holdsSecretOrArmor(Buffer.from(`key: ${paperKey}`), ['', paperKey], false)).toBe(true)
  expect(holdsSecretOrArmor(Buffer.from('abc'), ['', 'abc'], false)).toBe(false)
})

test("finds a paper key's device name under 8 characters, and no other short secret", () => {
  expect(holdsSecretOrArmor(Buffer.from('Paper Key (abc def...)'), ['abc def'], false)).toBe(true)
  expect(holdsSecretOrArmor(Buffer.from('id abc-def'), ['abc-def'], false)).toBe(false)
  expect(holdsSecretOrArmor(Buffer.from('Abc def'), ['Abc def'], false)).toBe(false)
})

test('finds a secret inside a stored or deflated zip entry (a trace)', () => {
  for (const deflate of [false, true]) {
    const zip = zipOf('trace.trace', Buffer.from(`{"value":"${secret}"}`), deflate)
    expect(isZip(zip)).toBe(true)
    expect(zipEntries(zip).map(e => Buffer.from(e).toString())).toEqual([`{"value":"${secret}"}`])
    expect(holdsSecretOrArmor(zip, [secret], false)).toBe(true)
    expect(holdsSecretOrArmor(zipOf('trace.trace', Buffer.from('{"value":""}'), deflate), [secret], false)).toBe(false)
  }
})

test('finds a secret in a zip embedded as a base64 data URL (the HTML report)', () => {
  const padding = 'x'.repeat(400)
  const zip = zipOf('data/abc.md', Buffer.from(`${padding} textbox "Password": ${secret}`), true)
  const html = Buffer.from(`<script>window.playwrightReportBase64 = "data:application/zip;base64,${zip.toString('base64')}";</script>`)
  expect(holdsSecretOrArmor(html, [secret], false)).toBe(true)
  const clean = zipOf('data/abc.md', Buffer.from(`${padding} textbox "Password"`), true)
  expect(holdsSecretOrArmor(Buffer.from(`base64,${clean.toString('base64')}`), [secret], false)).toBe(false)
})

test('the verdict names paths, never a secret', () => {
  expect(secretScanLine([], 12)).toBe('no secret in 12 artifacts')
  expect(secretScanLine(['/r/a.md', '/r/b.zip'], 12)).toBe('secret found in 2 artifacts (deleted): /r/a.md, /r/b.zip')
})

test('the ledger keeps every value it was handed, not only the latest', () => {
  let now = ['first-secret-value']
  const ledger = secretLedger(() => now)
  ledger.sample()
  now = ['second-secret-value', '']
  ledger.sample()
  expect(ledger.all()).toEqual(['first-secret-value', 'second-secret-value'])
})

test('one walk finds a secret or, with armor on, a saltpack armor; armor off leaves armor alone', () => {
  const secret = 'e2e-secret-value-1234'
  const armor = 'BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOUtMhcc4NXXRb.'
  const inZip = zipOf('trace.trace', Buffer.from(`${secret} and ${armor}`), true)
  expect(holdsSecretOrArmor(inZip, [secret], true)).toBe(true)
  expect(holdsSecretOrArmor(zipOf('trace.trace', Buffer.from(armor), true), [secret], true)).toBe(true)
  expect(holdsSecretOrArmor(zipOf('trace.trace', Buffer.from(armor), true), [secret], false)).toBe(false)
  expect(holdsSecretOrArmor(Buffer.from(armor), [], false)).toBe(false)
  expect(holdsSecretOrArmor(Buffer.from('clean'), [secret], true)).toBe(false)
})
