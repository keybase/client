/// <reference types="jest" />
import {redactRpcParams} from './transport-shared'
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

test('an object reached twice is redacted both times, and a cycle is marked', () => {
  const shared = {passphrase: fixture, user: 'testuser'}
  const looped: Record<string, unknown> = {phrase: fixture}
  looped['self'] = looped
  const out = redactRpcParams({first: shared, list: [shared, shared], looped, second: shared})
  expect(JSON.stringify(out)).not.toContain(fixture)
  expect(out).toEqual({
    first: {passphrase: '<redacted>', user: 'testuser'},
    list: [
      {passphrase: '<redacted>', user: 'testuser'},
      {passphrase: '<redacted>', user: 'testuser'},
    ],
    looped: {phrase: '<redacted>', self: '<cycle>'},
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
