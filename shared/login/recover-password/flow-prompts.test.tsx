/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {navigateAppend} from '@/constants/router'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {newModalRoutes} from '../routes'

jest.mock('@/provision/flow', () => ({cancelProvision: () => {}, startProvision: () => {}}))

import {
  answerRecoverPasswordPgp,
  cancelRecoverPassword,
  isRecoverPasswordPgpPending,
  markRecoverPasswordPgpShown,
  startRecoverPassword,
  submitRecoverPasswordPaperKey,
  submitRecoverPasswordPassword,
} from './flow'

const recover = 'keybase.1.login.recoverPassphrase'
const getPassphrase = 'keybase.1.secretUi.getPassphrase'
const promptPgp = 'keybase.1.loginUi.promptPassphraseRecovery'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const cancelled = fakeError(T.RPCGen.StatusCode.sccanceled, 'Canceling RPC')

let nav: FakeNavigator
let fake: FakeEngine

// Go asks for the new password and the PGP question after the paper key has logged the user in, so
// these are modals over the logged-in app
beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  nav = installFakeNavigator({modalRouteNames: Object.keys(newModalRoutes), rootState: makeRootState()})
})

afterEach(() => {
  jest.useRealTimers()
  restoreNavigator()
  resetAllStores()
})

// Timeouts are tested on fake timers; the fake engine's own microtasks and the flush stay real
const useFakeTimers = () => jest.useFakeTimers({doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate']})
const isFakeTimers = () => jest.isMockFunction(setTimeout) || 'clock' in setTimeout

// The listener hands incoming calls to their handlers on a timer, and the flow reads them off the
// dialog's events after that
const settle = async () => {
  if (isFakeTimers()) {
    await jest.advanceTimersByTimeAsync(0)
  } else {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  await tick()
}

const startRun = async () => {
  startRecoverPassword({username: 'testuser'})
  await tick()
  return fake.calls.at(-1)!.params.sessionID as number
}

const start = async () => {
  fake = installFakeEngine()
  const held = fake.hold(recover)
  const sessionID = await startRun()
  return {held, sessionID}
}

const lastPromptId = () => (nav.navigations().at(-1)?.params as {promptId?: number} | undefined)?.promptId ?? -1

const pushPassphrase = async (sessionID: number, type: T.RPCGen.PassphraseType, retryLabel = '') => {
  const answered = fake.push(getPassphrase, {pinentry: {retryLabel, type}}, {sessionID})
  await settle()
  return {answered, promptId: lastPromptId()}
}

const rootRouteNames = () => nav.getRootState()?.routes?.map(r => r.name)

describe('paper key prompt', () => {
  test('it shows the retry label and submits the paper key without storing it', async () => {
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushPassphrase(sessionID, T.RPCGen.PassphraseType.paperKey, 'nope')

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordPaperKey',
      params: {error: 'nope', promptId},
      replace: true,
    })
    submitRecoverPasswordPaperKey(promptId, 'one two three')

    await expect(answered).resolves.toEqual({result: {passphrase: 'one two three', storeSecret: false}})
    held[0]!.reply(undefined)
    await settle()
  })

  test('an empty retry label shows no error', async () => {
    const {held, sessionID} = await start()
    await pushPassphrase(sessionID, T.RPCGen.PassphraseType.paperKey)

    expect(nav.navigations().at(-1)).toMatchObject({params: {error: undefined}, replace: true})
    held[0]!.reply(undefined)
    await settle()
  })

  test('backing out refuses the prompt and restarts recovery, replacing the screen', async () => {
    const {sessionID} = await start()
    const {answered, promptId} = await pushPassphrase(sessionID, T.RPCGen.PassphraseType.paperKey)

    cancelRecoverPassword(promptId)

    await expect(answered).resolves.toEqual({error: inputCanceled})
    expect(fake.calls.filter(c => c.method === recover)).toHaveLength(2)
    const newSession = fake.calls.at(-1)!.params.sessionID as number
    void fake.push('keybase.1.loginUi.chooseDeviceToRecoverWith', {devices: [], username: 'testuser'}, {
      sessionID: newSession,
    })
    await settle()
    expect(nav.navigations().at(-1)).toMatchObject({name: 'recoverPasswordDeviceSelector', replace: true})
  })
})

describe('new password prompt', () => {
  test('the first ask pushes the set-password screen and submits a stored password', async () => {
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushPassphrase(sessionID, T.RPCGen.PassphraseType.passPhrase)

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordSetPassword',
      params: {error: undefined, promptId},
      replace: false,
    })
    submitRecoverPasswordPassword(promptId, 'hunter2hunter2')

    await expect(answered).resolves.toEqual({result: {passphrase: 'hunter2hunter2', storeSecret: true}})
    held[0]!.reply(undefined)
    await settle()
  })

  test('a rejected password replaces the screen with the error', async () => {
    const {held, sessionID} = await start()
    const {promptId} = await pushPassphrase(sessionID, T.RPCGen.PassphraseType.passPhrase, 'too short')

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordSetPassword',
      params: {error: 'too short', promptId},
      replace: true,
    })
    held[0]!.reply(undefined)
    await settle()
  })

  test('cancelling refuses the prompt without restarting', async () => {
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushPassphrase(sessionID, T.RPCGen.PassphraseType.passPhrase)

    cancelRecoverPassword(promptId)

    await expect(answered).resolves.toEqual({error: inputCanceled})
    expect(fake.calls.filter(c => c.method === recover)).toHaveLength(1)
    held[0]!.reply(undefined)
    await settle()
  })

  // The paper key has just logged the user in, so the logged-in root may still be mounting
  test('an ask before the logged-in root mounts shows the screen once it does', async () => {
    nav = installFakeNavigator({
      modalRouteNames: Object.keys(newModalRoutes),
      rootState: makeRootState({loggedIn: false}),
    })
    const {held, sessionID} = await start()
    const answered = fake.push(getPassphrase, {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}}, {sessionID})
    await settle()
    expect(nav.pushes()).toEqual([])

    nav.setRootState(makeRootState())

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordSetPassword'])
    const promptId = (nav.pushes().at(-1)?.params as {promptId: number}).promptId
    submitRecoverPasswordPassword(promptId, 'hunter2hunter2')
    await expect(answered).resolves.toEqual({result: {passphrase: 'hunter2hunter2', storeSecret: true}})
    held[0]!.reply(undefined)
    await settle()
  })

  test('an ask whose logged-in root never mounts is refused when the push gives up', async () => {
    nav = installFakeNavigator({
      modalRouteNames: Object.keys(newModalRoutes),
      rootState: makeRootState({loggedIn: false}),
    })
    useFakeTimers()
    const {held, sessionID} = await start()
    let result: unknown
    void fake
      .push(getPassphrase, {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}}, {sessionID})
      .then(r => (result = r))
    await settle()

    await jest.advanceTimersByTimeAsync(4998)
    expect(result).toBeUndefined()
    await jest.advanceTimersByTimeAsync(2)
    await tick()

    expect(result).toEqual({error: inputCanceled})
    nav.setRootState(makeRootState())
    expect(nav.pushes()).toEqual([])
    held[0]!.reply(undefined)
    await settle()
  })
})

describe('pgp key warning', () => {
  const pushPgp = async (sessionID: number) => {
    const answered = fake.push(promptPgp, {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys}, {sessionID})
    await settle()
    return answered
  }

  // The id the flow handed the warning screen it pushed
  const warningId = () => {
    const pushed = nav.pushes().filter(p => p.name === 'recoverPasswordPgpWarning')
    return (pushed.at(-1)?.params as {id: number}).id
  }

  test('a prompt shows the warning as a modal over the logged-in app, bound to the prompt', async () => {
    const {held, sessionID} = await start()
    void pushPgp(sessionID)
    await settle()

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
    expect(isRecoverPasswordPgpPending(warningId())).toBe(true)
    held[0]!.reply(undefined)
    await settle()
  })

  test('a prompt before the logged-in root mounts shows the warning once it does', async () => {
    nav = installFakeNavigator({
      modalRouteNames: Object.keys(newModalRoutes),
      rootState: makeRootState({loggedIn: false}),
    })
    const {held, sessionID} = await start()
    void pushPgp(sessionID)
    await settle()
    expect(nav.pushes()).toEqual([])

    nav.setRootState(makeRootState())

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
    held[0]!.reply(undefined)
    await settle()
  })

  test('the answer is given once: Continue answers true and later answers are ignored', async () => {
    const {held, sessionID} = await start()
    const answered = pushPgp(sessionID)
    await settle()
    const id = warningId()

    answerRecoverPasswordPgp(id, true)
    answerRecoverPasswordPgp(id, true)
    answerRecoverPasswordPgp(id, false)

    await expect(answered).resolves.toEqual({result: true})
    expect(isRecoverPasswordPgpPending(id)).toBe(false)
    held[0]!.reply(undefined)
    await settle()
  })

  test("a restarted run's late prompt is refused and leaves the current run's prompt pending", async () => {
    const {held, sessionID} = await start()
    const newSession = await startRun()
    const answered = pushPgp(newSession)
    await settle()
    const id = warningId()

    await expect(pushPgp(sessionID)).resolves.toEqual({error: inputCanceled})
    await settle()

    expect(isRecoverPasswordPgpPending(id)).toBe(true)
    expect(nav.pushes().filter(p => p.name === 'recoverPasswordPgpWarning')).toHaveLength(1)
    answerRecoverPasswordPgp(id, true)
    await expect(answered).resolves.toEqual({result: true})
    held[1]!.reply(undefined)
    await settle()
  })

  test("a warning answers only its own prompt, never a newer run's", async () => {
    const {held, sessionID} = await start()
    void pushPgp(sessionID)
    await settle()
    const staleId = warningId()

    const newSession = await startRun()
    void pushPgp(newSession)
    await settle()
    answerRecoverPasswordPgp(staleId, true)

    expect(isRecoverPasswordPgpPending(warningId())).toBe(true)
    held[1]!.reply(undefined)
    await settle()
  })

  test('a restart answers a pending prompt false, not a refusal, and takes its warning off the top', async () => {
    const {held, sessionID} = await start()
    const answered = pushPgp(sessionID)
    await settle()
    const id = warningId()

    await startRun()
    answerRecoverPasswordPgp(id, true)
    held[0]!.reply(cancelled)
    await settle()

    await expect(answered).resolves.toEqual({result: false})
    expect(rootRouteNames()).toEqual(['loggedIn'])
    held[1]!.reply(undefined)
    await settle()
  })

  test('a restart with the warning under another modal answers false and leaves both', async () => {
    const {held, sessionID} = await start()
    const answered = pushPgp(sessionID)
    await settle()
    navigateAppend({name: 'proxySettingsModal', params: {}})

    await startRun()

    await expect(answered).resolves.toEqual({result: false})
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
    held[1]!.reply(undefined)
    await settle()
  })

  test('a run ending settles a pending prompt without answering and takes its warning off the top', async () => {
    const {held, sessionID} = await start()
    void pushPgp(sessionID)
    await settle()
    const id = warningId()

    held[0]!.reply(cancelled)
    await settle()
    // The fake fails the test if this reached the service
    answerRecoverPasswordPgp(id, true)

    expect(isRecoverPasswordPgpPending(id)).toBe(false)
    expect(rootRouteNames()).toEqual(['loggedIn'])
  })

  test('a run ending with the warning under another modal leaves both', async () => {
    const {held, sessionID} = await start()
    void pushPgp(sessionID)
    await settle()
    navigateAppend({name: 'proxySettingsModal', params: {}})

    held[0]!.reply(cancelled)
    await settle()

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
  })

  test('a run failing with the warning on top shows the error in its place', async () => {
    const {held, sessionID} = await start()
    void pushPgp(sessionID)
    await settle()

    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
    await settle()

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
  })

  test('a run ending after the prompt was answered answers nothing more and leaves the screens', async () => {
    const {held, sessionID} = await start()
    const answered = pushPgp(sessionID)
    await settle()
    answerRecoverPasswordPgp(warningId(), false)
    await expect(answered).resolves.toEqual({result: false})

    held[0]!.reply(cancelled)
    await settle()

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
  })

  test('a warning that never gets the logged-in root to mount on is declined when its push gives up', async () => {
    nav = installFakeNavigator({
      modalRouteNames: Object.keys(newModalRoutes),
      rootState: makeRootState({loggedIn: false}),
    })
    useFakeTimers()
    const {held, sessionID} = await start()
    let result: unknown
    void pushPgp(sessionID).then(r => (result = r))
    await settle()

    await jest.advanceTimersByTimeAsync(4998)
    expect(result).toBeUndefined()
    await jest.advanceTimersByTimeAsync(2)
    await tick()

    expect(result).toEqual({result: false})
    nav.setRootState(makeRootState())
    expect(nav.pushes()).toEqual([])
    held[0]!.reply(undefined)
    await settle()
  })

  test('a warning pushed but never mounted is declined at the push timeout', async () => {
    useFakeTimers()
    const {held, sessionID} = await start()
    let result: unknown
    void pushPgp(sessionID).then(r => (result = r))
    await settle()

    await jest.advanceTimersByTimeAsync(5000)
    await tick()

    expect(result).toEqual({result: false})
    held[0]!.reply(undefined)
    await settle()
  })

  test('a warning that mounted and was then covered by another modal is not declined by the push timeout', async () => {
    useFakeTimers()
    const {held, sessionID} = await start()
    void pushPgp(sessionID)
    await settle()
    markRecoverPasswordPgpShown(warningId())
    navigateAppend({name: 'proxySettingsModal', params: {}})

    await jest.advanceTimersByTimeAsync(10_000)

    expect(isRecoverPasswordPgpPending(warningId())).toBe(true)
    held[0]!.reply(undefined)
    await settle()
  })

  test('an answered prompt is not declined later by the push timeout', async () => {
    useFakeTimers()
    const {held, sessionID} = await start()
    const answered = pushPgp(sessionID)
    await settle()
    answerRecoverPasswordPgp(warningId(), true)

    await jest.advanceTimersByTimeAsync(10_000)

    await expect(answered).resolves.toEqual({result: true})
    held[0]!.reply(undefined)
    await settle()
  })
})

describe('waiting state', () => {
  // The engine throttles increments; decrements land at once
  const waitingCount = () => {
    fake.engine._throttledDispatchWaitingAction.flush()
    return useWaitingState.getState().counts.get(waitingKeyRecoverPassword) ?? 0
  }

  test('a prompt arriving as the run ends shows nothing', async () => {
    const {held, sessionID} = await start()
    void fake.push(promptPgp, {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys}, {sessionID})
    held[0]!.reply(cancelled)
    await settle()
    await settle()

    expect(nav.pushes().filter(p => p.name === 'recoverPasswordPgpWarning')).toEqual([])
  })

  test('the run waits except while a prompt is up, and answering after it ended leaves the next run free', async () => {
    const {held, sessionID} = await start()
    expect(waitingCount()).toBe(1)
    void fake.push(promptPgp, {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys}, {sessionID})
    await settle()
    const id = (nav.pushes().at(-1)?.params as {id: number}).id
    expect(waitingCount()).toBe(0)

    held[0]!.reply(cancelled)
    await settle()
    answerRecoverPasswordPgp(id, true)
    expect(waitingCount()).toBe(0)

    const newSession = await startRun()
    expect(waitingCount()).toBe(1)
    void fake.push(promptPgp, {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys}, {sessionID: newSession})
    await settle()
    expect(waitingCount()).toBe(0)
    held[1]!.reply(undefined)
    await settle()
  })
})
