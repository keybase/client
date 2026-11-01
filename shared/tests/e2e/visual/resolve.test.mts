/* eslint-disable @typescript-eslint/no-floating-promises */
import {test, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {resolveParams, clearResolveCache, cliError, runCli, type CliRunner} from './resolve.mts'

process.env['KB_E2E_TEAM'] = 'testteam'
let calls: Array<string> = []
const run: CliRunner = async args => {
  await Promise.resolve()
  calls.push(args[0] ?? '')
  if (args[0] === 'device') {
    return [
      'Name    Type      ID      Created      Last Used',
      '====    ====      ====    ====         ====',
      'phone   mobile    bbb2    2024 Jan 1   2024 Jan 2',
      'laptop  desktop   aaa1    2023 Jan 1   2023 Jan 2',
    ].join('\n')
  }
  if (args[0] === 'team') return JSON.stringify({teams: [{team_id: 'tid1', fq_name: 'testteam'}]})
  return JSON.stringify({
    result: {
      conversations: [
        {id: 'c-general', channel: {name: 'testteam', topic_name: 'general'}},
        {id: 'c-other', channel: {name: 'testteam', topic_name: 'other'}},
        {id: 'c-dm', channel: {name: 'testuser,testuser-mac'}},
      ],
    },
  })
}
beforeEach(() => {
  calls = []
  clearResolveCache()
})

test('refs are replaced and plain values kept', async () => {
  const nav = {
    tab: 'tabs.teamsTab',
    append: {
      name: 'teamMember',
      params: {
        teamID: {ref: 'teamID' as const},
        name: {ref: 'teamname' as const},
        id: {ref: 'conversationIDKey' as const, channel: 'other'},
        n: 3,
      },
    },
  }
  const out = await resolveParams(nav, run)
  assert.deepEqual(out.append?.params, {teamID: 'tid1', name: 'testteam', id: 'c-other', n: 3})
})
test('results are cached for the process', async () => {
  const nav = {tab: 't', append: {name: 'x', params: {a: {ref: 'teamID' as const}}}}
  await resolveParams(nav, run)
  await resolveParams(nav, run)
  assert.deepEqual(calls, ['team'])
})
test('a missing channel fails loudly', async () => {
  const nav = {tab: 't', append: {name: 'x', params: {a: {ref: 'conversationIDKey' as const, channel: 'nope'}}}}
  await assert.rejects(resolveParams(nav, run), /no conversation testteam#nope/)
})
test('a nav without params passes through', async () => {
  const nav = {tab: 'tabs.chatTab'}
  assert.deepEqual(await resolveParams(nav, run), nav)
})
test('the team folder and the smoke user resolve from the environment', async () => {
  process.env['KB_SMOKE_USER'] = 'testuser'
  const nav = {
    tab: 't',
    append: {
      name: 'x',
      params: {mine: {ref: 'privateFolder' as const}, path: {ref: 'teamFolder' as const}, u: {ref: 'username' as const}},
    },
  }
  assert.deepEqual((await resolveParams(nav, run)).append?.params, {
    mine: '/keybase/private/testuser',
    path: '/keybase/team/testteam',
    u: 'testuser',
  })
})
test('a folder ref with sub names a path inside the folder', async () => {
  process.env['KB_SMOKE_USER'] = 'testuser'
  const nav = {tab: 't', append: {name: 'x', params: {path: {ref: 'privateFolder' as const, sub: 'dir/a.png'}}}}
  assert.deepEqual((await resolveParams(nav, run)).append?.params, {path: '/keybase/private/testuser/dir/a.png'})
})
test('the second user resolves from the environment without the CLI', async () => {
  process.env['KB_SECOND_USER'] = 'testuser-mac'
  const nav = {tab: 't', append: {name: 'x', params: {u: {ref: 'secondUser' as const}}}}
  assert.deepEqual((await resolveParams(nav, run)).append?.params, {u: 'testuser-mac'})
  assert.deepEqual(calls, [])
})
test("the second user's private folder resolves from the environment", async () => {
  process.env['KB_SECOND_USER'] = 'testuser-mac'
  const nav = {tab: 't', append: {name: 'x', params: {path: {ref: 'otherPrivateFolder' as const}}}}
  assert.deepEqual((await resolveParams(nav, run)).append?.params, {path: '/keybase/private/testuser-mac'})
})
test('a missing second user fails loudly', async () => {
  const saved = process.env['KB_SECOND_USER']
  delete process.env['KB_SECOND_USER']
  try {
    const nav = {tab: 't', append: {name: 'x', params: {u: {ref: 'secondUser' as const}}}}
    await assert.rejects(resolveParams(nav, run), /needs KB_SECOND_USER/)
  } finally {
    process.env['KB_SECOND_USER'] = saved
  }
})
test('a thread ref resolves to its conversation', async () => {
  const nav = {tab: 'tabs.chatTab', thread: {ref: 'conversationIDKey' as const, channel: 'other'}}
  assert.deepEqual(await resolveParams(nav, run), {tab: 'tabs.chatTab', thread: 'c-other'})
})
test('refs nested in literal objects and arrays are replaced', async () => {
  const nav = {
    tab: 't',
    append: {
      name: 'x',
      params: {wizard: {members: [{ref: 'teamname' as const}, 'a'], none: null, teamID: {ref: 'teamID' as const}}},
    },
  }
  assert.deepEqual((await resolveParams(nav, run)).append?.params, {
    wizard: {members: ['testteam', 'a'], none: null, teamID: 'tid1'},
  })
})
test('a device ref resolves to the device ID that sorts first', async () => {
  const nav = {tab: 't', append: {name: 'x', params: {deviceID: {ref: 'deviceID' as const}}}}
  assert.deepEqual((await resolveParams(nav, run)).append?.params, {deviceID: 'aaa1'})
})

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
    assert.equal((await runCli(['device', 'list'])).trim(), 'out')
    assert.equal(calls(), 2)
  })
})
test('a second server timeout fails, naming it', async () => {
  await withFakeCli(['context deadline exceeded', 'context deadline exceeded'], async calls => {
    await assert.rejects(runCli(['device', 'list']), /^Error: keybase device: context deadline exceeded$/)
    assert.equal(calls(), 2)
  })
})
test('any other CLI failure is not retried', async () => {
  await withFakeCli(['no such device'], async calls => {
    await assert.rejects(runCli(['device', 'list']), /keybase device: no such device/)
    assert.equal(calls(), 1)
  })
})
