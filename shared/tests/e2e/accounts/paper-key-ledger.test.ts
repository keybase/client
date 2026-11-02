import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from './run-id'
import {
  forgetPaperKey,
  forgetRunPaperKeyNames,
  forgetStalePaperKeyNames,
  paperKeyNamesIn,
  paperKeyWords,
  readPaperKeys,
  recordPaperKey,
  runPaperKeyNames,
  withPaperKeyNames,
} from './paper-key-ledger'

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

const namesFile = () => path.join(path.dirname(file), 'paper-key-names.json')

test("a recorded key's words stay in its run's names after the ledger forgets it, until the run's scan deletes the file", () => {
  const names = namesFile()
  const run = {...entry, deviceName: 'Paper Key (apple banana...)', runId: newRunId()}
  recordPaperKey(run, file, true)
  forgetPaperKey(deviceID, file)
  expect(readPaperKeys(file)).toEqual([])
  expect(runPaperKeyNames(run.runId, names)).toEqual(['apple banana'])
  expect(fs.statSync(names).mode & 0o777).toBe(0o600)
  expect(runPaperKeyNames('other1', names)).toEqual([])
  forgetRunPaperKeyNames('other1', names)
  expect(runPaperKeyNames(run.runId, names)).toEqual(['apple banana'])
  forgetRunPaperKeyNames(run.runId, names)
  expect(fs.existsSync(names)).toBe(false)
  expect(() => forgetRunPaperKeyNames(run.runId, names)).not.toThrow()
})

test('recording a key again adds neither a second ledger entry nor a second name', () => {
  const run = {...entry, runId: newRunId()}
  recordPaperKey(run, file, true)
  recordPaperKey(run, file, true)
  expect(readPaperKeys(file)).toEqual([run])
  expect(runPaperKeyNames(run.runId, namesFile())).toEqual(['apple banana'])
})

test("another run's write replaces the names file, holding only its own run", () => {
  const names = namesFile()
  const first = {...entry, runId: newRunId(Date.now() - 60_000)}
  const second = {...entry, deviceID: deviceID.replace('0', '3'), deviceName: 'cherry date', runId: newRunId()}
  recordPaperKey(first, file, true)
  recordPaperKey(second, file, true)
  expect(runPaperKeyNames(first.runId, names)).toEqual([])
  expect(runPaperKeyNames(second.runId, names)).toEqual(['cherry date'])
  expect(JSON.parse(fs.readFileSync(names, 'utf8'))).toEqual({names: ['cherry date'], runId: second.runId})
})

test('paperKeyWords reads both forms of the name', () => {
  expect(paperKeyWords('Paper Key (apple banana...)')).toBe('apple banana')
  expect(paperKeyWords('apple banana')).toBe('apple banana')
})

test('a run that does not scan for paper key names writes none', () => {
  recordPaperKey({...entry, runId: newRunId()}, file, false)
  expect(fs.existsSync(namesFile())).toBe(false)
})

test("the sweep deletes a names file a run before it left, never the current run's or a later one's", () => {
  const names = namesFile()
  const now = Date.now()
  const write = (runId: string) => fs.writeFileSync(names, JSON.stringify({names: ['apple banana'], runId}), {mode: 0o600})
  recordPaperKey({...entry, runId: newRunId(now - 10 * 60_000)}, file, true)
  const current = newRunId(now)
  forgetStalePaperKeyNames(current, now, names)
  expect(fs.existsSync(names)).toBe(false)
  expect(() => forgetStalePaperKeyNames(current, now, names)).not.toThrow()
  write(current)
  forgetStalePaperKeyNames(current, now, names)
  expect(fs.existsSync(names)).toBe(true)
  // a run that started after the sweep's `before` may still be going
  write(newRunId(now))
  forgetStalePaperKeyNames(newRunId(now - 20 * 60_000), now - 10 * 60_000, names)
  expect(fs.existsSync(names)).toBe(true)
  // one it cannot read goes too
  fs.writeFileSync(names, '[]', {mode: 0o600})
  forgetStalePaperKeyNames(current, now, names)
  expect(fs.existsSync(names)).toBe(false)
})

test('a names file that cannot be written leaves the key ledgered, and recording it again puts the name there', () => {
  const names = namesFile()
  const run = {...entry, runId: newRunId()}
  // a names file that cannot be read: a directory where it should be
  fs.mkdirSync(names, {mode: 0o700, recursive: true})
  expect(() => recordPaperKey(run, file, true)).toThrow(/ledgered, but its name is not in the run's names file/)
  expect(readPaperKeys(file)).toEqual([run])
  fs.rmSync(names, {recursive: true})
  recordPaperKey(run, file, true)
  expect(readPaperKeys(file)).toEqual([run])
  expect(runPaperKeyNames(run.runId, names)).toEqual(['apple banana'])
})

test("paperKeyNamesIn names the env file's paper keys by their first two words, and nothing else", () => {
  const key = 'one two three four five six seven eight nine ten eleven twelve thirteen'
  expect(paperKeyNamesIn([key, 'e2e-not-a-key-1234', 'apple banana'])).toEqual(['one two'])
})

test("withPaperKeyNames adds the env file's key names and the run's own", () => {
  const key = 'one two three four five six seven eight nine ten eleven twelve thirteen'
  const run = {...entry, runId: newRunId()}
  recordPaperKey(run, file, true)
  expect(withPaperKeyNames(['pw', key], run.runId, namesFile())).toEqual(['pw', key, 'one two', 'apple banana'])
  expect(withPaperKeyNames(['pw'], 'other1', namesFile())).toEqual(['pw'])
})

test('the ledger and the names file are replaced whole, leaving no partial file behind', () => {
  const run = {...entry, runId: newRunId()}
  recordPaperKey(run, file, true)
  forgetPaperKey(deviceID, file)
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual([])
  // each write went through a temporary file renamed into place
  expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(['paper-key-names.json', 'paper-keys.json'])
})
