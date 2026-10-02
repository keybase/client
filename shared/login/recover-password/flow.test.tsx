/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import logger from '@/logger'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'

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
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const deviceID = T.Devices.stringToDeviceID('device-1')
const devices = [{deviceID: 'device-1', deviceNumberOfType: 1, name: 'phone', type: 'mobile'}]
// clearModals only has something to dispatch when a modal is on screen. Nothing below replaces onto
// this name: a replace onto the visible route collapses into a setParams.
const openModal = 'proxySettingsModal'

let nav: FakeNavigator
let fake: FakeEngine

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
      params: {devices: [expect.objectContaining({id: deviceID, name: 'phone', type: 'mobile'})], promptId},
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
      params: {promptId, username: 'testuser'},
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
    params: {deviceName: 'testuser-mac', deviceType: T.RPCGen.DeviceType.mobile, username: 'testuser'},
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

  const failWith = async (held: Awaited<ReturnType<typeof start>>['held']) => {
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
    await settle()
  }

  const errorModal = 'recoverPasswordErrorModal'
  const loggedInModals = [errorModal, 'recoverPasswordPgpWarning', 'recoverPasswordSetPassword', openModal]
  // The logged-out root with these screens pushed over login
  const loggedOutWith = (names: ReadonlyArray<string>, commit?: 'manual') => {
    nav = installFakeNavigator({commit, rootState: makeRootState({loggedIn: false})})
    for (const name of names) {
      nav.navigateAppend({name, params: {}} as never)
      nav.commit()
    }
    nav.clearActions()
  }
  const loggedInWith = (above: ReadonlyArray<string>) => {
    nav = installFakeNavigator({
      modalRouteNames: loggedInModals,
      rootState: makeRootState({above: above.map(name => ({name, params: {}}))}),
    })
  }
  const errorAt = (name: string, replace: boolean) => [
    {name, params: {error: expect.stringContaining('bad things')}, replace},
  ]

  test.each([
    'password',
    'recoverPasswordDeviceSelector',
    'recoverPasswordExplainDevice',
    'recoverPasswordPaperKey',
    'recoverPasswordPromptResetAccount',
    'recoverPasswordPromptResetPassword',
    'recoverPasswordError',
  ])('a failure while logged out takes the place of %s on top, and Back returns to login', async name => {
    loggedOutWith([name])
    const {held} = await start()
    await failWith(held)

    expect(nav.navigations()).toEqual(errorAt('recoverPasswordError', true))
    expect(screens()).toEqual(['login', 'recoverPasswordError'])
    nav.popStack()
    expect(screens()).toEqual(['login'])
  })

  test.each(['recoverPasswordSetPassword', 'recoverPasswordPgpWarning', errorModal, openModal])(
    'a failure while logged in takes the place of %s on top, and Back returns to the app',
    async name => {
      loggedInWith([name])
      const {held} = await start()
      await failWith(held)

      expect(nav.navigations()).toEqual(errorAt(errorModal, true))
      expect(screens()).toEqual(['loggedIn', errorModal])
      nav.navigateUp()
      expect(screens()).toEqual(['loggedIn'])
    }
  )

  test('a failure while logged in over a screen pushed above the tab bar goes over it, and Back returns to it', async () => {
    loggedInWith(['chatConversation'])
    const {held} = await start()
    await failWith(held)

    expect(nav.navigations()).toEqual(errorAt(errorModal, false))
    expect(screens()).toEqual(['loggedIn', 'chatConversation', errorModal])
    nav.navigateUp()
    expect(screens()).toEqual(['loggedIn', 'chatConversation'])
  })

  test('a failure while logged out with only login goes over it, and Back returns to login', async () => {
    loggedOutWith([])
    const {held} = await start()
    await failWith(held)

    expect(nav.navigations()).toEqual(errorAt('recoverPasswordError', false))
    expect(screens()).toEqual(['login', 'recoverPasswordError'])
    nav.popStack()
    expect(screens()).toEqual(['login'])
  })

  test('a failure while logged in with nothing over the app goes over it, and Back returns to the app', async () => {
    loggedInWith([])
    const {held} = await start()
    await failWith(held)

    expect(nav.navigations()).toEqual(errorAt(errorModal, false))
    expect(screens()).toEqual(['loggedIn', errorModal])
    nav.navigateUp()
    expect(screens()).toEqual(['loggedIn'])
  })

  test('a failure just after the paper key logged in, before the logged-in root mounts, goes on the logged-out root', async () => {
    loggedOutWith(['recoverPasswordPaperKey'])
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {held} = await start()
    await failWith(held)

    expect(nav.navigations()).toEqual(errorAt('recoverPasswordError', true))
    expect(screens()).toEqual(['login', 'recoverPasswordError'])
  })

  test("a failure right after a run screen's push, before it commits, takes that screen's place", async () => {
    loggedOutWith([], 'manual')
    const {held, sessionID} = await start()
    void fake.push(chooseDevice, {devices, username: 'testuser'}, {sessionID})
    await settle()
    await failWith(held)
    expect(screens()).toEqual(['login'])

    nav.commit()

    expect(nav.navigations().map(n => [n.name, n.replace])).toEqual([
      ['recoverPasswordDeviceSelector', false],
      ['recoverPasswordError', true],
    ])
    expect(screens()).toEqual(['login', 'recoverPasswordError'])
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
