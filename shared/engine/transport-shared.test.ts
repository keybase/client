/// <reference types="jest" />
import * as fs from 'fs'
import * as path from 'path'
import {redactRpcParams, redactRpcResult} from './transport-shared'
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
})
