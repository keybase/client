/* eslint-disable @typescript-eslint/no-floating-promises */
import {test, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {resolveParams, clearResolveCache, type CliRunner} from './resolve.mts'

process.env['KB_E2E_TEAM'] = 'testteam'
let calls: Array<string> = []
const run: CliRunner = async args => {
  await Promise.resolve()
  calls.push(args[0] ?? '')
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
