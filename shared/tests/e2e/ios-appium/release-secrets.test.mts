/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {createReleaseRun} from '../shared/gate/release-run.mts'
import {desktopFlowOutputs, watchEnvSecrets} from '../shared/gate/secret-scan.ts'
import {scanResults, stopThenScan} from './release-secrets.mts'

const quiet = async (f: () => Promise<void>) => {
  const lines: Array<string> = []
  const orig = console.log
  console.log = (...a: Array<unknown>) => void lines.push(a.map(String).join(' '))
  try {
    await f()
  } finally {
    console.log = orig
  }
  return lines
}

const until = async (f: () => boolean) => {
  const stop = Date.now() + 15_000
  while (!f() && Date.now() < stop) await new Promise(resolve => setTimeout(resolve, 20))
}

const resultsWith = (files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ios-secrets-'))
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), {recursive: true})
    fs.writeFileSync(path.join(dir, name), text)
  }
  return dir
}

// A run whose cleanup scans like release.mts's: the overall deadline aborts it during a phase.
test('a run the deadline aborts mid-phase still scans its results from cleanup, with every value the ledger saw', async () => {
  // the ledger saw the old password before the env file moved on to a new one
  let current = ['old-password-123456']
  const ledger = watchEnvSecrets(() => current, 10_000)
  current = ['new-password-654321']
  const dir = resultsWith({
    'ios-appium-share-iphone/page-source.xml': '<x>old-password-123456</x>',
    'ios-logs/flows.log': 'nothing here',
    'ios-prev/a.txt': 'new-password-654321',
  })
  const exits: Array<number> = []
  const run = createReleaseRun({
    cleanup: async code => {
      const phase = scanResults([dir], () => ledger.secrets(), () => {})
      ledger.stop()
      run.phases.push(phase)
      return Promise.resolve(phase.ok || code !== 0 ? code : 1)
    },
    cwd: os.tmpdir(),
    deadlineMs: 300,
    exit: code => void exits.push(code),
    lockPath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ios-secrets-')), 'release.lock'),
    notify: () => {},
    notifyTitle: 'test release',
    artifacts: () => [],
    tag: '[ios-release]',
  })
  await quiet(async () => {
    const p = run.phase('flows', async () => new Promise(resolve => setTimeout(() => resolve({line: 'late', ok: true}), 5_000)))
    await until(() => exits.length > 0)
    assert.equal(await p, false)
  })
  process.exitCode = undefined
  assert.deepEqual(exits, [1])
  assert.deepEqual(
    run.phases.map(p => [p.name, p.ok]),
    [
      ['flows', false],
      ['secrets', false],
    ]
  )
  assert.match(run.phases[1]?.line ?? '', /^secret found in 2 artifacts \(deleted\)/)
  assert.equal(fs.existsSync(path.join(dir, 'ios-appium-share-iphone/page-source.xml')), false)
  assert.equal(fs.existsSync(path.join(dir, 'ios-prev/a.txt')), false)
  assert.equal(fs.existsSync(path.join(dir, 'ios-logs/flows.log')), true)
})

test('a clean scan passes and names how many files it read', () => {
  const dir = resultsWith({'a/b.txt': 'fine', 'c.txt': 'fine'})
  const logs: Array<string> = []
  const phase = scanResults([dir], () => ['some-secret-value'], s => void logs.push(s))
  assert.deepEqual([phase.name, phase.ok, phase.line], ['secrets', true, 'no secret in 2 artifacts'])
  assert.deepEqual(logs, ['secrets: ok: no secret in 2 artifacts'])
})

test('saltpack armor in a result file or a log fails the scan and is deleted', () => {
  const dir = resultsWith({
    'ios-logs/metro.log': 'BEGIN SALTPACK SIGNED MESSAGE. kiOUtMhcc4NXXRb.',
    'ios-appium/run.json': '{"title": "BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOUtMhcc4NXXRb."}',
    'ios-appium/clean.json': '{"output": "<saltpack message>"}',
  })
  const phase = scanResults([dir], () => ['some-secret-value'], () => {})
  assert.equal(phase.ok, false)
  assert.match(phase.line, /^secret found in 2 artifacts \(deleted\)/)
  assert.equal(fs.existsSync(path.join(dir, 'ios-logs/metro.log')), false)
  assert.equal(fs.existsSync(path.join(dir, 'ios-appium/run.json')), false)
  assert.equal(fs.existsSync(path.join(dir, 'ios-appium/clean.json')), true)
})

test("another gate's files are scanned for secrets but not for armor", () => {
  const dir = resultsWith({
    'test-results/flows-crypto/error-context.md': 'BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOUtMhcc4NXXRb.',
    'report/index.html': 'BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOUtMhcc4NXXRb.',
    'report/data/leak.md': 'typed some-secret-value',
    'ios-logs/metro.log': 'BEGIN SALTPACK SIGNED MESSAGE. kiOUtMhcc4NXXRb.',
  })
  const phase = scanResults([dir], () => ['some-secret-value'], () => {}, desktopFlowOutputs(dir))
  assert.equal(phase.ok, false)
  assert.match(phase.line, /^secret found in 2 artifacts \(deleted\)/)
  assert.equal(fs.existsSync(path.join(dir, 'test-results/flows-crypto/error-context.md')), true)
  assert.equal(fs.existsSync(path.join(dir, 'report/index.html')), true)
  assert.equal(fs.existsSync(path.join(dir, 'report/data/leak.md')), false)
  assert.equal(fs.existsSync(path.join(dir, 'ios-logs/metro.log')), false)
})

test('a scan whose secrets cannot be read fails', () => {
  const phase = scanResults([resultsWith({})], () => {
    throw new Error('no env file')
  }, () => {})
  assert.equal(phase.ok, false)
  assert.match(phase.line, /could not scan .*: no env file/)
})

test('a stop that throws still scans, after it, and counts as not stopped', async () => {
  const order: Array<string> = []
  const logs: Array<string> = []
  const dir = resultsWith({'ios-logs/flows.log': 'leaked-secret-value-1'})
  const r = await stopThenScan(
    async () => {
      order.push('stop')
      return Promise.reject(new Error('lsof hung'))
    },
    () => {
      order.push('scan')
      return scanResults([dir], () => ['leaked-secret-value-1'], () => {})
    },
    s => void logs.push(s)
  )
  assert.deepEqual(order, ['stop', 'scan'])
  assert.equal(r.stopped, false)
  assert.equal(r.secrets?.ok, false)
  assert.equal(fs.existsSync(path.join(dir, 'ios-logs/flows.log')), false)
  assert.deepEqual(logs, ['stopping what it started failed: lsof hung'])
})

test('a stop that went fine scans after it and says so', async () => {
  const order: Array<string> = []
  const r = await stopThenScan(
    async () => {
      order.push('stop')
      return Promise.resolve(true)
    },
    () => {
      order.push('scan')
      return undefined
    },
    () => {}
  )
  assert.deepEqual(order, ['stop', 'scan'])
  assert.deepEqual(r, {secrets: undefined, stopped: true})
})
