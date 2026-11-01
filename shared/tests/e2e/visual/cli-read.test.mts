/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {cliError, readCli} from './cli-read.mts'

const WARNINGS = [
  '2026-01-01T12:00:00.000000-05:00 \u25b6 [WARN keybase versionfix.go:133] 001 Service is running v1.0.1, while client is running v1.0.0.',
  '2026-01-01T12:00:00.000000-05:00 \u25b6 [WARN keybase versionfix.go:136] 003 service: /a/keybase',
].join('\n')
test('a CLI failure names its ERRO line, not the warnings before it', () => {
  const stderr = `${WARNINGS}\n2026-01-01T12:00:05.000000-05:00 \u25b6 [ERRO keybase main.go:86] 006 context deadline exceeded\n`
  assert.equal(cliError(stderr, 'Command failed'), 'context deadline exceeded')
  assert.equal(cliError('no such team\n', 'Command failed'), 'no such team')
  assert.equal(cliError('', 'Command failed'), 'Command failed')
})

// A fake CLI: it fails each call listed in FAILS (by call number) with the given ERRO text, and
// prints the device table otherwise.
const withFakeCli = async (fails: Array<string>, f: (calls: () => number) => Promise<void>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-resolve-cli-'))
  const counter = path.join(dir, 'calls')
  const script = path.join(dir, 'keybase')
  const cases = fails.map((msg, i) => `  ${i + 1}) echo '[ERRO keybase main.go:86] 006 ${msg}' >&2; exit 2;;`).join('\n')
  fs.writeFileSync(
    script,
    `#!/bin/sh\nn=$(($(cat '${counter}' 2>/dev/null || echo 0) + 1))\necho $n > '${counter}'\ncase $n in\n${cases}\nesac\necho 'out'\n`,
    {mode: 0o755}
  )
  const saved = process.env['KB_CLI']
  process.env['KB_CLI'] = script
  try {
    await f(() => Number(fs.readFileSync(counter, 'utf8')))
  } finally {
    if (saved === undefined) delete process.env['KB_CLI']
    else process.env['KB_CLI'] = saved
    fs.rmSync(dir, {force: true, recursive: true})
  }
}
test('a read the service failed with its server timeout is run once more', async () => {
  await withFakeCli(['context deadline exceeded'], async calls => {
    assert.equal((await readCli(['device', 'list'], 'keybase device')).trim(), 'out')
    assert.equal(calls(), 2)
  })
})
test('a second server timeout fails, naming it', async () => {
  await withFakeCli(['context deadline exceeded', 'context deadline exceeded'], async calls => {
    await assert.rejects(readCli(['device', 'list'], 'seal: keybase device list'), /^Error: seal: keybase device list: context deadline exceeded$/)
    assert.equal(calls(), 2)
  })
})
test('any other CLI failure is not retried', async () => {
  await withFakeCli(['no such device'], async calls => {
    await assert.rejects(readCli(['device', 'list'], 'seal: keybase device list'), /seal: keybase device list: no such device/)
    assert.equal(calls(), 1)
  })
})
