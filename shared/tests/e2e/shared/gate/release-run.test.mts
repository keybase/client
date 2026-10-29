/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {releaseFailed, summaryLines} from './release-lib.ts'
import {createReleaseRun} from './release-run.mts'

const tmpLock = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-')), 'release.lock')

const capture = async (f: () => Promise<void>) => {
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

// ends a run the test is done with: its deadline timer would keep the process alive
const end = async (run: ReturnType<typeof newRun>) => {
  await capture(async () => run.finish(0))
  process.exitCode = undefined
}

const newRun = (over: {exits: Array<number>; notes: Array<string>; lockPath?: string}) =>
  createReleaseRun({
    cwd: os.tmpdir(),
    deadlineMs: 60_000,
    exit: code => void over.exits.push(code),
    lockPath: over.lockPath ?? tmpLock(),
    notify: text => void over.notes.push(text),
    notifyTitle: 'test release',
    printResults: () => console.log('artifacts here'),
    tag: '[release]',
  })

test('two phases are timed, the run fails, and finish prints the summary once', async () => {
  const exits: Array<number> = []
  const notes: Array<string> = []
  const run = newRun({exits, notes})
  const lines = await capture(async () => {
    assert.equal(await run.phase('first', async () => Promise.resolve({line: 'fine', ok: true})), true)
    assert.equal(await run.phase('second', async () => Promise.reject(new Error('broke'))), false)
    await run.finish(releaseFailed(run.phases) ? 1 : 0)
  })
  process.exitCode = undefined
  assert.deepEqual(run.phases.map(p => [p.name, p.ok, p.line]), [['first', true, 'fine'], ['second', false, 'broke']])
  for (const p of run.phases) assert.equal(typeof p.ms, 'number')
  assert.equal(releaseFailed(run.phases), true)
  for (const l of summaryLines(run.phases)) assert.equal(lines.filter(x => x === l).length, 1, l)
  assert.ok(lines.includes('[release] --- first ---'))
  assert.ok(lines.includes('[release] second: FAILED: broke'))
  assert.ok(lines.includes('\n=== release summary ==='))
  assert.equal(lines.filter(x => x === 'artifacts here').length, 1)
  assert.match(notes[0] ?? '', /^FAILED in \d+s: second$/)
  assert.deepEqual(exits, [1])
  // a second finish is a no-op
  await run.finish(0)
  assert.deepEqual(exits, [1])
})

test('a second acquireLock on the same path throws naming the first holder', async () => {
  const lockPath = tmpLock()
  const a = newRun({exits: [], lockPath, notes: []})
  const b = newRun({exits: [], lockPath, notes: []})
  a.acquireLock('first holder')
  assert.equal(a.holdsLock(), true)
  assert.throws(() => b.acquireLock('second holder'), /release lock held by pid \d+ \(first holder\)/)
  assert.equal(b.holdsLock(), false)
  await end(a)
  await end(b)
})

test('runChild passes stdout back with the exit code', async () => {
  const run = newRun({exits: [], notes: []})
  const r = await run.runChild('echo', process.execPath, ['-e', 'console.log("hi"); process.exit(3)'], 10_000)
  assert.deepEqual(r, {code: 3, stdout: 'hi\n', timedOut: false})
  await end(run)
})
