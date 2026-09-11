/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {RPCError} from '@/util/errors'

import {
  cancelRecoverPassword,
  startRecoverPassword,
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordNoDevice,
  submitRecoverPasswordPaperKey,
  submitRecoverPasswordPassword,
} from './flow'
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
