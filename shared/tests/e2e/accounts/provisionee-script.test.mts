/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
// startProvisionee's expect script against a stand-in CLI that prompts as `keybase login
// --devicename` does (go/client/provision_ui.go ChooseDevice, DisplayAndPromptSecret): which device
// it picks, the phrase it hands back, and what it leaves behind. Needs /usr/bin/expect (macOS has it),
// so it runs here and not in jest.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {startProvisionee} from './provisionee.ts'

const PHRASE = 'alpha bravo charlie delta echo foxtrot golf hotel'

// A CLI that lists `devices`, writes the number it was given to choice.txt in the home it was given,
// and, as the CLI does for a phone approver, writes a QR of the phrase into TMPDIR.
const fakeCli = (dir: string, devices: Array<string>) => {
  const listing = devices.map((d, i) => `\\t${i + 1}. ${d}\\n`).join('')
  const cli = path.join(dir, 'fake-keybase')
  fs.writeFileSync(
    cli,
    `#!/bin/sh
home="$3"
printf 'Please enter a paper key: '
read k
printf '\\nWhich one of your existing devices would you like to use\\nto provision this new device?\\n\\n${listing}\\n'
printf 'Choose a device: '
read c
echo "$c" > "$home/choice.txt"
echo "$TMPDIR" > "$home/tmpdir.txt"
echo qr > "$TMPDIR/keybase_qr.png"
printf '\\n\\nType this verification code into your other device:\\n\\n\\t${PHRASE}\\n\\nOr, scan this QR Code\\n'
exit 0
`,
    {mode: 0o700}
  )
  return cli
}

const run = async (devices: Array<string>, fromDevice: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-provisionee-'))
  const home = path.join(dir, 'home')
  fs.mkdirSync(home)
  const prevCli = process.env['KB_CLI']
  process.env['KB_CLI'] = fakeCli(dir, devices)
  try {
    const p = startProvisionee({deviceName: 'e2e-test-prov', fromDevice, home, user: 'testuser'})
    const [phrase, done] = await Promise.allSettled([p.phrase, p.done])
    const read = (f: string) => (fs.existsSync(path.join(home, f)) ? fs.readFileSync(path.join(home, f), 'utf8').trim() : undefined)
    return {choice: read('choice.txt'), done, home, phrase, tmpdir: read('tmpdir.txt')}
  } finally {
    if (prevCli === undefined) delete process.env['KB_CLI']
    else process.env['KB_CLI'] = prevCli
  }
}

const listed = ['[computer]\ttestuser-mac', '[mobile]\ttestuser-iphone', '[paper key]\ttestuser-ipad']

test('picks a phone approver by its exact name', async () => {
  const r = await run(listed, 'testuser-iphone')
  assert.equal(r.choice, '2')
  assert.deepEqual(r.phrase, {status: 'fulfilled', value: PHRASE})
  assert.equal(r.done.status, 'fulfilled')
})

test('picks a computer approver by its exact name', async () => {
  const r = await run(listed, 'testuser-mac')
  assert.equal(r.choice, '1')
  assert.equal(r.done.status, 'fulfilled')
})

test('refuses a name that is only a paper key, or only part of a device name', async () => {
  for (const from of ['testuser-ipad', 'testuser']) {
    const r = await run(listed, from)
    assert.equal(r.choice, undefined)
    if (r.done.status !== 'rejected') assert.fail(`${from}: keybase login was not refused`)
    assert.equal((r.done.reason as Error).message, 'keybase login exited 3 (no-such-device)')
  }
})

test("finds the approver at the top of a list longer than expect's default buffer", async () => {
  const many = ['[mobile]\ttestuser-iphone', ...Array.from({length: 300}, (_, i) => `[computer]\te2e-${String(i).padStart(4, '0')}-some-long-device-name`)]
  const r = await run(many, 'testuser-iphone')
  assert.equal(r.choice, '1')
  assert.equal(r.done.status, 'fulfilled')
})

test("the CLI's temp files go in a directory of its home, removed when it exits", async () => {
  const r = await run(listed, 'testuser-iphone')
  assert.equal(r.tmpdir, path.join(r.home, 'tmp'))
  assert.equal(fs.existsSync(path.join(r.home, 'tmp')), false)
})
