/// <reference types="jest" />
import * as T from '@/constants/types'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from './fake-engine'
import type * as FakeEngineModule from './fake-engine'
import {getCallPort, hasCallPort, installCallPort, uninstallCallPort} from '@/engine/call-port'
import {MESSAGE_TYPE_RESPONSE, errors} from '@/engine/rpc-transport'
import {useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'
import {tick} from '@/test/flush'
import {testWaitingKey} from './waiting-key'

afterEach(() => resetAllStores())

// Starts a recoverPassphrase listener whose session the service can push prompts into.
const linkLost = {code: errors.EOF, desc: 'The service connection was lost', kind: {reason: 'disconnect', type: 'cancelled'}, name: 'EOF'}

const startRecover = async (
  fake: FakeEngine,
  onPrompt: NonNullable<T.RPCGen.CustomResponseIncomingCallMap['keybase.1.loginUi.promptPassphraseRecovery']>
) => {
  const held = fake.hold('keybase.1.login.recoverPassphrase')
  const done = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {'keybase.1.loginUi.promptPassphraseRecovery': onPrompt},
    incomingCallMap: {},
    params: {username: 'testuser'},
  })
  await tick()
  return {done, held, sessionID: held[0]!.params.sessionID as number}
}

test('a scripted call resolves through the real engine and waiting store', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({deviceName: 'd'}))
  const p = T.RPCGen.configGetBootstrapStatusRpcPromise(undefined, testWaitingKey('test:waiting'))
  expect(useWaitingState.getState().counts.get(testWaitingKey('test:waiting'))).toBe(1)
  await expect(p).resolves.toMatchObject({deviceName: 'd'})
  expect(useWaitingState.getState().counts.get(testWaitingKey('test:waiting'))).toBeUndefined()
  expect(fake.calls.map(c => c.method)).toEqual(['keybase.1.config.getBootstrapStatus'])
})

test('a scripted error rejects the call with that error', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', async () => {
    await Promise.resolve()
    return fakeError(1234, 'nope')
  })
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).rejects.toMatchObject({code: 1234})
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

test('the afterEach the fake registers fails a test that never uninstalled', () => {
  // A failing hook can't be asserted in-file (test.failing ignores hooks), so load a fresh copy of
  // the module, capture the hook it registers, and run it by hand.
  const hooks: Array<() => void> = []
  const register = jest.spyOn(global, 'afterEach').mockImplementation(fn => {
    hooks.push(fn as () => void)
  })
  let isolated: typeof FakeEngineModule | undefined
  jest.isolateModules(() => {
    isolated = jest.requireActual<typeof FakeEngineModule>('./fake-engine')
  })
  register.mockRestore()
  expect(hooks).toHaveLength(1)
  const fake = isolated!.installFakeEngine()
  fake.engine._rpcClient.transport.send([MESSAGE_TYPE_RESPONSE, 5, null, true])
  expect(() => hooks[0]!()).toThrow('GUI answered seqid 5, which no push sent')
  // the hook leaves nothing installed, so the next one is a no-op
  expect(() => hooks[0]!()).not.toThrow()
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

test('installing a second fake while one is installed throws', () => {
  installFakeEngine()
  expect(() => installFakeEngine()).toThrow('already installed')
})

test('a held call settles when the test replies', async () => {
  const fake = installFakeEngine()
  const held = fake.hold('keybase.1.config.getBootstrapStatus')
  const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
  // The call crosses IPC to the service a turn later
  expect(held).toHaveLength(0)
  await tick()
  expect(held).toHaveLength(1)
  held[0]!.reply({deviceName: 'held'})
  await expect(p).resolves.toMatchObject({deviceName: 'held'})
})

test('a held call left at uninstall fails, and nothing reaches the stores afterwards', async () => {
  const fake = installFakeEngine()
  const held = fake.hold('keybase.1.config.getBootstrapStatus')
  const settled = T.RPCGen.configGetBootstrapStatusRpcPromise(undefined, testWaitingKey('test:held')).then(
    () => 'resolved',
    (e: unknown) => e
  )
  expect(useWaitingState.getState().counts.get(testWaitingKey('test:held'))).toBe(1)
  uninstallFakeEngine()
  await expect(settled).resolves.toMatchObject(linkLost)
  expect(useWaitingState.getState().counts.get(testWaitingKey('test:held'))).toBeUndefined()

  const changes = jest.fn()
  const unsubscribe = useWaitingState.subscribe(changes)
  held[0]!.reply({deviceName: 'late'})
  await tick()
  unsubscribe()
  expect(changes).not.toHaveBeenCalled()
})

test('a dropped link rejects a held call', async () => {
  const fake = installFakeEngine()
  fake.hold('keybase.1.config.waitForClient')
  const rejected = expect(
    T.RPCGen.configWaitForClientRpcPromise({clientType: T.RPCGen.ClientType.none, timeout: 1})
  ).rejects.toMatchObject(linkLost)
  fake.drop()
  // The renderer hears of it a turn later, as the relay's link frame crosses IPC
  expect(fake.connected()).toBe(true)
  await tick()
  expect(fake.connected()).toBe(false)
  await rejected
})

test('a call made while dropped is refused, and one made once the link comes back is answered', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({deviceName: 'back'}))
  fake.drop()
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).rejects.toMatchObject(linkLost)
  fake.restart()
  expect(fake.connected()).toBe(false)
  await tick()
  expect(fake.connected()).toBe(true)
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).resolves.toMatchObject({deviceName: 'back'})
  expect(fake.calls).toHaveLength(1)
})

test('a pushed prompt reaches the listener map and returns its answer', async () => {
  const fake = installFakeEngine()
  const {done, held, sessionID} = await startRecover(fake, (_p, response) => response.result(true))
  await expect(
    fake.push('keybase.1.loginUi.promptPassphraseRecovery', {kind: 0}, {sessionID})
  ).resolves.toEqual({result: true})
  held[0]!.reply(null)
  await done
})

test('a dropped link settles a push the GUI has not answered', async () => {
  const fake = installFakeEngine()
  const {done, sessionID} = await startRecover(fake, () => {})
  const pushed = fake.push('keybase.1.loginUi.promptPassphraseRecovery', {kind: 0}, {sessionID})
  fake.drop()
  await expect(pushed).resolves.toEqual({error: linkLost})
  await expect(done).rejects.toMatchObject(linkLost)
})

test('a second GUI answer to the same push fails the test', async () => {
  const fake = installFakeEngine()
  const {done, sessionID} = await startRecover(fake, (_p, response) => response.result(true))
  const ended = done.catch((e: unknown) => e)
  await fake.push('keybase.1.loginUi.promptPassphraseRecovery', {kind: 0}, {sessionID})
  // The first push of a fake gets seqid 1; RPCTransport's own once-guard would stop a real second
  // answer, so write one straight to the link.
  fake.engine._rpcClient.transport.send([MESSAGE_TYPE_RESPONSE, 1, null, false])
  expect(() => uninstallFakeEngine()).toThrow(
    'GUI answered push seqid 1 (keybase.1.loginUi.promptPassphraseRecovery) when it was no longer waiting'
  )
  // uninstall fails the session that was still open
  await expect(ended).resolves.toMatchObject(linkLost)
})

test('a service cancel settles the pending push and the GUI may no longer answer it', async () => {
  const fake = installFakeEngine()
  const {done, held, sessionID} = await startRecover(fake, () => {})
  const pushed = fake.push('keybase.1.loginUi.promptPassphraseRecovery', {kind: 0}, {sessionID})
  fake.cancelPush('keybase.1.loginUi.promptPassphraseRecovery')
  await expect(pushed).resolves.toMatchObject({error: {desc: 'fake engine: the service cancelled it'}})
  held[0]!.reply(undefined)
  // msgpack has no undefined: a void reply arrives as null
  await expect(done).resolves.toBeNull()
  fake.engine._rpcClient.transport.send([MESSAGE_TYPE_RESPONSE, 1, null, true])
  expect(() => uninstallFakeEngine()).toThrow('GUI answered push seqid 1')
})

test('cancelling a push that is not pending throws', () => {
  const fake = installFakeEngine()
  expect(() => fake.cancelPush('keybase.1.loginUi.promptPassphraseRecovery')).toThrow(
    'no pending keybase.1.loginUi.promptPassphraseRecovery push to cancel'
  )
})

test('a GUI answer to a seqid no push sent fails the test', () => {
  const fake = installFakeEngine()
  fake.engine._rpcClient.transport.send([MESSAGE_TYPE_RESPONSE, 999, null, true])
  expect(() => uninstallFakeEngine()).toThrow('GUI answered seqid 999, which no push sent')
})

test('a pushed notification reaches onEngineIncoming', async () => {
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  await expect(
    fake.push('keybase.1.NotifyBadges.badgeState', {badgeState: {}}, {oneway: true})
  ).resolves.toEqual({})
  expect(onEngineIncoming).not.toHaveBeenCalled()
  await tick()
  expect(onEngineIncoming).toHaveBeenCalledWith(
    expect.objectContaining({type: 'keybase.1.NotifyBadges.badgeState'})
  )
})

test('uninstalling restores the port that was installed before', () => {
  const port = {call: jest.fn(() => 1), cancelOutstandingSessions: jest.fn(), listen: jest.fn()}
  installCallPort(port)
  const fake = installFakeEngine()
  expect(getCallPort()).toBe(fake.engine)
  uninstallFakeEngine()
  expect(getCallPort()).toBe(port)
  uninstallCallPort()
})

test('an answer that throws after uninstall fails the test then running', async () => {
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const fake = installFakeEngine()
    let fail: (e: Error) => void = () => {}
    fake.answer('keybase.1.config.getBootstrapStatus', async () => new Promise((_resolve, reject) => (fail = reject)))
    const settled = T.RPCGen.configGetBootstrapStatusRpcPromise().catch((e: unknown) => e)
    await tick()
    uninstallFakeEngine()
    await expect(settled).resolves.toMatchObject(linkLost)
    fail(new Error('late boom'))
    await tick()
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('keybase.1.config.getBootstrapStatus (its answer threw: late boom)')
    )
  } finally {
    logged.mockRestore()
  }
})

test('what crosses the wire is msgpack: undefined arrives as null, and nothing is shared by reference', async () => {
  const fake = installFakeEngine()
  const answer = {deviceName: undefined, uid: 'u1'}
  fake.answer('keybase.1.config.getBootstrapStatus', () => answer)
  fake.answer('keybase.1.config.waitForClient', () => true)
  const params = {clientType: T.RPCGen.ClientType.none, timeout: 1}
  const waited = T.RPCGen.configWaitForClientRpcPromise(params)
  params.timeout = 2
  await expect(waited).resolves.toBe(true)
  expect(fake.calls[0]!.params).toEqual({
    clientType: T.RPCGen.ClientType.none,
    sessionID: expect.any(Number),
    timeout: 1,
  })
  const status = await T.RPCGen.configGetBootstrapStatusRpcPromise()
  expect(status).toEqual({deviceName: null, uid: 'u1'})
  expect(status).not.toBe(answer)
})

test('a reply arrives a macrotask later, not on a microtask', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({deviceName: 'd'}))
  let settled = false
  void T.RPCGen.configGetBootstrapStatusRpcPromise().then(() => (settled = true))
  for (let i = 0; i < 50; i++) {
    await Promise.resolve()
  }
  expect(settled).toBe(false)
  // Over to the service, and its reply back: a turn each way
  await tick()
  await tick()
  expect(settled).toBe(true)
})

test('an engine reset drops the link and it stays down, as the desktop relay keeps it', async () => {
  const fake = installFakeEngine()
  fake.hold('keybase.1.config.waitForClient')
  const rejected = expect(
    T.RPCGen.configWaitForClientRpcPromise({clientType: T.RPCGen.ClientType.none, timeout: 1})
  ).rejects.toMatchObject(linkLost)
  fake.engine.reset()
  // engineDropLink crosses to the relay, and its link-down frame crosses back
  expect(fake.connected()).toBe(true)
  await tick()
  await tick()
  expect(fake.connected()).toBe(false)
  await rejected
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).rejects.toMatchObject(linkLost)
  expect(() => fake.restart()).toThrow('stays down until the renderer reloads')
  expect(fake.calls.map(c => c.method)).toEqual(['keybase.1.config.waitForClient'])
})
