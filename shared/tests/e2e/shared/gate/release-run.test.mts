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

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const until = async (f: () => boolean) => {
  const stop = Date.now() + 15_000
  while (!f() && Date.now() < stop) await new Promise(resolve => setTimeout(resolve, 20))
}

test('the overall deadline kills the running child, records the phase, and ends the run once', async () => {
  const exits: Array<number> = []
  const notes: Array<string> = []
  const cleanups: Array<number> = []
  const run = createReleaseRun({
    cleanup: async code => {
      cleanups.push(code)
      return Promise.resolve(code)
    },
    cwd: os.tmpdir(),
    deadlineMs: 800,
    exit: code => void exits.push(code),
    lockPath: tmpLock(),
    notify: text => void notes.push(text),
    notifyTitle: 'test release',
    printResults: () => console.log('artifacts here'),
    tag: '[release]',
  })
  let pid = 0
  const lines = await capture(async () => {
    const p = run.phase('slow', async () => {
      const r = await run.runChild('sleeper', process.execPath, ['-e', 'console.log(process.pid); setTimeout(()=>{},60000)'], 60_000)
      pid = Number(r.stdout.trim())
      return {line: 'finished', ok: true}
    })
    await until(() => exits.length > 0)
    assert.equal(await p, false)
  })
  process.exitCode = undefined
  assert.ok(pid > 0)
  assert.equal(alive(pid), false)
  assert.equal(run.phases.length, 1)
  const stopped = run.phases[0]!
  assert.equal(stopped.name, 'slow')
  assert.equal(stopped.ok, false)
  assert.match(stopped.line, /^stopped: overall deadline/)
  assert.ok(lines.some(l => l.includes('during slow')))
  assert.deepEqual(cleanups, [1])
  assert.deepEqual(exits, [1])
  assert.equal(run.isAborted(), true)
  await run.endRun(0)
  assert.deepEqual(exits, [1])
  assert.deepEqual(cleanups, [1])
})

const cleanupRun = (cleanup: (code: number) => Promise<number>, exits: Array<number>) =>
  createReleaseRun({
    cleanup,
    cwd: os.tmpdir(),
    deadlineMs: 60_000,
    exit: code => void exits.push(code),
    lockPath: tmpLock(),
    notify: () => {},
    notifyTitle: 'test release',
    printResults: () => console.log('artifacts here'),
    tag: '[release]',
  })

test('a cleanup that returns 1 for code 0 exits 1', async () => {
  const exits: Array<number> = []
  const run = cleanupRun(async () => Promise.resolve(1), exits)
  await capture(async () => run.finish(0))
  assert.equal(process.exitCode, 1)
  process.exitCode = undefined
  assert.deepEqual(exits, [1])
})

test('a cleanup that throws exits 1 and prints the finishing failure', async () => {
  const exits: Array<number> = []
  const run = cleanupRun(async () => Promise.reject(new Error('cleanup broke')), exits)
  const errs: Array<string> = []
  const origErr = console.error
  console.error = (...a: Array<unknown>) => void errs.push(a.map(String).join(' '))
  try {
    await capture(async () => run.finish(0))
  } finally {
    console.error = origErr
  }
  process.exitCode = undefined
  assert.deepEqual(exits, [1])
  assert.ok(errs.some(l => l.startsWith('[release] finishing the run failed:') && l.includes('cleanup broke')), errs.join('|'))
})

test('finish removes the signal listeners it registered', async () => {
  const before = ['SIGINT', 'SIGTERM', 'SIGHUP'].map(s => process.listenerCount(s))
  const run = newRun({exits: [], notes: []})
  assert.equal(process.listenerCount('SIGINT'), before[0]! + 1)
  await end(run)
  assert.deepEqual(['SIGINT', 'SIGTERM', 'SIGHUP'].map(s => process.listenerCount(s)), before)
})
