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
  submitRecoverPasswordPgpContinue,
} from './flow'
import {newModalRoutes} from '../routes'
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
  // Go asks only after the paper key has logged the user in, so the warning is pushed over the
  // logged-in app, and only the real modal routes are modals.
  beforeEach(() => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    nav = installFakeNavigator({modalRouteNames: Object.keys(newModalRoutes), rootState: makeRootState()})
  })

  const rootRouteNames = () => nav.getRootState()?.routes?.map(r => r.name)

  const prompt = (first: Awaited<ReturnType<typeof startAttempt>>['first']) => {
    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
      {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
      response as any
    )
    return response
  }

  test('shows the warning as a modal and continues when the user agrees', async () => {
    const {first} = await startAttempt()
    const response = prompt(first)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
    submitRecoverPasswordPgpContinue()
    expect(nav.modalsCleared()).toBe(false)
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(true)
  })

  test('the set-password screen after continuing takes the warning\'s place', async () => {
    const {first} = await startAttempt()
    prompt(first)
    submitRecoverPasswordPgpContinue()
    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordSetPassword'])
  })

  test('declining answers false once and removes the warning', async () => {
    const {first} = await startAttempt()
    const response = prompt(first)
    cancelRecoverPassword()
    cancelRecoverPassword()
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(response.error).not.toHaveBeenCalled()
    expect(rootRouteNames()).toEqual(['loggedIn'])
  })

  test('restarting while the prompt is pending answers false once', async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    const response = prompt(attempts[0]!)
    startRecoverPassword({username: 'testuser'})
    await flush()
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    submitRecoverPasswordPgpContinue()
    expect(response.result).toHaveBeenCalledTimes(1)
  })

  test('a run that ends while the prompt is pending leaves nothing for a restart to answer', async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    const response = prompt(attempts[0]!)
    attempts[0]!.reject(new RPCError('EOF', T.RPCGen.StatusCode.scgeneric))
    await flush()
    startRecoverPassword({username: 'testuser'})
    await flush()
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  test.each([
    ['is cancelled', new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled)],
    ['drops', new RPCError('EOF', T.RPCGen.StatusCode.scgeneric)],
  ])('a run that %s with the prompt unanswered closes the warning', async (_label, error) => {
    const {first} = await startAttempt()
    prompt(first)
    first.reject(error)
    await flush()
    expect(rootRouteNames()).not.toContain('recoverPasswordPgpWarning')
  })

  test('closing a dead warning leaves a modal opened over it in place', async () => {
    const {first} = await startAttempt()
    prompt(first)
    nav.setRootState(
      makeRootState({above: [{name: 'recoverPasswordPgpWarning'}, {name: 'proxySettingsModal'}]})
    )
    first.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled))
    await flush()
    expect(rootRouteNames()).toEqual(['loggedIn', 'proxySettingsModal'])
  })

  test('a run ending after Continue leaves the set-password screen alone', async () => {
    const {first} = await startAttempt()
    prompt(first)
    submitRecoverPasswordPgpContinue()
    first.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )
    nav.clearActions()
    first.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled))
    await flush()
    expect(nav.actions).toEqual([])
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordSetPassword'])
  })

  test('a run ending after declining dispatches nothing more', async () => {
    const {first} = await startAttempt()
    prompt(first)
    cancelRecoverPassword()
    nav.clearActions()
    first.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled))
    await flush()
    expect(nav.actions).toEqual([])
  })

  test("an old run ending late does not drop the newer run's pending prompt", async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    prompt(attempts[0]!)
    startRecoverPassword({username: 'testuser'})
    await flush()
    const second = prompt(attempts[1]!)
    attempts[0]!.reject(new RPCError('EOF', T.RPCGen.StatusCode.scgeneric))
    await flush()
    startRecoverPassword({username: 'testuser'})
    await flush()
    expect(second.result).toHaveBeenCalledTimes(1)
    expect(second.result).toHaveBeenCalledWith(false)
  })

  test("an old run ending late leaves the newer run's warning showing", async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    prompt(attempts[0]!)
    startRecoverPassword({username: 'testuser'})
    await flush()
    prompt(attempts[1]!)
    attempts[0]!.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled))
    await flush()
    expect(rootRouteNames()).toContain('recoverPasswordPgpWarning')
  })
})
