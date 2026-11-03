/// <reference types="jest" />
import * as fs from 'fs'
import * as path from 'path'
import {isSecretParam, redactRpcParams, redactRpcResult} from './transport-shared'
import {stripSecretParams} from '@/tests/e2e/ios-appium/gate/screen-params-lib'
import type * as TS from './transport-shared'
import type * as RT from './rpc-transport'

const fixture = 'fixture-secret-9f3a'
const cases: Array<[string, unknown]> = [
  ['account.passphraseChange', {oldPassphrase: fixture, passphrase: fixture, force: false, sessionID: 1}],
  ['account.passphraseCheck', {passphrase: fixture, sessionID: 1}],
  ['login.accountDelete', {passphrase: fixture, sessionID: 1}],
  ['account.enterResetPipeline', {interactive: true, passphrase: fixture, usernameOrEmail: 'testuser'}],
  ['account.resetAccount', {passphrase: fixture}],
  ['login.paperKeySubmit', {paperPhrase: fixture, sessionID: 1}],
  ['login.unlockWithPassphrase', {passphrase: fixture}],
  ['loginUi.displayPaperKeyPhrase', {phrase: fixture, sessionID: 1}],
  ['loginUi.displayPrimaryPaperKey', {phrase: fixture}],
  ['provisionUi.DisplayAndPromptSecret', {phrase: fixture, previousErr: '', secret: new Uint8Array([1, 2])}],
  ['signup.signup', {passphrase: fixture, storeSecret: true}],
  ['wrapped payload', {payload: {method: 'm', param: [{phrase: fixture}], response: {result: () => {}}}}],
  ['mixed-case key', {PaperKey: fixture}],
]

test.each(cases)('%s: logged copy holds no secret', (_name, params) => {
  const logged = JSON.stringify(redactRpcParams(params))
  expect(logged).not.toContain(fixture)
  expect(logged).toContain('<redacted>')
})

test('sent params are not mutated and non-secrets stay', () => {
  const params = {force: false, oldPassphrase: fixture, passphrase: fixture, sessionID: 1, storeSecret: true}
  const logged = redactRpcParams(params) as typeof params
  expect(params.passphrase).toBe(fixture)
  expect(params.oldPassphrase).toBe(fixture)
  expect(logged.sessionID).toBe(1)
  expect(logged.storeSecret).toBe(true)
  expect(logged).not.toBe(params)
})

test('cyclic and non-plain values do not throw', () => {
  const a: Record<string, unknown> = {passphrase: fixture}
  a['self'] = a
  const fn = () => {}
  const out = redactRpcParams({a, fn}) as {fn: unknown}
  expect(out.fn).toBe(fn)
  expect(JSON.stringify(redactRpcParams({a: {passphrase: fixture}}))).not.toContain(fixture)
})

test('an object reached twice is redacted both times, and a cycle ends at the depth cut-off', () => {
  const shared = {passphrase: fixture, user: 'testuser'}
  const looped: Record<string, unknown> = {phrase: fixture}
  looped['self'] = looped
  const out = redactRpcParams({first: shared, list: [shared, shared], looped, second: shared}) as Record<string, unknown>
  const logged = JSON.stringify(out)
  expect(logged).not.toContain(fixture)
  expect(logged).toContain('<depth>')
  expect({...out, looped: undefined}).toEqual({
    first: {passphrase: '<redacted>', user: 'testuser'},
    list: [
      {passphrase: '<redacted>', user: 'testuser'},
      {passphrase: '<redacted>', user: 'testuser'},
    ],
    looped: undefined,
    second: {passphrase: '<redacted>', user: 'testuser'},
  })
})

test("a paper key device's name is redacted, other devices' names stay", () => {
  const out = redactRpcParams([
    {device: {deviceID: 'd1', name: 'wrong shaft', type: 'backup'}},
    {device: {deviceID: 'd2', name: 'Paper Key (wrong shaft...)', type: 'backup'}},
    {device: {deviceID: 'd3', name: 'iOS Device', type: 'mobile'}},
  ])
  expect(JSON.stringify(out)).not.toContain('wrong shaft')
  expect(out).toEqual([
    {device: {deviceID: 'd1', name: '<redacted>', type: 'backup'}},
    {device: {deviceID: 'd2', name: '<redacted>', type: 'backup'}},
    {device: {deviceID: 'd3', name: 'iOS Device', type: 'mobile'}},
  ])
})

test('depth cutoff fails closed', () => {
  let deep: Record<string, unknown> = {passphrase: fixture}
  for (let i = 0; i < 20; i++) deep = {n: deep}
  const logged = JSON.stringify(redactRpcParams(deep))
  expect(logged).not.toContain(fixture)
  expect(logged).toContain('<depth>')
})

test('token keys and string codes are redacted, numeric codes stay', () => {
  const logged = redactRpcParams({code: '123456', status: {code: 7}, token: fixture, tokenOrName: fixture, inviteCode: fixture}) as {
    code: string
    status: {code: number}
  }
  expect(JSON.stringify(logged)).not.toContain(fixture)
  expect(logged.code).toBe('<redacted>')
  expect(logged.status.code).toBe(7)
})

test("a string's token= query value is redacted wherever the string is, and the rest of it stays", () => {
  const url = `http://127.0.0.1:5000/files/a.txt?token=${fixture}&viewType=1`
  const out = redactRpcParams({contexts: [{url}], note: `see ?TOKEN=${fixture}`, plain: 'token=not-a-query'})
  expect(JSON.stringify(out)).not.toContain(fixture)
  expect(out).toEqual({
    contexts: [{url: 'http://127.0.0.1:5000/files/a.txt?token=<redacted>&viewType=1'}],
    note: 'see ?TOKEN=<redacted>',
    plain: 'token=not-a-query',
  })
})

test("an invite link's key is redacted wherever the string is, in each form the service and the app write it", () => {
  const key = 'madeupkey0123456789'
  const out = redactRpcParams({
    app: `keybase://team-invite-link/abcdefghijklmnop/${key}`,
    note: `join at https://KEYBASE.IO/I/T/abcdefghijklmnop#${key.toUpperCase()} please`,
    plain: 'a # that is not a link, and /i/t/ alone',
    url: `https://keybase.io/i/t/abcdefghijklmnop#${key}`,
  })
  expect(JSON.stringify(out).toLowerCase()).not.toContain(key)
  expect(out).toEqual({
    app: 'keybase://team-invite-link/abcdefghijklmnop/<redacted>',
    note: 'join at https://KEYBASE.IO/I/T/abcdefghijklmnop#<redacted> please',
    plain: 'a # that is not a link, and /i/t/ alone',
    url: 'https://keybase.io/i/t/abcdefghijklmnop#<redacted>',
  })
})

// Every field of the generated protocol types whose name looks like a secret must be redacted by
// name, or be listed here as not one. A new secret-bearing field fails this instead of logging.
const secretShaped = /pass(phrase|word)|secret|paper(key|phrase)|phrase|token|seed|invite(code|link)|^code$/i
const notSecrets: Record<string, string> = {
  cursorToken: 'a paging cursor',
  passphraseState: 'an enum of whether a passphrase is set',
  secretNoteErrMsg: 'an error message',
  seedChecks: 'check values of the seeds, not the seeds',
}
test('every secret-shaped field name in rpc-gen is redacted or known not to be a secret', () => {
  const dir = path.join(__dirname, '../constants/rpc')
  const fields = new Map<string, Set<string>>()
  for (const f of fs.readdirSync(dir).filter(f => /^rpc-.*gen\.tsx$/.test(f))) {
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/(?:readonly |[{,(] *)([A-Za-z]+)\??: ([^,}\n]+)/g)) {
      const [, name = '', type = ''] = m
      if (!secretShaped.test(name)) continue
      fields.set(name, (fields.get(name) ?? new Set()).add(type.trim()))
    }
  }
  expect(fields.size).toBeGreaterThan(10)
  const unredacted = [...fields]
    .filter(([, types]) => ![...types].every(t => t === 'boolean'))
    .filter(([name]) => !(name in notSecrets))
    .filter(([name]) => JSON.stringify(redactRpcParams({[name]: 'x'})) !== JSON.stringify({[name]: '<redacted>'}))
    .map(([name, types]) => `${name}: ${[...types].join(' | ')}`)
  expect(unredacted).toEqual([])
})

// Every enabled method (rpc-gen's createRpc calls, from enabled-calls.json) whose result is a bare
// string, or an alias of one, has no key to redact by: its result is redacted whole, or it is listed
// here as not a secret. A new secret-returning method fails this instead of logging.
const notSecretResults: Record<string, string> = {
  'chat.1.local.getUploadTempFile': 'a temp file path',
  'chat.1.local.makeUploadTempFile': 'a temp file path',
  'chat.1.local.normalizeUnfurlDomain': 'a domain',
  'chat.1.local.unboxMobilePushNotification': "a push's message text",
  'keybase.1.SimpleFS.simpleFSMakeTempDirForUpload': 'a temp folder path',
  'keybase.1.SimpleFS.simpleFSStartDownload': 'a download id',
  'keybase.1.SimpleFS.simpleFSStartUpload': 'an upload id',
  'keybase.1.account.guessCurrentLocation': 'a country code',
  'keybase.1.config.logSend': 'a log send id',
  'keybase.1.git.createPersonalRepo': 'a repo id',
  'keybase.1.git.createTeamRepo': 'a repo id',
  'keybase.1.kbfsMount.GetCurrentMountDir': 'a folder path',
  'keybase.1.saltpack.saltpackSaveCiphertextToFile': 'the path of the file it wrote',
  'keybase.1.saltpack.saltpackSaveSignedMsgToFile': 'the path of the file it wrote',
  'keybase.1.saltpack.saltpackSignFile': 'the path of the file it wrote',
  'keybase.1.teams.getTeamID': 'a team id',
  'keybase.1.teams.teamCreateFancy': 'a team id',
}
test('every enabled method that returns a bare string is redacted whole or known not to return a secret', () => {
  const dir = path.join(__dirname, '../constants/rpc')
  const stringTypes = new Set(['string'])
  const outParams = new Map<string, string>()
  const enabled = new Set<string>()
  for (const f of fs.readdirSync(dir).filter(f => /^rpc-.*gen\.tsx$/.test(f))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8')
    for (const [, name = ''] of text.matchAll(/^export type (\w+) = string$/gm)) stringTypes.add(name)
    for (const [, method = '', out = ''] of text.matchAll(/^ {2}'([\w.]+)': \{\n {4}inParam: [^\n]*\n {4}outParam: ([^,\n]+),/gm)) outParams.set(method, out)
    for (const [, method = ''] of text.matchAll(/^export const \w+ = createRpc\('([\w.]+)'\)/gm)) enabled.add(method)
  }
  expect(enabled.size).toBeGreaterThan(100)
  expect([...enabled].filter(m => !outParams.has(m))).toEqual([])
  const unredacted = [...enabled]
    .filter(m => stringTypes.has(outParams.get(m) ?? ''))
    .filter(m => !(m in notSecretResults))
    .filter(m => redactRpcResult(m, fixture) !== '<redacted>')
  expect(unredacted).toEqual([])
})

test("a wallet account's secret key result is redacted", () => {
  expect(redactRpcResult('stellar.1.local.getWalletAccountSecretKeyLocal', fixture)).toBe('<redacted>')
})

// The phone's join by a pasted invite link: the join call takes the link, the service asks the app to
// confirm with the invite's details (no key), and the app's answer and the call's result log the
// payload and booleans. None of the logged copies holds the link or its key.
test('the invite-link join path logs no link and no key', () => {
  const key = 'secretkey0123456789'
  const link = `https://keybase.io/i/t/abcdefghijklmnop#${key}`
  const details = {inviteID: 'f00d', inviterUsername: 'testuser', teamID: 'tid', teamName: {parts: ['team', 'sub']}}
  const logged = [
    redactRpcParams({sessionID: 1, tokenOrName: link}),
    redactRpcParams({sessionID: 1, tokenOrName: link.toLowerCase()}),
    redactRpcParams({details, sessionID: 1}),
    redactRpcParams({payload: {method: 'keybase.1.teamsUi.confirmInviteLinkAccept', param: [{details, sessionID: 1}], response: {}}}),
    redactRpcParams({wasOpenTeam: false, wasSeitan: true, wasTeamName: false, wasToken: true}),
  ].map(l => JSON.stringify(l))
  for (const l of logged) {
    expect(l).not.toContain(key)
    expect(l).not.toContain('keybase.io/i/t')
  }
  expect(logged[0]).toContain('<redacted>')
})

// A team page's load returns each invite link of the team with its url, key included, as the
// invite's displayName (the team's Invite links read it from there). The logged result keeps the
// link's id and drops its key.
test("a team load's invite links are logged without their keys", () => {
  const key = 'madeupkey0123456789'
  const invite = {
    displayName: `https://keybase.io/i/t/abcdefghijklmnop#${key}`,
    // TeamInviteCategory.invitelink
    inviteExt: {c: 7, invitelink: {annotatedUsedInvites: null}},
    inviterUsername: 'testuser',
    isValid: true,
    teamName: 'testteam',
    validityDescription: 'Expires in 7 days',
  }
  const logged = JSON.stringify(redactRpcResult('keybase.1.teams.getAnnotatedTeam', {invites: [invite], name: 'testteam', teamID: 'tid'}))
  expect(logged).not.toContain(key)
  expect(logged).toContain('keybase.io/i/t/abcdefghijklmnop#<redacted>')
})

// The e2e harness reads the visible screen's route params through this key list, so a secret route
// param (an invite link's key, a token) never leaves the app.
test('route params lose inviteKey and every key the RPC log redacts', () => {
  const link = 'https://keybase.io/i/t/abcdefghijklmnop#secretkey0123456789'
  const params = {
    inviteDetails: {teamID: 'tid'},
    inviteKey: link,
    list: [{code: '123456', passphrase: fixture, phrase: fixture, status: {code: 7}}],
    storeSecret: true,
    tokenOrName: link,
  }
  expect(stripSecretParams(params, isSecretParam)).toEqual({
    inviteDetails: {teamID: 'tid'},
    list: [{status: {code: 7}}],
    storeSecret: true,
  })
})

// Each saltpack call that carries text, with what it sends and what it returns.
const saltpackCalls: Array<[string, object, unknown]> = [
  ['keybase.1.saltpack.saltpackEncryptString', {opts: {includeSelf: true, recipients: ['testuser']}, plaintext: fixture}, {ciphertext: fixture, unresolvedSBSAssertion: '', usedUnresolvedSBS: false}],
  ['keybase.1.saltpack.saltpackDecryptString', {ciphertext: fixture}, {info: {sender: {username: 'testuser'}}, plaintext: fixture, signed: true}],
  ['keybase.1.saltpack.saltpackSignString', {plaintext: fixture}, fixture],
  ['keybase.1.saltpack.saltpackVerifyString', {signedMsg: fixture}, {plaintext: fixture, sender: {username: 'testuser'}, signingKID: 'kid', verified: true}],
  ['keybase.1.saltpack.saltpackSaveCiphertextToFile', {ciphertext: fixture}, '/tmp/out.saltpack'],
  ['keybase.1.saltpack.saltpackSaveSignedMsgToFile', {signedMsg: fixture}, '/tmp/out.saltpack'],
]

test.each(saltpackCalls)('%s: logged params and result hold no saltpack text', (method, params, result) => {
  expect(JSON.stringify(redactRpcParams(params))).not.toContain(fixture)
  expect(JSON.stringify(redactRpcResult(method, result))).not.toContain(fixture)
})

test('saltpack results keep what is not text', () => {
  const out = redactRpcResult('keybase.1.saltpack.saltpackDecryptString', {info: {sender: {username: 'testuser'}}, plaintext: fixture, signed: true})
  expect(out).toEqual({info: {sender: {username: 'testuser'}}, plaintext: '<redacted>', signed: true})
  expect(redactRpcResult('keybase.1.saltpack.saltpackSaveCiphertextToFile', '/tmp/out.saltpack')).toBe('/tmp/out.saltpack')
})

describe('rpcLog and invoke end to end', () => {
  const lines = new Array<unknown[]>()
  let rpcLog: typeof TS.rpcLog
  let TransportShared: typeof TS.TransportShared
  let RPCTransport: typeof RT.RPCTransport
  beforeAll(() => {
    jest.resetModules()
    jest.doMock('@/local-debug', () => ({printRPC: true, printRPCWaitingSession: true}))
    jest.doMock('@/util/idle-callback', () => ({requestIdleCallback: (cb: () => void) => cb()}))
    jest.doMock('./local-console', () => ({green: (...a: Array<unknown>) => lines.push(a)}))
    /* eslint-disable @typescript-eslint/no-require-imports */
    ;({rpcLog, TransportShared} = require('./transport-shared') as typeof TS)
    ;({RPCTransport} = require('./rpc-transport') as typeof RT)
    /* eslint-enable @typescript-eslint/no-require-imports */
  })
  beforeEach(() => {
    lines.length = 0
  })

  test.each(saltpackCalls)('rpcLog params of %s', (method, params) => {
    rpcLog({extra: params, method, reason: '[+calling]', type: 'engineToServer'})
    expect(lines).toHaveLength(1)
    expect(JSON.stringify(lines)).not.toContain(fixture)
  })

  test('rpcLog params path', () => {
    rpcLog({extra: {passphrase: fixture, sessionID: 1}, method: 'account.passphraseCheck', reason: '[+calling]', type: 'engineToServer'})
    expect(lines).toHaveLength(1)
    expect(JSON.stringify(lines)).not.toContain(fixture)
    expect(JSON.stringify(lines)).toContain('<redacted>')
  })

  test.each([
    ['keybase.1.config.generateWebAuthToken', fixture],
    ['keybase.1.teams.teamCreateSeitanTokenV2', fixture],
    ['keybase.1.signup.getInvitationCode', fixture],
    ['keybase.1.account.passphrasePrompt', {passphrase: fixture}],
    ['keybase.1.device.deviceHistoryList', [{device: {name: fixture, type: 'backup'}}]],
    ...saltpackCalls.map(([method, , result]) => [method, result] as [string, unknown]),
  ])('invoke [-calling] result of %s', (method, result) => {
    class T extends TransportShared {
      protected override writeMessage() {}
    }
    const spy = jest.spyOn(RPCTransport.prototype, 'invoke').mockImplementation((_m, _a, cb) => cb(null, result))
    const cb = jest.fn()
    new T().invoke(method, [{}], cb)
    spy.mockRestore()
    expect(cb).toHaveBeenCalledWith(null, result)
    expect(lines.length).toBeGreaterThan(0)
    expect(JSON.stringify(lines)).not.toContain(fixture)
  })

  // The phone's Change password (settings/password.tsx) sends the new password with an empty old one
  // and gets nothing back; the call and its answer each log a line, and neither holds the password.
  test('invoke of the phone password change logs no password', () => {
    class T extends TransportShared {
      protected override writeMessage() {}
    }
    const spy = jest.spyOn(RPCTransport.prototype, 'invoke').mockImplementation((_m, _a, cb) => cb(null, null))
    const cb = jest.fn()
    new T().invoke('keybase.1.account.passphraseChange', [{force: true, oldPassphrase: '', passphrase: fixture, sessionID: 1}], cb)
    spy.mockRestore()
    expect(cb).toHaveBeenCalledWith(null, null)
    expect(lines).toHaveLength(2)
    expect(JSON.stringify(lines)).not.toContain(fixture)
    expect(JSON.stringify(lines[0])).toContain('<redacted>')
  })

  // A sign-in with a password answers the service's getPassphrase with it: the incoming call and the
  // answer each log a line, and neither holds the password.
  test('the answer to getPassphrase logs no password', () => {
    class T extends TransportShared {
      protected override writeMessage() {}
    }
    const answered = jest.fn()
    const payload = {
      method: 'keybase.1.secretUi.getPassphrase',
      param: [{pinentry: {prompt: 'Password', type: 1}, sessionID: 1}],
      response: {cancelled: false, error: jest.fn(), result: answered, seqid: 1},
    }
    rpcLog({extra: payload.param[0], method: payload.method, reason: '[incoming]', type: 'serverToEngine'})
    new T().injectInstrumentedResponse(payload as unknown as Parameters<TS.TransportShared['injectInstrumentedResponse']>[0])
    payload.response.result({passphrase: fixture, storeSecret: false})
    expect(answered).toHaveBeenCalledWith({passphrase: fixture, storeSecret: false})
    expect(lines).toHaveLength(2)
    expect(JSON.stringify(lines)).not.toContain(fixture)
  })
})
