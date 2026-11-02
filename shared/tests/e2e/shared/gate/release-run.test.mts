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
    artifacts: () => [['report', '/nonexistent/report.html']],
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
  assert.equal(lines.filter(x => x === 'report           /nonexistent/report.html (not written by this run)').length, 1)
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

test('runChild with a logFile appends stdout and stderr to it and still returns stdout', async () => {
  const run = newRun({exits: [], notes: []})
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-')), 'child.log')
  fs.writeFileSync(logFile, 'earlier\n')
  const r = await run.runChild('both', process.execPath, ['-e', 'console.log("out"); console.error("err")'], 10_000, {logFile})
  assert.deepEqual(r, {code: 0, stdout: 'out\n', timedOut: false})
  const text = fs.readFileSync(logFile, 'utf8')
  assert.match(text, /^earlier\n/)
  assert.match(text, /out\n/)
  assert.match(text, /err\n/)
  await end(run)
})

test('runChild with an unwritable logFile reports logError and still returns the child result', async () => {
  const run = newRun({exits: [], notes: []})
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-'))
  const blocker = path.join(dir, 'file')
  fs.writeFileSync(blocker, '')
  const lines = await capture(async () => {
    const r = await run.runChild('bad', process.execPath, ['-e', 'console.log("out"); process.exit(4)'], 10_000, {logFile: path.join(blocker, 'x', 'child.log')})
    assert.equal(r.code, 4)
    assert.equal(r.stdout, 'out\n')
    assert.equal(r.timedOut, false)
    assert.match(r.logError ?? '', /ENOTDIR|EEXIST/)
  })
  assert.equal(lines.filter(l => l.includes('bad: log write failed')).length, 1)
  await end(run)
})

test('runChild creates the logFile directory', async () => {
  const run = newRun({exits: [], notes: []})
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-')), 'a', 'b', 'child.log')
  const r = await run.runChild('mk', process.execPath, ['-e', 'console.log("hi")'], 10_000, {logFile})
  assert.equal(r.logError, undefined)
  assert.equal(fs.readFileSync(logFile, 'utf8'), 'hi\n')
  await end(run)
})

test('runChild takes its env and cwd from opts', async () => {
  const run = newRun({exits: [], notes: []})
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-')))
  const r = await run.runChild('opts', process.execPath, ['-e', 'console.log(process.env.KB_X + process.cwd())'], 10_000, {cwd: dir, env: {...process.env, KB_X: 'v'}})
  assert.equal(r.stdout, `v${dir}\n`)
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
    artifacts: () => [['report', '/nonexistent/report.html']],
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
    artifacts: () => [['report', '/nonexistent/report.html']],
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

test('runChild after an abort spawns nothing and resolves at once as timed out', async () => {
  const exits: Array<number> = []
  const run = createReleaseRun({
    cwd: os.tmpdir(),
    deadlineMs: 50,
    exit: code => void exits.push(code),
    lockPath: tmpLock(),
    notify: () => {},
    notifyTitle: 'test release',
    artifacts: () => [],
    tag: '[release]',
  })
  await capture(async () => until(() => exits.length > 0))
  process.exitCode = undefined
  const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-')), 'spawned')
  const r = await run.runChild('late', process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, '')`], 10_000)
  assert.deepEqual(r, {code: null, stdout: '', timedOut: true})
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(fs.existsSync(marker), false)
})

test('finish releases the lock, so a later run on the same path takes it', async () => {
  const lockPath = tmpLock()
  const a = newRun({exits: [], lockPath, notes: []})
  a.acquireLock('first holder')
  await end(a)
  assert.equal(a.holdsLock(), false)
  const b = newRun({exits: [], lockPath, notes: []})
  b.acquireLock('second holder')
  assert.equal(b.holdsLock(), true)
  await end(b)
})

test('runChild resolves after a timeout even while a grandchild keeps its stdout open', async () => {
  const run = newRun({exits: [], notes: []})
  // the grandchild inherits the child's stdout and outlives it
  const script = `const c = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], {stdio: ['ignore', 'inherit', 'inherit']}); console.log(c.pid); setTimeout(()=>{},60000)`
  let grandchild = 0
  try {
    const lines = await capture(async () => {
      const started = Date.now()
      const r = await Promise.race([
        run.runChild('holder', process.execPath, ['-e', script], 300),
        new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 8_000)),
      ])
      assert.notEqual(r, 'pending', 'runChild still pending 8s after its timeout')
      if (r === 'pending') return
      grandchild = Number(r.stdout.trim())
      assert.equal(r.timedOut, true)
      assert.equal(r.code, null)
      assert.ok(Date.now() - started < 8_000)
    })
    assert.ok(lines.some(l => l.includes('holder: not done in')))
  } finally {
    if (grandchild > 0 && alive(grandchild)) process.kill(grandchild, 'SIGKILL')
  }
  await end(run)
})

test('runChild settles on the exit of a child whose grandchild keeps writing, and keeps passing that output through', async () => {
  const run = newRun({exits: [], notes: []})
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-'))
  const logFile = path.join(dir, 'child.log')
  const finished = path.join(dir, 'grandchild-finished')
  // the grandchild writes for 4s after its parent exits, then marks that every write went through
  const grandchild = `let n = 0; const t = setInterval(() => { console.log('tick ' + n++); if (n === 40) { clearInterval(t); require('fs').writeFileSync(${JSON.stringify(finished)}, ''); console.log('grandchild done') } }, 100)`
  const script = `require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], {stdio: ['ignore', 'inherit', 'inherit']}).unref(); console.log('child out')`
  const written: Array<string> = []
  const origWrite = process.stdout.write.bind(process.stdout)
  process.stdout.write = (d: string | Uint8Array) => {
    written.push(String(d))
    return true
  }
  try {
    const started = Date.now()
    const r = await run.runChild('writer', process.execPath, ['-e', script], 30_000, {logFile})
    assert.equal(r.code, 0)
    assert.ok(Date.now() - started < 3_500, 'settled on the exit, not on the grandchild letting go')
    assert.match(r.stdout, /^child out\n/)
    await until(() => fs.existsSync(finished) && written.join('').includes('grandchild done'))
  } finally {
    process.stdout.write = origWrite
  }
  assert.equal(fs.existsSync(finished), true, 'the grandchild died before its last write')
  assert.match(fs.readFileSync(logFile, 'utf8'), /tick 39\ngrandchild done\n/)
  assert.match(written.join(''), /tick 39\ngrandchild done\n/)
  await end(run)
})

test('runChild that cannot spawn reports the spawn error and its log failure', async () => {
  const run = newRun({exits: [], notes: []})
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-release-run-'))
  const blocker = path.join(dir, 'file')
  fs.writeFileSync(blocker, '')
  await capture(async () => {
    const r = await run.runChild('missing', path.join(dir, 'no-such-command'), [], 10_000, {logFile: path.join(blocker, 'x', 'child.log')})
    assert.equal(r.code, null)
    assert.match(r.stdout, /ENOENT/)
    assert.match(r.logError ?? '', /ENOTDIR|EEXIST/)
  })
  await end(run)
})
