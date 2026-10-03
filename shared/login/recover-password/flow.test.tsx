/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import logger from '@/logger'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {navigateAppend} from '@/constants/router'
import {rootWaitLimitMs} from '@/constants/navigator'
import {useRouterState} from '@/stores/router'

const mockCancelProvision = jest.fn()
jest.mock('@/provision/flow', () => ({
  cancelProvision: () => mockCancelProvision(),
  startProvision: () => {},
}))

import {
  cancelRecoverPassword,
  isRecoverPasswordPromptOpen,
  restartRecoverPassword,
  startRecoverPassword,
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordNoDevice,
  submitRecoverPasswordReset,
} from './flow'

const recover = 'keybase.1.login.recoverPassphrase'
const chooseDevice = 'keybase.1.loginUi.chooseDeviceToRecoverWith'
const promptReset = 'keybase.1.loginUi.promptResetAccount'
const getPassphrase = 'keybase.1.secretUi.getPassphrase'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const deviceID = T.Devices.stringToDeviceID('device-1')
const devices = [{deviceID: 'device-1', deviceNumberOfType: 1, name: 'phone', type: 'mobile'}]
// clearModals only has something to dispatch when a modal is on screen. Nothing below replaces onto
// this name: a replace onto the visible route collapses into a setParams.
const openModal = 'proxySettingsModal'

let nav: FakeNavigator
let fake: FakeEngine

// What the app's container does on every state change: route-gone reads the router store's copy
const mirrorRouterStore = () =>
  nav.addListener('state', () => useRouterState.getState().dispatch.setNavState(nav.getRootState()!))

beforeEach(() => {
  nav = installFakeNavigator({modalRouteNames: [openModal], rootState: makeRootState({above: [{name: openModal}]})})
})

afterEach(() => {
  restoreNavigator()
  mockCancelProvision.mockReset()
  resetAllStores()
})

// The listener hands incoming calls to their handlers on a timer, and the flow reads them off the
// dialog's events after that
const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await tick()
}

const start = async (p?: {onEngineIncoming?: () => void; replaceRoute?: boolean; onResetEmailSent?: () => void}) => {
  fake = installFakeEngine({onEngineIncoming: p?.onEngineIncoming})
  const held = fake.hold(recover)
  startRecoverPassword({onResetEmailSent: p?.onResetEmailSent, replaceRoute: p?.replaceRoute, username: 'testuser'})
  await tick()
  return {held, sessionID: fake.calls[0]!.params.sessionID as number}
}

// Starts another run on the same fake, as a screen's restart does
const restart = async () => {
  restartRecoverPassword('testuser')
  await tick()
  return fake.calls.at(-1)!.params.sessionID as number
}

// The id the flow handed the screen it navigated to last
const lastPromptId = () => (nav.navigations().at(-1)?.params as {promptId?: number} | undefined)?.promptId ?? -1

const pushDevices = async (sessionID: number) => {
  const answered = fake.push(chooseDevice, {devices, username: 'testuser'}, {sessionID})
  await settle()
  return {answered, promptId: lastPromptId()}
}

const pushResetPassword = async (sessionID: number) => {
  const answered = fake.push(promptReset, {prompt: {t: T.RPCGen.ResetPromptType.enterResetPw}}, {sessionID})
  await settle()
  return {answered, promptId: lastPromptId()}
}

test('it starts recovery for the username', async () => {
  const {held} = await start()
  expect(fake.calls[0]!.method).toBe(recover)
  expect(fake.calls[0]!.params).toMatchObject({username: 'testuser'})
  held[0]!.reply(undefined)
  await settle()
})

test('aborting provisioning cancels it', async () => {
  fake = installFakeEngine()
  fake.hold(recover)
  startRecoverPassword({abortProvisioning: true, username: 'testuser'})
  expect(mockCancelProvision).toHaveBeenCalledTimes(1)
  await tick()
})

describe('device selection', () => {
  test('the selector shows the devices, and selecting one answers its id once', async () => {
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushDevices(sessionID)

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordDeviceSelector',
      params: {
        devices: [expect.objectContaining({id: deviceID, name: 'phone', type: 'mobile'})],
        promptId,
        recoverRunId: expect.any(String),
      },
      replace: false,
    })
    submitRecoverPasswordDeviceSelect(promptId, deviceID)
    submitRecoverPasswordDeviceSelect(promptId, deviceID)

    await expect(answered).resolves.toEqual({result: deviceID})
    held[0]!.reply(undefined)
    await settle()
  })

  test('the selector replaces the current route when asked to', async () => {
    const {held, sessionID} = await start({replaceRoute: true})
    await pushDevices(sessionID)

    expect(nav.navigations().at(-1)).toMatchObject({name: 'recoverPasswordDeviceSelector', replace: true})
    held[0]!.reply(undefined)
    await settle()
  })

  test('cancelling the selector refuses the prompt and pops the screen', async () => {
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushDevices(sessionID)

    cancelRecoverPassword(promptId)

    await expect(answered).resolves.toEqual({error: inputCanceled})
    expect(nav.types().filter(t => t === 'GO_BACK')).toHaveLength(1)
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
  })

  test('an empty device id from the selector is a cancel', async () => {
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushDevices(sessionID)

    submitRecoverPasswordDeviceSelect(promptId, undefined)

    await expect(answered).resolves.toEqual({error: inputCanceled})
    expect(nav.types()).toContain('GO_BACK')
    held[0]!.reply(undefined)
    await settle()
  })

  test('choosing no device answers an empty id', async () => {
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushDevices(sessionID)

    submitRecoverPasswordNoDevice(promptId)

    await expect(answered).resolves.toEqual({result: ''})
    held[0]!.reply(undefined)
    await settle()
  })
})

describe('reset prompts', () => {
  test('submitting the reset-password screen answers once, tells the caller, and pops it', async () => {
    const onResetEmailSent = jest.fn()
    const {held, sessionID} = await start({onResetEmailSent})
    const {answered, promptId} = await pushResetPassword(sessionID)

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordPromptResetPassword',
      params: {promptId, recoverRunId: expect.any(String), username: 'testuser'},
      replace: false,
    })
    submitRecoverPasswordReset(promptId, T.RPCGen.ResetPromptResponse.confirmReset)
    submitRecoverPasswordReset(promptId, T.RPCGen.ResetPromptResponse.confirmReset)

    await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.confirmReset})
    expect(onResetEmailSent).toHaveBeenCalledTimes(1)
    expect(nav.types().filter(t => t === 'GO_BACK')).toHaveLength(1)
    held[0]!.reply(undefined)
    await settle()
  })

  test('a reset prompt that is not a password reset hands off to the account reset flow', async () => {
    const {held, sessionID} = await start()
    const answered = fake.push(promptReset, {prompt: {t: T.RPCGen.ResetPromptType.enterNoDevices}}, {sessionID})

    await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordPromptResetAccount',
      params: {skipPassword: true, username: 'testuser'},
      replace: true,
    })
    held[0]!.reply(undefined)
    await settle()
  })

  test('the reset message falls through to the global handler', async () => {
    const onEngineIncoming = jest.fn()
    const {held, sessionID} = await start({onEngineIncoming})
    await fake.push('keybase.1.loginUi.displayResetMessage', {kind: 0}, {sessionID})

    expect(onEngineIncoming).toHaveBeenCalledWith(
      expect.objectContaining({type: 'keybase.1.loginUi.displayResetMessage'})
    )
    held[0]!.reply(undefined)
    await settle()
  })
})

test('a device-recovery explanation replaces the current screen', async () => {
  const {held, sessionID} = await start()
  await fake.push(
    'keybase.1.loginUi.explainDeviceRecovery',
    {kind: T.RPCGen.DeviceType.mobile, name: 'testuser-mac'},
    {sessionID}
  )
  await settle()

  expect(nav.navigations()).toContainEqual({
    name: 'recoverPasswordExplainDevice',
    params: {
      deviceName: 'testuser-mac',
      deviceType: T.RPCGen.DeviceType.mobile,
      recoverRunId: expect.any(String),
      username: 'testuser',
    },
    replace: true,
  })
  held[0]!.reply(undefined)
  await settle()
})

describe('completion', () => {
  test('a successful recovery clears the modals', async () => {
    const {held} = await start()
    held[0]!.reply(undefined)
    await settle()

    expect(nav.modalsCleared()).toBe(true)
  })

  test.each([
    ['cancelled', T.RPCGen.StatusCode.sccanceled],
    ['input-cancelled', T.RPCGen.StatusCode.scinputcanceled],
  ])('a %s recovery shows no error and leaves modals alone', async (_, code) => {
    const {held} = await start()
    held[0]!.reply(fakeError(code, 'Input canceled'))
    await settle()

    expect(nav.modalsCleared()).toBe(false)
    expect(nav.navigations()).toEqual([])
  })

  // The root's routes, with the logged-out stack's screens in place of its route
  const screens = () =>
    (nav.getRootState()?.routes ?? []).flatMap(r =>
      r.name === 'loggedOut' ? (r.state?.routes ?? []).map(s => s.name) : [r.name]
    )

  const failWith = async (held: Awaited<ReturnType<typeof start>>['held'], message = 'bad things') => {
    held.at(-1)!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, message))
    await settle()
  }

  const loggedOutRoot = () => makeRootState({loggedIn: false})
  const errorModal = 'recoverPasswordErrorModal'

  const pushPassphrase = async (sessionID: number, type: T.RPCGen.PassphraseType) => {
    void fake.push(getPassphrase, {pinentry: {retryLabel: '', type}}, {sessionID})
    await settle()
  }

  test('logged in with a conversation pushed over the tabs, the error goes over it and Back returns to it', async () => {
    nav = installFakeNavigator({
      modalRouteNames: [errorModal],
      rootState: makeRootState({above: [{name: 'chatConversation'}]}),
    })
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {held} = await start()
    await failWith(held)

    expect(nav.navigations()).toEqual([
      {name: errorModal, params: {error: expect.stringContaining('bad things')}, replace: false},
    ])
    expect(screens()).toEqual(['loggedIn', 'chatConversation', errorModal])
    nav.navigateUp()
    expect(screens()).toEqual(['loggedIn', 'chatConversation'])
  })

  test("logged in, a modal that is not the run's stays and the error goes over it", async () => {
    nav = installFakeNavigator({modalRouteNames: [openModal, errorModal], rootState: makeRootState({above: [{name: openModal}]})})
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {held} = await start()
    await failWith(held)

    expect(screens()).toEqual(['loggedIn', openModal, errorModal])
  })

  test("the run's modal under a modal that is not the run's goes, the other stays, and the error goes on top", async () => {
    nav = installFakeNavigator({
      modalRouteNames: [openModal, errorModal, 'recoverPasswordSetPassword'],
      rootState: makeRootState(),
    })
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {held, sessionID} = await start()
    await pushPassphrase(sessionID, T.RPCGen.PassphraseType.passPhrase)
    navigateAppend({name: openModal, params: {}} as never)
    expect(screens()).toEqual(['loggedIn', 'recoverPasswordSetPassword', openModal])
    await failWith(held)

    expect(screens()).toEqual(['loggedIn', openModal, errorModal])
  })

  test("on iOS the run's modal under a modal that is not the run's stays, as a covered modal can't be taken out", async () => {
    const wasIOS = isIOS
    global.isIOS = true
    nav = installFakeNavigator({
      modalRouteNames: [openModal, errorModal, 'recoverPasswordSetPassword'],
      rootState: makeRootState(),
    })
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {held, sessionID} = await start()
    await pushPassphrase(sessionID, T.RPCGen.PassphraseType.passPhrase)
    navigateAppend({name: openModal, params: {}} as never)
    expect(screens()).toEqual(['loggedIn', 'recoverPasswordSetPassword', openModal])
    await failWith(held)

    global.isIOS = wasIOS

    expect(screens()).toEqual(['loggedIn', 'recoverPasswordSetPassword', openModal, errorModal])
  })

  test("logged out, the run's device selector goes and the error takes its place over login", async () => {
    nav = installFakeNavigator({rootState: loggedOutRoot()})
    const {held, sessionID} = await start()
    await pushDevices(sessionID)
    expect(screens()).toEqual(['login', 'recoverPasswordDeviceSelector'])
    await failWith(held)

    expect(nav.navigations().at(-1)).toEqual({
      name: 'recoverPasswordError',
      params: {error: expect.stringContaining('bad things')},
      replace: false,
    })
    expect(screens()).toEqual(['login', 'recoverPasswordError'])
    nav.navigateUp()
    expect(screens()).toEqual(['login'])
  })

  test("provision's password screen, handed over to the run, goes with the run's screens", async () => {
    nav = installFakeNavigator({rootState: loggedOutRoot()})
    navigateAppend({name: 'username', params: {}} as never)
    navigateAppend({name: 'password', params: {username: 'testuser'}} as never)
    fake = installFakeEngine()
    const held = fake.hold(recover)
    startRecoverPassword({abortProvisioning: true, username: 'testuser'})
    await tick()
    await pushDevices(fake.calls[0]!.params.sessionID as number)
    expect(screens()).toEqual(['login', 'username', 'password', 'recoverPasswordDeviceSelector'])
    await failWith(held)

    expect(screens()).toEqual(['login', 'username', 'recoverPasswordError'])
    nav.navigateUp()
    expect(screens()).toEqual(['login', 'username'])
  })

  test("a failure right after a run screen's push, before the screen mounts, takes it away", async () => {
    nav = installFakeNavigator({rootState: loggedOutRoot()})
    const {held, sessionID} = await start()
    void fake.push(chooseDevice, {devices, username: 'testuser'}, {sessionID})
    await settle()
    // Pushed, so in the root state, with nothing of the screen run yet
    expect(screens()).toEqual(['login', 'recoverPasswordDeviceSelector'])
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
    await settle()

    expect(screens()).toEqual(['login', 'recoverPasswordError'])
  })

  test('logged out with only login, the error goes over it and Back returns to it', async () => {
    nav = installFakeNavigator({rootState: loggedOutRoot()})
    const {held} = await start()
    await failWith(held)

    expect(screens()).toEqual(['login', 'recoverPasswordError'])
    nav.navigateUp()
    expect(screens()).toEqual(['login'])
  })

  test('logged in by the paper key before the root swap, the error shows once the logged-in root mounts', async () => {
    nav = installFakeNavigator({modalRouteNames: [errorModal], rootState: loggedOutRoot()})
    const {held, sessionID} = await start()
    await pushDevices(sessionID)
    await pushPassphrase(sessionID, T.RPCGen.PassphraseType.paperKey)
    useConfigState.getState().dispatch.setLoggedIn(true)
    await failWith(held)
    expect(screens()).toEqual(['login'])

    nav.setRootState(makeRootState())

    expect(screens()).toEqual(['loggedIn', errorModal])
  })

  test('logged in by the paper key, then out again before any root swap, the error shows on the logged-out root', async () => {
    nav = installFakeNavigator({modalRouteNames: [errorModal], rootState: loggedOutRoot()})
    const {setLoggedIn} = useConfigState.getState().dispatch
    const {held} = await start()
    setLoggedIn(true)
    await failWith(held)
    expect(screens()).toEqual(['login'])

    setLoggedIn(false)

    expect(screens()).toEqual(['login', 'recoverPasswordError'])
  })

  describe('past the wait for the matching root', () => {
    beforeEach(() => {
      jest.useFakeTimers({doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate']})
    })
    afterEach(() => {
      jest.useRealTimers()
    })
    const failNow = async (held: Awaited<ReturnType<typeof start>>['held']) => {
      held.at(-1)!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
      await jest.advanceTimersByTimeAsync(0)
      await tick()
    }

    test('a root that still disagrees with config shows the error rather than dropping it', async () => {
      nav = installFakeNavigator({modalRouteNames: [errorModal], rootState: loggedOutRoot()})
      const {held} = await start()
      useConfigState.getState().dispatch.setLoggedIn(true)
      await failNow(held)
      expect(screens()).toEqual(['login'])

      await jest.advanceTimersByTimeAsync(5000)

      expect(screens()).toEqual(['login', 'recoverPasswordError'])
    })

    test("desktop's loading root is waited out up to the limit, then the error is dropped with a warning", async () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
      nav = installFakeNavigator({
        rootState: {index: 0, key: 'root', routes: [{key: 'loading', name: 'loading'}], type: 'stack'},
      })
      const {held} = await start()
      await failNow(held)
      await jest.advanceTimersByTimeAsync(rootWaitLimitMs)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('gave up on root loading'))

      nav.setRootState(loggedOutRoot())

      expect(nav.navigations()).toEqual([])
      warn.mockRestore()
    })

    test('the error on a root swapped out past the sweep window is not shown again', async () => {
      nav = installFakeNavigator({modalRouteNames: [errorModal], rootState: makeRootState()})
      mirrorRouterStore()
      useConfigState.getState().dispatch.setLoggedIn(true)
      const {held} = await start()
      await failNow(held)
      expect(screens()).toEqual(['loggedIn', errorModal])

      await jest.advanceTimersByTimeAsync(5000)
      useConfigState.getState().dispatch.setLoggedIn(false)
      nav.setRootState(loggedOutRoot())
      await jest.advanceTimersByTimeAsync(60_000)

      expect(screens()).toEqual(['login'])
    })

    test("desktop's loading root is waited out however long it takes, within the limit", async () => {
      nav = installFakeNavigator({
        rootState: {index: 0, key: 'root', routes: [{key: 'loading', name: 'loading'}], type: 'stack'},
      })
      const {held} = await start()
      await failNow(held)
      await jest.advanceTimersByTimeAsync(rootWaitLimitMs - 1)
      expect(nav.navigations()).toEqual([])

      nav.setRootState(loggedOutRoot())

      expect(screens()).toEqual(['login', 'recoverPasswordError'])
    })
  })

  test("desktop's loading root: the error waits for the logged-out root, then shows", async () => {
    nav = installFakeNavigator({
      rootState: {index: 0, key: 'root', routes: [{key: 'loading', name: 'loading'}], type: 'stack'},
    })
    const {held} = await start()
    await failWith(held)
    expect(nav.navigations()).toEqual([])

    nav.setRootState(loggedOutRoot())

    expect(screens()).toEqual(['login', 'recoverPasswordError'])
  })

  // Go's changePassword failing after the paper key logged the user in logs out, then returns the error
  describe('a logout racing the error', () => {
    const failOnLoggedIn = async () => {
      nav = installFakeNavigator({modalRouteNames: [errorModal], rootState: makeRootState()})
      mirrorRouterStore()
      useConfigState.getState().dispatch.setLoggedIn(true)
      const {held} = await start()
      await failWith(held)
      expect(screens()).toEqual(['loggedIn', errorModal])
      return held
    }
    const swapRoot = (loggedIn: boolean) => {
      useConfigState.getState().dispatch.setLoggedIn(loggedIn)
      nav.setRootState(loggedIn ? makeRootState() : loggedOutRoot())
    }

    test('a root swap that takes the error away soon after it showed shows it again on the new root, once', async () => {
      await failOnLoggedIn()

      swapRoot(false)
      expect(screens()).toEqual(['login', 'recoverPasswordError'])
      expect(nav.getRootState()?.routes?.[0]?.state?.routes.at(-1)?.params).toEqual({
        error: expect.stringContaining('bad things'),
      })

      swapRoot(true)
      expect(screens()).toEqual(['loggedIn'])
    })

    test('the user dismissing the error does not show it again', async () => {
      await failOnLoggedIn()

      nav.navigateUp()
      expect(screens()).toEqual(['loggedIn'])
      swapRoot(false)

      expect(screens()).toEqual(['login'])
    })

    // The swap in the same turn as the restart, before the watch's entry is gone
    test('a restart before the swap shows nothing again', async () => {
      const held = await failOnLoggedIn()
      nav.clearActions()
      startRecoverPassword({username: 'testuser'})
      swapRoot(false)
      await tick()

      expect(nav.navigations()).toEqual([])
      held.at(-1)!.reply(undefined)
      await settle()
    })
  })

  test('logged in by the paper key, failing while the root disagrees, then restarted: the old error never shows', async () => {
    nav = installFakeNavigator({modalRouteNames: [errorModal], rootState: loggedOutRoot()})
    // The wait's config subscription, to see the restart end it
    const subscribe = useConfigState.subscribe
    const unsubscribes: Array<jest.Mock> = []
    jest.spyOn(useConfigState, 'subscribe').mockImplementation(listener => {
      const unsubscribe = jest.fn(subscribe(listener))
      unsubscribes.push(unsubscribe)
      return unsubscribe
    })
    const {held, sessionID} = await start()
    await pushDevices(sessionID)
    await pushPassphrase(sessionID, T.RPCGen.PassphraseType.paperKey)
    useConfigState.getState().dispatch.setLoggedIn(true)
    await failWith(held)
    expect(screens()).toEqual(['login'])

    expect(unsubscribes).toHaveLength(1)
    expect(unsubscribes[0]).not.toHaveBeenCalled()

    await restart()
    expect(unsubscribes[0]).toHaveBeenCalledTimes(1)
    nav.setRootState(makeRootState())
    useConfigState.getState().dispatch.setLoggedIn(false)
    nav.setRootState(loggedOutRoot())

    expect(nav.navigations().map(n => n.name)).not.toContain(errorModal)
    expect(nav.navigations().map(n => n.name)).not.toContain('recoverPasswordError')
    held.at(-1)!.reply(undefined)
    await settle()
    jest.restoreAllMocks()
  })

  test("a screen the run shows without a prompt is the run's by its run id", async () => {
    nav = installFakeNavigator({rootState: loggedOutRoot()})
    const {held, sessionID} = await start()
    await pushDevices(sessionID)
    await fake.push(
      'keybase.1.loginUi.explainDeviceRecovery',
      {kind: T.RPCGen.DeviceType.mobile, name: 'testuser-mac'},
      {sessionID}
    )
    await settle()
    // Another run's
    navigateAppend({name: 'recoverPasswordExplainDevice', params: {recoverRunId: 'other-0'}} as never)
    expect(screens()).toEqual(['login', 'recoverPasswordExplainDevice', 'recoverPasswordExplainDevice'])
    await failWith(held)

    expect(screens()).toEqual(['login', 'recoverPasswordExplainDevice', 'recoverPasswordError'])
    expect(nav.getRootState()?.routes?.[0]?.state?.routes[1]?.params).toEqual({recoverRunId: 'other-0'})
  })

  test("an earlier run's screen of the same name is not this run's", async () => {
    nav = installFakeNavigator({rootState: loggedOutRoot()})
    const {held, sessionID} = await start()
    await pushDevices(sessionID)
    // A new run, not a restart: no screen is handed over
    startRecoverPassword({username: 'testuser'})
    await tick()
    await pushDevices(fake.calls.at(-1)!.params.sessionID as number)
    expect(screens()).toEqual(['login', 'recoverPasswordDeviceSelector', 'recoverPasswordDeviceSelector'])
    await failWith(held)

    expect(screens()).toEqual(['login', 'recoverPasswordDeviceSelector', 'recoverPasswordError'])
  })

  test('a retry from the error screen that fails again leaves one error, the new one', async () => {
    nav = installFakeNavigator({rootState: loggedOutRoot()})
    const {held} = await start()
    await failWith(held, 'first failure')
    expect(screens()).toEqual(['login', 'recoverPasswordError'])

    await restart()
    await failWith(held, 'second failure')

    expect(screens()).toEqual(['login', 'recoverPasswordError'])
    expect(nav.getRootState()?.routes?.[0]?.state?.routes.at(-1)?.params).toEqual({
      error: expect.stringContaining('second failure'),
    })
  })

  test('once the run is over its screens answer nothing', async () => {
    const {held, sessionID} = await start()
    const {promptId} = await pushDevices(sessionID)

    held[0]!.reply(undefined)
    await settle()
    expect(isRecoverPasswordPromptOpen(promptId)).toBe(false)
    // The fake fails the test if this reached the service
    submitRecoverPasswordDeviceSelect(promptId, deviceID)
  })
})

test('a screen that fails to show is logged with its prompt, and the run stops', async () => {
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const failure = new Error('no such screen')
  nav = installFakeNavigator({
    modalRouteNames: [openModal],
    onDispatch: a => {
      if (a.payload?.['name'] === 'recoverPasswordDeviceSelector') throw failure
    },
    rootState: makeRootState({above: [{name: openModal}]}),
  })
  const {sessionID} = await start()
  const answered = fake.push(chooseDevice, {devices, username: 'testuser'}, {sessionID})
  await settle()

  expect(error).toHaveBeenCalledWith(expect.stringContaining(chooseDevice), failure)
  await expect(answered).resolves.toEqual({error: inputCanceled})
  error.mockRestore()
})

describe('restart', () => {
  test.each([false, true])(
    "a screen's restart keeps telling the caller a reset email was sent (old run ended: %s)",
    async ended => {
      const onResetEmailSent = jest.fn()
      const {held} = await start({onResetEmailSent})
      if (ended) {
        held[0]!.reply(undefined)
        await settle()
      }
      const newSession = await restart()
      const {answered, promptId} = await pushResetPassword(newSession)
      submitRecoverPasswordReset(promptId, T.RPCGen.ResetPromptResponse.confirmReset)
      await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.confirmReset})
      expect(onResetEmailSent).toHaveBeenCalledTimes(1)
      held.at(-1)!.reply(undefined)
      await settle()
    }
  )

  test("a restart for another user does not tell the earlier run's caller", async () => {
    const onResetEmailSent = jest.fn()
    await start({onResetEmailSent})
    restartRecoverPassword('testuser-mac')
    await tick()
    const newSession = fake.calls.at(-1)!.params.sessionID as number
    const {promptId} = await pushResetPassword(newSession)
    submitRecoverPasswordReset(promptId, T.RPCGen.ResetPromptResponse.confirmReset)
    expect(onResetEmailSent).not.toHaveBeenCalled()
  })

  test("a restart refuses the old run's open prompts and the old screen no longer answers", async () => {
    const {sessionID} = await start()
    const {answered, promptId} = await pushDevices(sessionID)

    await restart()

    await expect(answered).resolves.toEqual({error: inputCanceled})
    expect(isRecoverPasswordPromptOpen(promptId)).toBe(false)
    submitRecoverPasswordDeviceSelect(promptId, deviceID)
  })

  test("the old run's late prompts are refused and reach neither the screens nor a global answerer", async () => {
    const onEngineIncoming = jest.fn()
    const {sessionID} = await start({onEngineIncoming})
    await restart()
    nav.clearActions()

    await expect(fake.push(chooseDevice, {devices, username: 'testuser'}, {sessionID})).resolves.toEqual({
      error: inputCanceled,
    })
    await settle()

    expect(nav.actions).toEqual([])
    expect(onEngineIncoming).not.toHaveBeenCalled()
  })

  test("the old run ending, even successfully, navigates nowhere and leaves the new run's prompts open", async () => {
    const {held} = await start()
    const newSession = await restart()
    const {answered, promptId} = await pushDevices(newSession)
    nav.clearActions()

    held[0]!.reply(undefined)
    await settle()

    expect(nav.actions).toEqual([])
    submitRecoverPasswordDeviceSelect(promptId, deviceID)
    await expect(answered).resolves.toEqual({result: deviceID})
    held[1]!.reply(undefined)
    await settle()
  })

  test("the old run failing after a restart took its screen removes nothing and shows no error", async () => {
    nav = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    const {held, sessionID} = await start()
    await pushDevices(sessionID)
    await restart()
    nav.clearActions()

    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
    await settle()

    expect(nav.actions).toEqual([])
    held[1]!.reply(undefined)
    await settle()
  })

  // The RPC has succeeded, but the run waits a timer for its last events, and the restart comes first
  test('a run restarted after its RPC succeeded navigates nowhere', async () => {
    const {held} = await start()
    held[0]!.reply(undefined)
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve()
    }
    nav.clearActions()
    startRecoverPassword({replaceRoute: true, username: 'testuser'})
    await settle()

    expect(nav.actions).toEqual([])
    held[1]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
  })
})

describe('account changes', () => {
  // A logout resets the stores; the run lives outside them, so its screens still answer
  test('a logout keeps the run answerable', async () => {
    const {setLoggedIn} = useConfigState.getState().dispatch
    setLoggedIn(true)
    const {held, sessionID} = await start()
    const {answered, promptId} = await pushDevices(sessionID)

    setLoggedIn(false)
    await settle()
    submitRecoverPasswordDeviceSelect(promptId, deviceID)

    await expect(answered).resolves.toEqual({result: deviceID})
    held[0]!.reply(undefined)
    await settle()
  })

  test('an account switch refuses a pending prompt and shows no error', async () => {
    const {sessionID} = await start()
    const {answered} = await pushDevices(sessionID)
    nav.clearActions()

    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    await settle()

    await expect(answered).resolves.toEqual({error: inputCanceled})
    expect(nav.navigations()).toEqual([])
  })
})
