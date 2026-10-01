/// <reference types="jest" />
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine} from './fake-engine'
import {getCallPort, hasCallPort, installCallPort, uninstallCallPort} from '@/engine/call-port'
import {useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'

afterEach(() => {
  resetAllStores()
  uninstallCallPort()
})

test('a scripted call resolves through the real engine and waiting store', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({deviceName: 'd'}))
  const p = T.RPCGen.configGetBootstrapStatusRpcPromise(undefined, 'test:waiting')
  expect(useWaitingState.getState().counts.get('test:waiting')).toBe(1)
  await expect(p).resolves.toMatchObject({deviceName: 'd'})
  expect(useWaitingState.getState().counts.get('test:waiting')).toBeUndefined()
  expect(fake.calls.map(c => c.method)).toEqual(['keybase.1.config.getBootstrapStatus'])
  uninstallFakeEngine()
})

test('a scripted error rejects the call with that error', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', async () => {
    await Promise.resolve()
    return {error: {code: 1234, desc: 'nope'}}
  })
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).rejects.toMatchObject({code: 1234})
  uninstallFakeEngine()
})

test('an unscripted call fails the test by name', async () => {
  installFakeEngine()
  // RPCError only looks like an Error, so toThrow can't match it
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).rejects.toMatchObject({
    desc: expect.stringContaining('nothing scripted'),
  })
  expect(() => uninstallFakeEngine()).toThrow('keybase.1.config.getBootstrapStatus')
  expect(hasCallPort()).toBe(false)
})

test('an answer that throws fails the call and the test', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', () => {
    throw new Error('boom')
  })
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).rejects.toMatchObject({
    desc: expect.stringContaining('threw'),
  })
  expect(() => uninstallFakeEngine()).toThrow('keybase.1.config.getBootstrapStatus (its answer threw: boom)')
})

test('a held call settles when the test replies', async () => {
  const fake = installFakeEngine()
  const held = fake.hold('keybase.1.config.getBootstrapStatus')
  const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
  expect(held).toHaveLength(1)
  held[0]!.reply({deviceName: 'held'})
  await expect(p).resolves.toMatchObject({deviceName: 'held'})
  uninstallFakeEngine()
})

test('a dropped link rejects a held call', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const fake = installFakeEngine()
  fake.hold('keybase.1.config.waitForClient')
  const p = T.RPCGen.configWaitForClientRpcPromise({clientType: T.RPCGen.ClientType.none, timeout: 1})
  fake.drop()
  expect(fake.connected()).toBe(false)
  await expect(p).rejects.toBeTruthy()
  warn.mockRestore()
  uninstallFakeEngine()
})

test('a call made while dropped is sent once the link comes back', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({deviceName: 'back'}))
  fake.drop()
  const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
  expect(fake.calls).toHaveLength(0)
  fake.restart()
  expect(fake.connected()).toBe(true)
  await expect(p).resolves.toMatchObject({deviceName: 'back'})
  warn.mockRestore()
  log.mockRestore()
  uninstallFakeEngine()
})

test('a pushed prompt reaches the listener map and returns its answer', async () => {
  const fake = installFakeEngine()
  const held = fake.hold('keybase.1.login.recoverPassphrase')
  const done = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {
      'keybase.1.loginUi.promptPassphraseRecovery': (_p, response) => response.result(true),
    },
    incomingCallMap: {},
    params: {username: 'testuser'},
  })
  await new Promise(resolve => setImmediate(resolve))
  const sessionID = held[0]!.params.sessionID
  await expect(
    fake.push('keybase.1.loginUi.promptPassphraseRecovery', {kind: 0}, {sessionID})
  ).resolves.toEqual({result: true})
  held[0]!.reply(null)
  await done
  uninstallFakeEngine()
})

test('a dropped link settles a push the GUI has not answered', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const fake = installFakeEngine()
  const held = fake.hold('keybase.1.login.recoverPassphrase')
  const done = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {'keybase.1.loginUi.promptPassphraseRecovery': () => {}},
    incomingCallMap: {},
    params: {username: 'testuser'},
  })
  await new Promise(resolve => setImmediate(resolve))
  const pushed = fake.push('keybase.1.loginUi.promptPassphraseRecovery', {kind: 0}, {
    sessionID: held[0]!.params.sessionID,
  })
  fake.drop()
  await expect(pushed).resolves.toMatchObject({error: {desc: 'fake engine: link dropped'}})
  await expect(done).rejects.toBeTruthy()
  warn.mockRestore()
  uninstallFakeEngine()
})

test('a pushed notification reaches onEngineIncoming', async () => {
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  await expect(
    fake.push('keybase.1.NotifyBadges.badgeState', {badgeState: {}}, {oneway: true})
  ).resolves.toEqual({})
  expect(onEngineIncoming).toHaveBeenCalledWith(
    expect.objectContaining({type: 'keybase.1.NotifyBadges.badgeState'})
  )
  uninstallFakeEngine()
})

test('uninstalling restores the port that was installed before', () => {
  const port = {call: jest.fn(() => 1), cancelOutstandingSessions: jest.fn(), listen: jest.fn()}
  installCallPort(port)
  const fake = installFakeEngine()
  expect(getCallPort()).toBe(fake.engine)
  uninstallFakeEngine()
  expect(getCallPort()).toBe(port)
})
