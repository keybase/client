/** @jest-environment jsdom */
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
  submitRecoverPasswordPgpWarning,
} from './flow'
import {installNavigation, makeRootState, renders, type MountedNavigation} from '@/test/navigation'

let nav: MountedNavigation

// Logged out, recovery starts from a screen of the logged-out stack above login. Nothing below
// replaces onto this name - a replace onto the visible route collapses into a setParams instead.
const openScreen = 'recoverPasswordPromptResetPassword'

// The logged-out stack's screens, bottom to top.
const loggedOutStack = () => nav.getRootState()?.routes?.[0]?.state?.routes.map(r => r.name)
const rootRouteNames = () => nav.getRootState()?.routes?.map(r => r.name)

beforeEach(() => {
  // The flow navigates from its own async work, as in the app, not from inside act(); test/flush
  // pulls in testing-library, which would otherwise make this an act environment.
  ;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = false
  nav = installNavigation({rootState: makeRootState({above: [{name: openScreen}], loggedIn: false})})
})

afterEach(async () => {
  // The navigator holds a push as in flight until the 'state' event after its commit, and drops an
  // identical push inside that window; let the commit land before the next test pushes the same screen.
  await renders(5)
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setTimeout(resolve, 0))

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

const askPaperKey = (attempt: {listener: Listener}) => {
  const response = {error: jest.fn(), result: jest.fn()}
  attempt.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
    {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.paperKey}} as any,
    response as any
  )
  return response
}

const askPgp = (attempt: {listener: Listener}) => {
  const response = {error: jest.fn(), result: jest.fn()}
  attempt.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
    {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
    response as any
  )
  return response
}

const askNewPassword = (attempt: {listener: Listener}, retryLabel = '') => {
  const response = {error: jest.fn(), result: jest.fn()}
  attempt.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
    {pinentry: {retryLabel, type: T.RPCGen.PassphraseType.passPhrase}} as any,
    response as any
  )
  return response
}

const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}

describe('device selection', () => {
  test('cancelling the chooser rejects the rpc and pops the screen', async () => {
    const {first} = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']?.(
      {devices: []} as any,
      response as any
    )

    cancelRecoverPassword()

    expect(response.error).toHaveBeenCalledWith(inputCanceled)
    expect(nav.types()).toContain('GO_BACK')
    expect(loggedOutStack()).toEqual(['login', openScreen])
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
    expect(response.error).toHaveBeenCalledWith(inputCanceled)
  })

  test('the device selector replaces the current route when asked to', async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({replaceRoute: true, username: 'testuser'})
    await flush()

    attempts[0]!.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']?.(
      {devices: []} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordDeviceSelector'])
    expect(nav.visibleScreen()?.params).toEqual({devices: []})
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

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordPaperKey'])
    expect(nav.visibleScreen()?.params).toEqual({error: 'nope'})

    submitRecoverPasswordPaperKey('one two three')

    expect(response.result).toHaveBeenCalledWith({passphrase: 'one two three', storeSecret: false})
  })

  test('an empty retry label shows no error', async () => {
    const {first} = await startAttempt()
    askPaperKey(first)

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordPaperKey'])
    expect(nav.visibleScreen()?.params).toEqual({error: undefined})
  })

  test('backing out of the paper key prompt restarts recovery from the top', async () => {
    const {attempts, first} = await startAttempt()
    const response = askPaperKey(first)

    cancelRecoverPassword()
    await flush()

    expect(response.error).toHaveBeenCalledWith(inputCanceled)
    expect(attempts.length).toBe(2)
  })
})

// Go asks about pgp keys and for a new password once the paper key has logged it in, holding back
// its login notification, so both stay in the logged-out stack, each in place of the screen before it.
describe('after the paper key', () => {
  const pastPaperKey = async () => {
    const started = await startAttempt()
    askPaperKey(started.first)
    submitRecoverPasswordPaperKey('one two three')
    return started
  }

  test('the pgp warning replaces the paper key screen while logged out; Continue answers true once', async () => {
    const {first} = await pastPaperKey()
    const response = askPgp(first)

    expect(rootRouteNames()).toEqual(['loggedOut'])
    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordPgpWarning'])

    submitRecoverPasswordPgpWarning()
    submitRecoverPasswordPgpWarning()
    cancelRecoverPassword()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(true)
  })

  test('cancelling the pgp warning answers false without restarting', async () => {
    const {attempts, first} = await pastPaperKey()
    const response = askPgp(first)

    cancelRecoverPassword()
    submitRecoverPasswordPgpWarning()
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(response.error).not.toHaveBeenCalled()
    expect(attempts.length).toBe(1)
  })

  test('the new password replaces the pgp warning and submits the password', async () => {
    const {first} = await pastPaperKey()
    askPgp(first)
    submitRecoverPasswordPgpWarning()

    const response = askNewPassword(first)

    expect(rootRouteNames()).toEqual(['loggedOut'])
    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordSetPassword'])
    expect(nav.visibleScreen()?.params).toEqual({error: undefined})

    submitRecoverPasswordPassword('hunter2hunter2')

    expect(response.result).toHaveBeenCalledWith({passphrase: 'hunter2hunter2', storeSecret: true})
  })

  test('without pgp keys, the new password replaces the paper key screen', async () => {
    const {first} = await pastPaperKey()
    askNewPassword(first)

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordSetPassword'])
  })

  test('a rejected password shows its error in place', async () => {
    const {first} = await pastPaperKey()
    askNewPassword(first)

    askNewPassword(first, 'too short')

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordSetPassword'])
    expect(nav.visibleScreen()?.params).toEqual({error: 'too short'})
  })

  test('a pgp prompt that reaches the flow after its run ended shows nothing', async () => {
    const {first} = await pastPaperKey()
    first.reject(new RPCError('Canceling RPC', T.RPCGen.StatusCode.sccanceled))
    await flush()
    nav.clearActions()

    const response = askPgp(first)
    submitRecoverPasswordPgpWarning()

    expect(nav.actions).toEqual([])
    expect(response.result).not.toHaveBeenCalled()
  })
})

test('a device-recovery explanation replaces the current screen', async () => {
  const {first} = await startAttempt()

  first.listener.incomingCallMap['keybase.1.loginUi.explainDeviceRecovery']?.(
    {kind: T.RPCGen.DeviceType.mobile, name: 'testuser-mac'} as any
  )

  expect(loggedOutStack()).toEqual(['login', 'recoverPasswordExplainDevice'])
  expect(nav.visibleScreen()?.params).toEqual({
    deviceName: 'testuser-mac',
    deviceType: T.RPCGen.DeviceType.mobile,
    username: 'testuser',
  })

  // Go ends the run here: the explanation is what the user acts on, so it stays.
  first.resolve()
  await flush()
  await renders(2)
  expect(loggedOutStack()).toEqual(['login', 'recoverPasswordExplainDevice'])
  expect(useConfigState.getState().recoverPasswordHold).toBe(0)
})

test('a reset prompt that is not a password reset hands off to the account reset flow', async () => {
  const {first} = await startAttempt()

  const response = {result: jest.fn()}
  first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
    {prompt: {t: T.RPCGen.ResetPromptType.enterNoDevices}} as any,
    response as any
  )

  expect(loggedOutStack()).toEqual(['login', 'recoverPasswordPromptResetAccount'])
  expect(nav.visibleScreen()?.params).toEqual({skipPassword: true, username: 'testuser'})
  expect(response.result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.nothing)
})

describe('completion', () => {
  test('a cancelled recovery shows no error screen', async () => {
    const {first} = await startAttempt()

    first.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.scinputcanceled))
    await flush()

    expect(loggedOutStack()).toEqual(['login', openScreen])
  })

  // Its prompts are only in the logged-out screens, and Go would refuse it anyway.
  test('a start while logged in shows the error as a modal and runs nothing', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    nav = installNavigation({rootState: makeRootState()})
    const attempts = mockRecoverAttempts()
    startRecoverPassword({abortProvisioning: true, username: 'testuser'})
    await flush()

    expect(attempts).toEqual([])
    expect(useConfigState.getState().recoverPasswordHold).toBe(0)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
    expect(nav.visibleScreen()?.params).toEqual({
      error: 'You are already logged in as a different user; try logout first',
    })
  })

  test('handlers stop responding once the run is over', async () => {
    const {first} = await startAttempt()
    const response = askNewPassword(first)

    first.resolve()
    await flush()

    submitRecoverPasswordPassword('hunter2hunter2')
    cancelRecoverPassword()

    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })
})
