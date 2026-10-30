import {execFile, spawnSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from './run-id'
import {forgetPaperKey, forgetRunPaperKeyNames, withPaperKeyLock, paperKeyNamesIn, paperKeyWords, readPaperKeys, recordPaperKey, rememberRunPaperKeyName, runPaperKeyNames} from './paper-key-ledger'

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

test("a recorded key's words stay in its run's names after the ledger forgets it, until the run's names are forgotten", () => {
  const names = path.join(path.dirname(file), 'paper-key-names.json')
  // a run id of now: older than a week, the names file drops it
  const run = {...entry, deviceName: 'Paper Key (apple banana...)', runId: newRunId()}
  recordPaperKey(run, file, true)
  forgetPaperKey(deviceID, file)
  expect(readPaperKeys(file)).toEqual([])
  expect(runPaperKeyNames(run.runId, names)).toEqual(['apple banana'])
  expect(fs.statSync(names).mode & 0o777).toBe(0o600)
  expect(runPaperKeyNames('other1', names)).toEqual([])
  forgetRunPaperKeyNames(run.runId, names)
  expect(runPaperKeyNames(run.runId, names)).toEqual([])
})

test('paperKeyWords reads both forms of the name', () => {
  expect(paperKeyWords('Paper Key (apple banana...)')).toBe('apple banana')
  expect(paperKeyWords('apple banana')).toBe('apple banana')
})

test('a run that does not scan for paper key names writes none', () => {
  recordPaperKey({...entry, runId: newRunId()}, file, false)
  expect(fs.existsSync(path.join(path.dirname(file), 'paper-key-names.json'))).toBe(false)
})

test("a run's names are left out on read once they are a week old", () => {
  const names = path.join(path.dirname(file), 'paper-key-names.json')
  const run = newRunId()
  fs.mkdirSync(path.dirname(names), {mode: 0o700, recursive: true})
  fs.writeFileSync(names, JSON.stringify([{names: ['apple banana'], runId: run}]), {mode: 0o600})
  expect(runPaperKeyNames(run, names)).toEqual(['apple banana'])
  expect(runPaperKeyNames(run, names, Date.now() + 8 * 24 * 60 * 60_000)).toEqual([])
})

test('a names file that cannot be written leaves the key ledgered, and the name can be put there later', () => {
  const names = path.join(path.dirname(file), 'paper-key-names.json')
  const run = {...entry, runId: newRunId()}
  // a names file that cannot be read: a directory where it should be
  fs.mkdirSync(names, {mode: 0o700, recursive: true})
  expect(() => recordPaperKey(run, file, true)).toThrow(/ledgered, but its name is not in the run's names file/)
  expect(readPaperKeys(file)).toEqual([run])
  fs.rmSync(names, {recursive: true})
  rememberRunPaperKeyName(run, file, true)
  expect(runPaperKeyNames(run.runId, names)).toEqual(['apple banana'])
  expect(fs.existsSync(path.join(path.dirname(file), 'paper-keys.lock'))).toBe(false)
})

test("paperKeyNamesIn names the env file's paper keys by their first two words, and nothing else", () => {
  const key = 'one two three four five six seven eight nine ten eleven twelve thirteen'
  expect(paperKeyNamesIn([key, 'e2e-not-a-key-1234', 'apple banana'])).toEqual(['one two'])
})

describe('the paper key lock', () => {
  const lockIn = (d: string) => path.join(d, 'paper-keys.lock')

  test("a dead holder's lock is taken away", () => {
    const d = path.dirname(file)
    fs.mkdirSync(d, {mode: 0o700, recursive: true})
    // a process that has exited
    const dead = spawnSync(process.execPath, ['-e', '']).pid
    fs.writeFileSync(lockIn(d), String(dead))
    expect(withPaperKeyLock(d, () => fs.readFileSync(lockIn(d), 'utf8'))).toBe(String(process.pid))
    expect(fs.existsSync(lockIn(d))).toBe(false)
  })

  test("a live holder's lock is waited for and never removed", () => {
    const d = path.dirname(file)
    fs.mkdirSync(d, {mode: 0o700, recursive: true})
    // a process that runs: this test's parent
    fs.writeFileSync(lockIn(d), String(process.ppid))
    expect(() => withPaperKeyLock(d, () => 'ran', 200)).toThrow(`is held by pid ${process.ppid}`)
    expect(fs.readFileSync(lockIn(d), 'utf8')).toBe(String(process.ppid))
  })

  test('two processes adding names at once lose none of them', async () => {
    const names = path.join(path.dirname(file), 'paper-key-names.json')
    const lib = path.join(__dirname, 'paper-key-ledger.ts')
    const runIds = [newRunId(), newRunId()]
    const adder = async (runId: string) =>
      new Promise<void>((resolve, reject) => {
        const script = `import {recordRunPaperKeyName} from ${JSON.stringify(lib)}
for (let i = 0; i < 15; i++) recordRunPaperKeyName(${JSON.stringify(runId)}, 'word' + i + ' ' + ${JSON.stringify(runId)}, ${JSON.stringify(names)})`
        execFile(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script], e => (e ? reject(new Error(e.message)) : resolve()))
      })
    // two different run ids could still collide (the same minute and random characters): the test
    // needs two entries
    if (runIds[0] === runIds[1]) runIds[1] = `${runIds[1]?.slice(0, 4)}zz9`
    await Promise.all(runIds.map(adder))
    for (const runId of runIds) expect(runPaperKeyNames(runId, names)).toHaveLength(15)
    expect(fs.existsSync(lockIn(path.dirname(names)))).toBe(false)
  }, 60_000)
})
