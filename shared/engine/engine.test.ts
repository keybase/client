/// <reference types="jest" />
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {tick} from '@/test/flush'
import logger from '@/logger'
import {errors as rpcErrors} from './rpc-transport'
import {isEOFError, isErrorTransient, type RPCError} from '@/util/errors'

afterEach(() => {
  resetAllStores()
  jest.restoreAllMocks()
})

// The transport fails its outstanding invocations before it tells the engine, so the engine's own
// session cancel on disconnect finds the session already ended and the call sees the transport's error:
// an EOF, which the app reads as a service restart rather than as a user cancel or an error to show.
test('a call in flight when the link drops rejects with the transport EOF error', async () => {
  const fake = installFakeEngine()
  fake.hold('keybase.1.config.getBootstrapStatus')
  const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
  fake.drop()
  const err = await p.then(
    () => new Error('resolved'),
    (e: unknown) => e as RPCError
  )
  expect(err).toMatchObject({code: rpcErrors.EOF, desc: 'The service connection was lost'})
  expect(isEOFError(err)).toBe(true)
  expect(isErrorTransient(err)).toBe(true)
  uninstallFakeEngine()
})

test('a call started before an account switch is refused when its reply lands after', async () => {
  const fake = installFakeEngine()
  useConfigState.getState().dispatch.setLoggedIn(true)
  // A background session: the switch's cancelOutstandingSessions leaves it running, so its reply
  // is what lands after the switch.
  const held = fake.hold('keybase.1.SimpleFS.simpleFSUserEditHistory')
  const p = T.RPCGen.SimpleFSSimpleFSUserEditHistoryRpcPromise()
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  useConfigState.getState().dispatch.setUserSwitching(false)
  held[0]!.reply({folders: []})
  await expect(p).rejects.toMatchObject({
    code: T.RPCGen.StatusCode.sccanceled,
    desc: 'The account changed during this call',
  })
  uninstallFakeEngine()
})

test('a global prompt the engine does not hand over is auto-answered once', async () => {
  // The transport swallows a second settle and only logs it, so watch the log
  const logged = jest.spyOn(logger, 'error')
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  await expect(
    fake.push('keybase.1.NotifyTeam.avatarUpdated', {formats: [], name: 'testuser', typ: 0})
  ).resolves.toEqual({result: undefined})
  expect(onEngineIncoming).toHaveBeenCalledTimes(1)
  expect(onEngineIncoming.mock.calls[0]![0].payload).not.toHaveProperty('response')
  expect(logged).not.toHaveBeenCalled()
  uninstallFakeEngine()
})

test('a service cancel of a pending prompt rejects the listener', async () => {
  const fake = installFakeEngine()
  const onPrompt = jest.fn()
  fake.hold('keybase.1.login.recoverPassphrase')
  const done = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {'keybase.1.loginUi.promptPassphraseRecovery': onPrompt},
    incomingCallMap: {},
    params: {username: 'testuser'},
  })
  const ended = done.catch((e: unknown) => e)
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const pushed = fake.push('keybase.1.loginUi.promptPassphraseRecovery', {kind: 0}, {sessionID})
  // the listener hands the prompt to its handler on a timer
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(onPrompt).toHaveBeenCalledTimes(1)
  fake.cancelPush('keybase.1.loginUi.promptPassphraseRecovery')
  await expect(ended).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
  await pushed
  await tick()
  // The engine writes no RESPONSE of its own for the cancelled seqid; the fake would record one
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test('reset restarts the link, so calls still reach the fake', async () => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({deviceName: 'after reset'}))
  fake.engine.reset()
  await expect(T.RPCGen.configGetBootstrapStatusRpcPromise()).resolves.toMatchObject({deviceName: 'after reset'})
  expect(fake.calls.map(c => c.method)).toEqual(['keybase.1.config.getBootstrapStatus'])
  uninstallFakeEngine()
})
