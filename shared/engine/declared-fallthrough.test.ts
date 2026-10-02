/// <reference types="jest" />
// A listener declares which incoming methods it leaves to global handling. Anything else it receives
// without a handler still goes the global way, but is reported: a test failure under the fake engine,
// a logged error in a dev build.
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import logger from '@/logger'

const dev = __DEV__
afterEach(() => {
  global.__DEV__ = dev
  jest.restoreAllMocks()
})

const resetMessage = 'keybase.1.loginUi.displayResetMessage'
const promptReset = 'keybase.1.loginUi.promptResetAccount'
const undeclared = (method: string) => `keybase.1.login.recoverPassphrase got undeclared incoming ${method}`

const startRecover = async (fake: FakeEngine, globalFallthrough?: ReadonlyArray<string>) => {
  fake.hold('keybase.1.login.recoverPassphrase')
  void T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {'keybase.1.loginUi.promptPassphraseRecovery': () => {}},
    globalFallthrough,
    incomingCallMap: {},
    params: {username: 'testuser'},
  }).catch(() => {})
  await tick()
  return fake.calls[0]!.params.sessionID as number
}

test('an undeclared notification is acked as before and fails the test', async () => {
  const fake = installFakeEngine()
  const sessionID = await startRecover(fake)
  await expect(fake.push(resetMessage, {kind: 0}, {sessionID})).resolves.toEqual({result: undefined})
  expect(() => uninstallFakeEngine()).toThrow(undeclared(resetMessage))
})

test('an undeclared prompt is refused as before and fails the test', async () => {
  const fake = installFakeEngine()
  const sessionID = await startRecover(fake)
  await expect(fake.push(promptReset, {prompt: {t: 0}}, {sessionID})).resolves.toMatchObject({
    error: {code: T.RPCGen.StatusCode.scinputcanceled},
  })
  expect(() => uninstallFakeEngine()).toThrow(undeclared(promptReset))
})

test('a declared prefix falls through silently', async () => {
  const fake = installFakeEngine()
  const sessionID = await startRecover(fake, ['keybase.1.loginUi.displayReset'])
  await expect(fake.push(resetMessage, {kind: 0}, {sessionID})).resolves.toEqual({result: undefined})
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test('a plain call declares nothing, so nothing it receives is reported', async () => {
  const fake = installFakeEngine()
  fake.hold('keybase.1.config.getBootstrapStatus')
  void T.RPCGen.configGetBootstrapStatusRpcPromise().catch(() => {})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  await expect(fake.push(resetMessage, {kind: 0}, {sessionID})).resolves.toEqual({result: undefined})
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test('outside the fake engine a dev build logs an undeclared fall-through', async () => {
  global.__DEV__ = true
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const fake = installFakeEngine()
  fake.engine.onUndeclaredIncoming = undefined
  const sessionID = await startRecover(fake)
  await fake.push(resetMessage, {kind: 0}, {sessionID})
  expect(logged).toHaveBeenCalledTimes(1)
  expect(logged).toHaveBeenCalledWith(undeclared(resetMessage))
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test('outside the fake engine a production build says nothing', async () => {
  global.__DEV__ = false
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const fake = installFakeEngine()
  fake.engine.onUndeclaredIncoming = undefined
  const sessionID = await startRecover(fake)
  await expect(fake.push(resetMessage, {kind: 0}, {sessionID})).resolves.toEqual({result: undefined})
  expect(logged).not.toHaveBeenCalled()
  expect(() => uninstallFakeEngine()).not.toThrow()
})
