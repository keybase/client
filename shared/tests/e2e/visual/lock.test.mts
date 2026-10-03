/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
process.env['KB_VISUAL_LOCK'] = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vlock-')), 'lock')
const {acquireLock, assertNotLocked} = await import('./lock.mts')

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
