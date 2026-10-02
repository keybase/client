/// <reference types="jest" />
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {errors} from './rpc-transport'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'

afterEach(() => {
  resetAllStores()
  jest.restoreAllMocks()
})

const tick = async () => new Promise(resolve => setImmediate(resolve))

// The transport fails its outstanding invocations before it tells the engine, so the engine's own
// session cancel on disconnect finds the session already ended and the call sees EOF, not sccanceled.
test('a call in flight when the link drops rejects with EOF', async () => {
  const fake = installFakeEngine()
  fake.hold('keybase.1.config.getBootstrapStatus')
  const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
  fake.drop()
  await expect(p).rejects.toMatchObject({code: errors.EOF})
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

test('getPassphrase outside a session reaches the action with its response', async () => {
  const answer = {passphrase: 'testpass', storeSecret: false}
  const onEngineIncoming = jest.fn((a: {type: string; payload: {response?: {result: (r: unknown) => void}}}) => {
    if (a.type === 'keybase.1.secretUi.getPassphrase') {
      a.payload.response?.result(answer)
    }
  })
  const fake = installFakeEngine({onEngineIncoming: onEngineIncoming as never})
  await expect(
    fake.push('keybase.1.secretUi.getPassphrase', {pinentry: {}, terminal: null}, {sessionID: 0})
  ).resolves.toEqual({result: answer})
  expect(onEngineIncoming).toHaveBeenCalledTimes(1)
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
  await expect(pushed).resolves.toMatchObject({error: {desc: expect.stringContaining('cancelled')}})
  uninstallFakeEngine()
})
