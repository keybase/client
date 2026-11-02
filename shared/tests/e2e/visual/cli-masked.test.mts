/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {maskedError, readCliMasked} from './cli-masked.mts'

const accounts = {secondUser: 'testuser-mac', smokeUser: 'testuser', team: 'testteam'}

test('an error names the test accounts and team by role', () => {
  const e = maskedError(new Error('seal: keybase team: no such member testuser-mac in testteam.sub (asked by testuser)'), accounts)
  assert.equal(e.message, 'seal: keybase team: no such member <second> in <team>.sub (asked by <smoke>)')
})

test('a failing read names its subcommand and hides the accounts the CLI quoted', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-cli-masked-'))
  const script = path.join(dir, 'keybase')
  fs.writeFileSync(script, "#!/bin/sh\necho '[ERRO keybase main.go:86] 006 no team testteam for testuser' >&2\nexit 2\n", {mode: 0o755})
  const saved = {...process.env}
  Object.assign(process.env, {KB_CLI: script, KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
  try {
    await assert.rejects(readCliMasked(['team', 'list', 'testteam'], 'seal: keybase team'), /^Error: seal: keybase team: no team <team> for <smoke>$/)
  } finally {
    for (const k of ['KB_CLI', 'KB_E2E_TEAM', 'KB_SECOND_USER', 'KB_SMOKE_USER']) {
      if (saved[k] === undefined) Reflect.deleteProperty(process.env, k)
      else process.env[k] = saved[k]
    }
    fs.rmSync(dir, {force: true, recursive: true})
  }
})
