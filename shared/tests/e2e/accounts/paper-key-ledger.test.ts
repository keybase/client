import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {forgetPaperKey, readPaperKeys, recordPaperKey} from './paper-key-ledger'

let dir = ''
let file = ''
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-key-ledger-')))
  file = path.join(dir, 'keybase-e2e', 'paper-keys.json')
})
afterEach(() => {
  fs.rmSync(dir, {force: true, recursive: true})
})

const deviceID = '0123456789abcdef0123456789abcd18'
const entry = {deviceID, deviceName: 'apple banana', runId: '98qca1'}

test('recordPaperKey writes mode 600 and never a 10-word run', () => {
  recordPaperKey(entry, file)
  expect(fs.statSync(file).mode & 0o777).toBe(0o600)
  expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700)
  expect(readPaperKeys(file)).toEqual([entry])
  const key = 'one two three four five six seven eight nine ten'
  expect(() => recordPaperKey({...entry, deviceID: deviceID.replace('0', '1'), deviceName: key}, file)).toThrow(/paper key/)
  expect(() => recordPaperKey({...entry, deviceName: `x ${key} y`}, file)).toThrow(/paper key/)
  expect(fs.readFileSync(file, 'utf8')).not.toContain('three')
})

test('entries are appended, and forgotten by device id', () => {
  const other = {...entry, deviceID: deviceID.replace('0', '2'), deviceName: 'cherry date'}
  recordPaperKey(entry, file)
  recordPaperKey(other, file)
  expect(readPaperKeys(file)).toEqual([entry, other])
  forgetPaperKey(deviceID, file)
  expect(readPaperKeys(file)).toEqual([other])
  expect(fs.statSync(file).mode & 0o777).toBe(0o600)
})

test('no ledger reads as empty', () => {
  expect(readPaperKeys(file)).toEqual([])
  expect(() => forgetPaperKey(deviceID, file)).not.toThrow()
})

test('refuses entries that are not a run id and a device id', () => {
  expect(() => recordPaperKey({...entry, runId: 'nope00'}, file)).toThrow(/run id/)
  expect(() => recordPaperKey({...entry, deviceID: 'xyz'}, file)).toThrow(/device id/)
  expect(() => recordPaperKey({...entry, deviceName: ''}, file)).toThrow(/device name/)
})

test('refuses a ledger that others can read', () => {
  recordPaperKey(entry, file)
  fs.chmodSync(file, 0o644)
  expect(() => readPaperKeys(file)).toThrow(/mode 644/)
})
