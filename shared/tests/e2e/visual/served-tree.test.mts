/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {assertServedFrom, listenerCwd} from './served-tree.mts'

test('detects the cwd of the process listening on a port', {timeout: 20_000}, async () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'served-')))
  const port = 47000 + Math.floor(Math.random() * 1000)
  const child = spawn(process.execPath, ['-e', `require('http').createServer(()=>{}).listen(${port})`], {cwd: dir})
  try {
    const deadline = Date.now() + 5000
    let cwd: string | undefined
    while (!cwd && Date.now() < deadline) {
      cwd = listenerCwd(port)
      if (!cwd) await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(cwd, dir)
    assertServedFrom(port, dir, 'test')
    assertServedFrom(port, path.dirname(dir), 'test')
    assert.throws(() => assertServedFrom(port, '/nonexistent/tree', 'test'), /served from/)
  } finally {
    child.kill('SIGKILL')
  }
})

test('nothing listening yields undefined', () => {
  assert.equal(listenerCwd(47999), undefined)
})
