/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
process.env['KB_VISUAL_LOCK'] = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vlock-')), 'lock')
const {acquireFileLock, acquireLock, assertNotLocked, clearStale, lockDecision} = await import('./lock.mts')

test('acquire then release', () => {
  const release = acquireLock('test')
  assert.throws(() => assertNotLocked('e2e'), /held by pid/)
  release()
  assertNotLocked('e2e')
})

test('a dead pid lock is cleared', () => {
  fs.writeFileSync(process.env['KB_VISUAL_LOCK']!, JSON.stringify({cmd: 'old', pid: 999999, start: 0}))
  const release = acquireLock('test')
  release()
})

test('clearing a stale lock leaves a fresh one another run took in between', () => {
  const lock = process.env['KB_VISUAL_LOCK']!
  const fresh = {cmd: 'winner', pid: process.ppid, start: 1}
  fs.writeFileSync(lock, JSON.stringify(fresh))
  assert.throws(() => clearStale({cmd: 'old', pid: 999999, start: 0}), new RegExp(`held by pid ${process.ppid} \\(winner\\)`))
  assert.deepEqual(JSON.parse(fs.readFileSync(lock, 'utf8')), fresh)
  fs.writeFileSync(lock, JSON.stringify({cmd: 'old', pid: 999999, start: 0}))
  clearStale({cmd: 'old', pid: 999999, start: 0})
  assert.equal(fs.existsSync(lock), false)
  assert.deepEqual(fs.readdirSync(path.dirname(lock)), [])
})

test('a live foreign pid blocks', () => {
  fs.writeFileSync(process.env['KB_VISUAL_LOCK']!, JSON.stringify({cmd: 'other', pid: process.ppid, start: 0}))
  assert.throws(() => acquireLock('test'), /held by pid/)
  fs.rmSync(process.env['KB_VISUAL_LOCK']!)
})

test('assertNotLocked passes for the gate own runs (KB_VISUAL_RUN=1)', () => {
  const release = acquireLock('test')
  process.env['KB_VISUAL_RUN'] = '1'
  try {
    assertNotLocked('e2e')
  } finally {
    delete process.env['KB_VISUAL_RUN']
    release()
  }
})

test('lockDecision: a live holder refuses; no lock, an unreadable one or a dead holder is cleared', () => {
  const alive = (pid: number) => pid === 7
  assert.equal(lockDecision({cmd: 'x', pid: 7, start: 0}, alive), 'refuse')
  assert.equal(lockDecision({cmd: 'x', pid: 8, start: 0}, alive), 'clear')
  assert.equal(lockDecision(undefined, alive), 'clear')
})

test('acquireFileLock: one holder at a time, a dead holder is cleared, release frees it', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rlock-')), 'release.lock')
  const release = acquireFileLock(file, 'release', 'release lock')
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, process.pid)
  // this process holds it: a second take is refused, naming the holder
  assert.throws(() => acquireFileLock(file, 'release', 'release lock'), new RegExp(`release lock held by pid ${process.pid} \\(release\\)`))
  release()
  assert.equal(fs.existsSync(file), false)
  // a live foreign holder refuses and its lock is left alone
  const foreign = {cmd: 'other release', pid: process.ppid, start: 1}
  fs.writeFileSync(file, JSON.stringify(foreign))
  assert.throws(() => acquireFileLock(file, 'release', 'release lock'), /release lock held by pid/)
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), foreign)
  // a dead holder is stale
  fs.writeFileSync(file, JSON.stringify({cmd: 'old', pid: 999999, start: 0}))
  const again = acquireFileLock(file, 'release', 'release lock')
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, process.pid)
  again()
  // releasing never removes a lock another process took meanwhile
  const r3 = acquireFileLock(file, 'release', 'release lock')
  fs.writeFileSync(file, JSON.stringify(foreign))
  r3()
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), foreign)
})
