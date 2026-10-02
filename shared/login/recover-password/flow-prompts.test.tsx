/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {RPCError} from '@/util/errors'

import {
  cancelRecoverPassword,
  getRecoverPasswordPgpPrompt,
  startRecoverPassword,
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordNoDevice,
  submitRecoverPasswordPaperKey,
  submitRecoverPasswordPassword,
} from './flow'
import {newModalRoutes} from '../routes'
import {navigateAppend} from '@/constants/router'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'

let nav: FakeNavigator

// Recovery runs from a modal, so the fake starts with one open: clearModals only has
// something to dispatch when a modal is actually on screen. Nothing below replaces onto
// this name - a replace onto the visible route collapses into a setParams instead.
const openModal = 'recoverPasswordPromptResetPassword'

beforeEach(() => {
  nav = installFakeNavigator({
    modalRouteNames: [openModal],
    rootState: makeRootState({above: [{name: openModal}]}),
  })
})

afterEach(() => {
  restoreNavigator()
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

type Listener = Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0]

// Each recover call hangs until the test settles it, like the real RPC waiting on prompts.
const mockRecoverAttempts = () => {
  const attempts: Array<{
    listener: Listener
    reject: (e: unknown) => void
    resolve: () => void
  }> = []
  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    await new Promise<void>((resolve, reject) => {
      attempts.push({listener, reject, resolve})
    })
    return undefined as any
  })
  return attempts
}

const startAttempt = async () => {
  const attempts = mockRecoverAttempts()
  startRecoverPassword({username: 'testuser'})
  await flush()
  expect(attempts.length).toBe(1)
  return {attempts, first: attempts[0]!}
}

describe('device selection', () => {
  test('cancelling the chooser rejects the rpc and pops the screen', async () => {
    const {first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']?.(
      {devices: []} as any,
      response as any
    )

    cancelRecoverPassword()

    expect(response.error).toHaveBeenCalledWith({
      code: T.RPCGen.StatusCode.scinputcanceled,
      desc: 'Input canceled',
    })
    expect(nav.types()).toContain('GO_BACK')
  })

  test('selecting no device answers with an empty device id', async () => {
    const {first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']?.(
      {devices: []} as any,
      response as any
    )

    submitRecoverPasswordNoDevice()

    expect(response.result).toHaveBeenCalledWith('')
    expect(response.error).not.toHaveBeenCalled()
  })

  test('an empty device id from the selector is treated as a cancel', async () => {
    const {first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']?.(
      {devices: []} as any,
      response as any
    )

    submitRecoverPasswordDeviceSelect(undefined)

    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).toHaveBeenCalledWith({
      code: T.RPCGen.StatusCode.scinputcanceled,
      desc: 'Input canceled',
    })
  })

  test('the device selector replaces the current route when asked to', async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({replaceRoute: true, username: 'testuser'})
    await flush()

    attempts[0]!.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']?.(
      {devices: []} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordDeviceSelector',
      params: {devices: []},
      replace: true,
    })
  })
})

describe('paper key prompt', () => {
  test('a paper key prompt navigates with the retry label and submits the passphrase', async () => {
    const {first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: 'nope', type: T.RPCGen.PassphraseType.paperKey}} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordPaperKey',
      params: {error: 'nope'},
      replace: true,
    })

    submitRecoverPasswordPaperKey('one two three')

    expect(response.result).toHaveBeenCalledWith({passphrase: 'one two three', storeSecret: false})
  })

  test('an empty retry label shows no error', async () => {
    const {first} = await startAttempt()

    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.paperKey}} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordPaperKey',
      params: {error: undefined},
      replace: true,
    })
  })

  test('backing out of the paper key prompt restarts recovery from the top', async () => {
    const {attempts, first} = await startAttempt()

    const response = {
      error: jest.fn(),
      result: jest.fn(),
    }
    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.paperKey}} as any,
      response as any
    )

    cancelRecoverPassword()
    await flush()

    expect(response.error).toHaveBeenCalledWith({
      code: T.RPCGen.StatusCode.scinputcanceled,
      desc: 'Input canceled',
    })
    expect(attempts.length).toBe(2)
  })
})

describe('new password prompt', () => {
  test('the first ask pushes the set-password screen', async () => {
    const {first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordSetPassword',
      params: {error: undefined},
      replace: false,
    })

    submitRecoverPasswordPassword('hunter2hunter2')

    expect(response.result).toHaveBeenCalledWith({passphrase: 'hunter2hunter2', storeSecret: true})
  })

  test('a rejected password replaces the screen with the error', async () => {
    const {first} = await startAttempt()

    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: 'too short', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordSetPassword',
      params: {error: 'too short'},
      replace: true,
    })
  })

  test('cancelling the new password prompt rejects the rpc without restarting', async () => {
    const {attempts, first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )

    cancelRecoverPassword()
    await flush()

    expect(response.error).toHaveBeenCalled()
    expect(attempts.length).toBe(1)
  })
})

test('a device-recovery explanation replaces the current screen', async () => {
  const {first} = await startAttempt()

  first.listener.incomingCallMap['keybase.1.loginUi.explainDeviceRecovery']?.(
    {kind: T.RPCGen.DeviceType.mobile, name: 'testuser-mac'} as any
  )

  expect(nav.navigations()).toContainEqual({
    name: 'recoverPasswordExplainDevice',
    params: {deviceName: 'testuser-mac', deviceType: T.RPCGen.DeviceType.mobile, username: 'testuser'},
    replace: true,
  })
})

test('a reset prompt that is not a password reset hands off to the account reset flow', async () => {
  const {first} = await startAttempt()

  const response = {result: jest.fn()}
  first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
    {prompt: {t: T.RPCGen.ResetPromptType.enterNoDevices}} as any,
    response as any
  )

  expect(nav.navigations()).toContainEqual({
    name: 'recoverPasswordPromptResetAccount',
    params: {skipPassword: true, username: 'testuser'},
    replace: true,
  })
  expect(response.result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.nothing)
})

describe('completion', () => {
  test('a successful recovery clears the modals', async () => {
    const {first} = await startAttempt()

    first.resolve()
    await flush()

    expect(nav.modalsCleared()).toBe(true)
  })

  test('a cancelled recovery shows no error screen and leaves modals alone', async () => {
    const {first} = await startAttempt()

    first.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.scinputcanceled))
    await flush()

    expect(nav.modalsCleared()).toBe(false)
    expect(nav.navigations()).not.toContainEqual(
      expect.objectContaining({name: 'recoverPasswordError', replace: true})
    )
  })

  test('a failure while logged out shows the error screen', async () => {
    const {first} = await startAttempt()

    const error = new RPCError('bad things', T.RPCGen.StatusCode.scgeneric)
    first.reject(error)
    await flush()

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordError',
      params: {error: error.message},
      replace: true,
    })
    expect(nav.modalsCleared()).toBe(false)
  })

  test('a failure while logged in shows the error as a modal', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {first} = await startAttempt()

    const error = new RPCError('bad things', T.RPCGen.StatusCode.scgeneric)
    first.reject(error)
    await flush()

    expect(nav.navigations()).toContainEqual({
      name: 'recoverPasswordErrorModal',
      params: {error: error.message},
      replace: true,
    })
  })

  test('handlers stop responding once the run is over', async () => {
    const {first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )

    first.resolve()
    await flush()

    submitRecoverPasswordPassword('hunter2hunter2')

    expect(response.result).not.toHaveBeenCalled()
  })
})

describe('pgp key warning', () => {
  // Go asks only after the paper key has logged the user in, so the warning is a modal over the app.
  beforeEach(() => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    nav = installFakeNavigator({modalRouteNames: Object.keys(newModalRoutes), rootState: makeRootState()})
  })

  const rootRouteNames = () => nav.getRootState()?.routes?.map(r => r.name)

  const prompt = (attempt: {listener: Listener}) => {
    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
      {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
      response as any
    )
    return response
  }

  test('a prompt shows the warning as a modal over the logged-in app', async () => {
    const {first} = await startAttempt()
    prompt(first)

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
    expect(getRecoverPasswordPgpPrompt()).toBeDefined()
  })

  test('a prompt before the logged-in root mounts shows the warning once it does', async () => {
    nav = installFakeNavigator({
      modalRouteNames: Object.keys(newModalRoutes),
      rootState: makeRootState({loggedIn: false}),
    })
    const {first} = await startAttempt()
    prompt(first)
    expect(nav.pushes()).toEqual([])

    nav.setRootState(makeRootState())

    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
  })

  test('the answer is given once: Continue answers true and later answers are ignored', async () => {
    const {first} = await startAttempt()
    const response = prompt(first)
    const pending = getRecoverPasswordPgpPrompt()

    pending?.respond(true)
    pending?.respond(true)
    pending?.respond(false)

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(true)
    expect(getRecoverPasswordPgpPrompt()).toBeUndefined()
  })

  test('a restart answers a pending prompt false once and takes its warning off the top', async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    const response = prompt(attempts[0]!)
    const pending = getRecoverPasswordPgpPrompt()

    startRecoverPassword({username: 'testuser'})
    await flush()
    pending?.respond(true)
    attempts[0]!.reject(new RPCError('Canceling RPC', T.RPCGen.StatusCode.sccanceled))
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(rootRouteNames()).toEqual(['loggedIn'])
  })

  test('a run ending answers a pending prompt false once and takes its warning off the top', async () => {
    const {first} = await startAttempt()
    const response = prompt(first)
    const pending = getRecoverPasswordPgpPrompt()

    first.reject(new RPCError('Canceling RPC', T.RPCGen.StatusCode.sccanceled))
    await flush()
    pending?.respond(true)

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(rootRouteNames()).toEqual(['loggedIn'])
  })

  test('a run ending with the warning under another modal answers false and leaves both', async () => {
    const {first} = await startAttempt()
    const response = prompt(first)
    navigateAppend({name: 'proxySettingsModal', params: {}})

    first.reject(new RPCError('Canceling RPC', T.RPCGen.StatusCode.sccanceled))
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
  })

  test('a run failing with the warning on top answers false once and shows the error in its place', async () => {
    const {first} = await startAttempt()
    const response = prompt(first)

    first.reject(new RPCError('bad things', T.RPCGen.StatusCode.scgeneric))
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
  })

  test('a run ending after the prompt was answered answers nothing more', async () => {
    const {first} = await startAttempt()
    const response = prompt(first)
    getRecoverPasswordPgpPrompt()?.respond(false)

    first.reject(new RPCError('Canceling RPC', T.RPCGen.StatusCode.sccanceled))
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
  })
})
