/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {RPCError} from '@/util/errors'

import {
  answerRecoverPasswordPgp,
  cancelRecoverPassword,
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

  // Logged in, the flow's only screens are its own modals over the app.
  describe('while logged in', () => {
    beforeEach(() => {
      useConfigState.getState().dispatch.setLoggedIn(true)
    })

    test('a failure shows the error as a modal in place of the set-password screen', async () => {
      nav = installFakeNavigator({
        modalRouteNames: Object.keys(newModalRoutes),
        rootState: makeRootState({above: [{name: 'recoverPasswordSetPassword'}]}),
      })
      const {first} = await startAttempt()

      const error = new RPCError('bad things', T.RPCGen.StatusCode.scgeneric)
      first.reject(error)
      await flush()

      expect(nav.navigations()).toContainEqual({
        name: 'recoverPasswordErrorModal',
        params: {error: error.message},
        replace: false,
      })
      expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
    })

    test('a failure with a modal over the set-password screen keeps both and puts the error on top', async () => {
      nav = installFakeNavigator({
        modalRouteNames: Object.keys(newModalRoutes),
        rootState: makeRootState({above: [{name: 'recoverPasswordSetPassword'}, {name: 'proxySettingsModal'}]}),
      })
      const {first} = await startAttempt()

      first.reject(new RPCError('bad things', T.RPCGen.StatusCode.scgeneric))
      await flush()

      expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual([
        'loggedIn',
        'recoverPasswordSetPassword',
        'proxySettingsModal',
        'recoverPasswordErrorModal',
      ])
    })

    // The navigator commits after the flow's last dispatch, so the decision can't come from reading the tree
    // after the warnings' removal.
    test('a failure with a warning over set-password decides before the warning is removed', async () => {
      nav = installFakeNavigator({
        commit: 'manual',
        modalRouteNames: Object.keys(newModalRoutes),
        rootState: makeRootState({above: [{name: 'recoverPasswordSetPassword'}]}),
      })
      const {first} = await startAttempt()
      const response = {error: jest.fn(), result: jest.fn()}
      first.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
        {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
        response as any
      )
      nav.commit()
      expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual([
        'loggedIn',
        'recoverPasswordSetPassword',
        'recoverPasswordPgpWarning',
      ])

      first.reject(new RPCError('bad things', T.RPCGen.StatusCode.scgeneric))
      await flush()
      nav.commit()

      expect(response.result).toHaveBeenCalledTimes(1)
      expect(response.result).toHaveBeenCalledWith(false)
      expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
    })

    test('a failure with no flow screen showing puts the error over what is there', async () => {
      nav = installFakeNavigator({
        modalRouteNames: Object.keys(newModalRoutes),
        rootState: makeRootState({above: [{name: 'proxySettingsModal'}]}),
      })
      const {first} = await startAttempt()

      first.reject(new RPCError('bad things', T.RPCGen.StatusCode.scgeneric))
      await flush()

      expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual([
        'loggedIn',
        'proxySettingsModal',
        'recoverPasswordErrorModal',
      ])
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

  const prompt = (attempt: {listener: Listener}) => {
    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
      {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
      response as any
    )
    // The id the warning on top was pushed with.
    const top = nav.getRootState()?.routes?.at(-1)
    expect(top?.name).toBe('recoverPasswordPgpWarning')
    const id = (top?.params as {pgpPromptID: number}).pgpPromptID
    return {id, response}
  }

  const askNewPassword = (attempt: {listener: Listener}) =>
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )

  test('Continue answers true once and closes only the warning; set-password is then pushed', async () => {
    const {first} = await startAttempt()
    const {id, response} = prompt(first)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])

    answerRecoverPasswordPgp(id, true)
    answerRecoverPasswordPgp(id, true)
    answerRecoverPasswordPgp(id, false)

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(true)
    expect(nav.modalsCleared()).toBe(false)
    expect(rootRouteNames()).toEqual(['loggedIn'])

    nav.clearActions()
    askNewPassword(first)
    expect(nav.types()).toEqual(['PUSH'])
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordSetPassword'])
  })

  test('declining answers false once and closes the warning', async () => {
    const {first} = await startAttempt()
    const {id, response} = prompt(first)

    answerRecoverPasswordPgp(id, false)
    answerRecoverPasswordPgp(id, false)
    answerRecoverPasswordPgp(id, true)

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(response.error).not.toHaveBeenCalled()
    expect(rootRouteNames()).toEqual(['loggedIn'])
  })

  test.each([
    ['declining', false],
    ['Continue', true],
  ])('%s a warning under another modal leaves both where they are and navigates nothing', async (_label, proceed) => {
    const {first} = await startAttempt()
    const {id, response} = prompt(first)
    navigateAppend({name: 'proxySettingsModal', params: {}})
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
    nav.clearActions()

    answerRecoverPasswordPgp(id, proceed)

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(proceed)
    // Removing a modal under another one aborts the app on iOS; the warning closes itself once uncovered.
    expect(nav.actions).toEqual([])
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])

    if (proceed) {
      askNewPassword(first)
      expect(rootRouteNames()).toEqual([
        'loggedIn',
        'recoverPasswordPgpWarning',
        'proxySettingsModal',
        'recoverPasswordSetPassword',
      ])
    }
  })

  test('answering closes the warning of that prompt and no other', async () => {
    const {first} = await startAttempt()
    const {id} = prompt(first)
    // Another prompt's warning on the stack too, under this one.
    nav.setRootState(
      makeRootState({
        above: [
          {name: 'recoverPasswordPgpWarning', params: {pgpPromptID: id + 100}},
          {name: 'recoverPasswordPgpWarning', params: {pgpPromptID: id}},
        ],
      })
    )

    answerRecoverPasswordPgp(id, false)

    expect(nav.getRootState()?.routes?.map(r => r.params)).toEqual([undefined, {pgpPromptID: id + 100}])
  })

  test("restarting answers the old prompt false, closes its warning, and the old screen can't reach the new one", async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    const old = prompt(attempts[0]!)

    startRecoverPassword({username: 'testuser'})
    await flush()
    expect(old.response.result).toHaveBeenCalledTimes(1)
    expect(old.response.result).toHaveBeenCalledWith(false)
    expect(rootRouteNames()).toEqual(['loggedIn'])

    // The new prompt gets its own screen, not the old one reused as a dupe.
    const next = prompt(attempts[1]!)
    expect(next.id).not.toBe(old.id)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])

    nav.clearActions()
    answerRecoverPasswordPgp(old.id, true)
    answerRecoverPasswordPgp(old.id, false)
    expect(old.response.result).toHaveBeenCalledTimes(1)
    expect(next.response.result).not.toHaveBeenCalled()
    expect(nav.actions).toEqual([])
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
  })

  test.each([
    ['is cancelled', new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled)],
    ['ends cleanly', undefined],
  ])('a run that %s with the prompt unanswered answers it false once and closes the warning', async (_l, error) => {
    const {first} = await startAttempt()
    const {id, response} = prompt(first)

    if (error) {
      first.reject(error)
    } else {
      first.resolve()
    }
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(rootRouteNames()).not.toContain('recoverPasswordPgpWarning')
    answerRecoverPasswordPgp(id, true)
    expect(response.result).toHaveBeenCalledTimes(1)
  })

  test('a run cancelled with its warning under another modal answers false and leaves the warning there', async () => {
    const {first} = await startAttempt()
    const {response} = prompt(first)
    navigateAppend({name: 'proxySettingsModal', params: {}})
    nav.clearActions()

    first.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled))
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(nav.actions).toEqual([])
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
  })

  test('a run that fails with its warning under another modal puts the error on top and leaves the rest', async () => {
    const {first} = await startAttempt()
    const {response} = prompt(first)
    navigateAppend({name: 'proxySettingsModal', params: {}})

    first.reject(new RPCError('EOF', T.RPCGen.StatusCode.scgeneric))
    await flush()

    expect(response.result).toHaveBeenCalledWith(false)
    expect(nav.types()).not.toContain('RESET')
    expect(rootRouteNames()).toEqual([
      'loggedIn',
      'recoverPasswordPgpWarning',
      'proxySettingsModal',
      'recoverPasswordErrorModal',
    ])
  })

  test("a restart leaves the old run's warning under another modal, and nothing can answer it", async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    const old = prompt(attempts[0]!)
    navigateAppend({name: 'proxySettingsModal', params: {}})
    nav.clearActions()

    startRecoverPassword({username: 'testuser'})
    await flush()

    expect(old.response.result).toHaveBeenCalledTimes(1)
    expect(old.response.result).toHaveBeenCalledWith(false)
    expect(nav.actions).toEqual([])
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
    answerRecoverPasswordPgp(old.id, true)
    expect(old.response.result).toHaveBeenCalledTimes(1)
  })

  test('a run that fails with the prompt unanswered answers once and keeps its error modal', async () => {
    const {first} = await startAttempt()
    const {response} = prompt(first)

    first.reject(new RPCError('EOF', T.RPCGen.StatusCode.scgeneric))
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    // The warning went first, so the error modal never replaced it or anything else.
    expect(nav.types()).not.toContain('REPLACE')
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordErrorModal'])

    // A restart after that has nothing left to answer, and leaves the error modal.
    startRecoverPassword({username: 'testuser'})
    await flush()
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
  })

  test.each([
    ['is cancelled', new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled)],
    ['fails', new RPCError('EOF', T.RPCGen.StatusCode.scgeneric)],
    ['ends cleanly', undefined],
  ])('a run that %s after Continue answers nothing more', async (_label, error) => {
    const {first} = await startAttempt()
    const {id, response} = prompt(first)
    answerRecoverPasswordPgp(id, true)
    expect(rootRouteNames()).toEqual(['loggedIn'])

    if (error) {
      first.reject(error)
    } else {
      first.resolve()
    }
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(true)
    // Only the failure has a screen to show, and it goes on top of the app.
    expect(nav.types()).not.toContain('REPLACE')
    expect(rootRouteNames()).toEqual(
      error?.code === T.RPCGen.StatusCode.scgeneric ? ['loggedIn', 'recoverPasswordErrorModal'] : ['loggedIn']
    )
  })

  test('a run that fails on the set-password screen after Continue shows the error in its place', async () => {
    const {first} = await startAttempt()
    const {id, response} = prompt(first)
    answerRecoverPasswordPgp(id, true)
    askNewPassword(first)

    first.reject(new RPCError('EOF', T.RPCGen.StatusCode.scgeneric))
    await flush()

    expect(response.result).toHaveBeenCalledTimes(1)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
  })

  test("an old run ending late leaves the newer run's prompt and warning alone", async () => {
    const attempts = mockRecoverAttempts()
    startRecoverPassword({username: 'testuser'})
    await flush()
    prompt(attempts[0]!)
    startRecoverPassword({username: 'testuser'})
    await flush()
    const next = prompt(attempts[1]!)

    attempts[0]!.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled))
    await flush()

    expect(next.response.result).not.toHaveBeenCalled()
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])

    startRecoverPassword({username: 'testuser'})
    await flush()
    expect(next.response.result).toHaveBeenCalledTimes(1)
    expect(next.response.result).toHaveBeenCalledWith(false)
  })

  describe('a superseded run', () => {
    test('answers a later prompt false at once and shows nothing', async () => {
      const attempts = mockRecoverAttempts()
      startRecoverPassword({username: 'testuser'})
      await flush()
      startRecoverPassword({username: 'testuser'})
      await flush()
      nav.clearActions()

      const response = {error: jest.fn(), result: jest.fn()}
      attempts[0]!.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
        {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
        response as any
      )

      expect(response.result).toHaveBeenCalledTimes(1)
      expect(response.result).toHaveBeenCalledWith(false)
      expect(nav.actions).toEqual([])
    })

    test.each([
      ['fails', new RPCError('EOF', T.RPCGen.StatusCode.scgeneric)],
      ['ends cleanly', undefined],
    ])('navigates nothing when it %s', async (_label, error) => {
      const attempts = mockRecoverAttempts()
      startRecoverPassword({username: 'testuser'})
      await flush()
      startRecoverPassword({username: 'testuser'})
      await flush()
      const next = prompt(attempts[1]!)
      navigateAppend({name: 'proxySettingsModal', params: {}})
      nav.clearActions()

      if (error) {
        attempts[0]!.reject(error)
      } else {
        attempts[0]!.resolve()
      }
      await flush()

      expect(nav.actions).toEqual([])
      expect(next.response.result).not.toHaveBeenCalled()
      expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
    })
  })

  // Go asks right after the paper key logs in; the app learns it is logged in a round trip later.
  describe('a prompt that arrives before the logged-in root', () => {
    beforeEach(() => {
      useConfigState.getState().dispatch.setLoggedIn(false)
      nav = installFakeNavigator({
        modalRouteNames: Object.keys(newModalRoutes),
        rootState: makeRootState({loggedIn: false}),
      })
    })

    const promptEarly = (attempt: {listener: Listener}) => {
      const response = {error: jest.fn(), result: jest.fn()}
      attempt.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
        {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
        response as any
      )
      return response
    }

    test('shows the warning once the logged-in root mounts, and it answers the prompt', async () => {
      const {first} = await startAttempt()
      const response = promptEarly(first)
      expect(nav.pushes()).toEqual([])

      useConfigState.getState().dispatch.setLoggedIn(true)
      nav.setRootState(makeRootState())

      const top = nav.getRootState()?.routes?.at(-1)
      expect(top?.name).toBe('recoverPasswordPgpWarning')
      expect(nav.pushes()).toHaveLength(1)
      const id = (top?.params as {pgpPromptID: number}).pgpPromptID
      expect(response.result).not.toHaveBeenCalled()
      answerRecoverPasswordPgp(id, true)
      expect(response.result).toHaveBeenCalledWith(true)
      expect(rootRouteNames()).toEqual(['loggedIn'])
    })

    test('a run that ends first declines it, and the logged-in root mounting shows nothing', async () => {
      const {first} = await startAttempt()
      const response = promptEarly(first)

      first.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.sccanceled))
      await flush()
      expect(response.result).toHaveBeenCalledTimes(1)
      expect(response.result).toHaveBeenCalledWith(false)

      nav.setRootState(makeRootState())
      expect(nav.pushes()).toEqual([])
    })

    test('a restart first declines it, and the logged-in root mounting shows nothing', async () => {
      const {attempts} = await startAttempt()
      const response = promptEarly(attempts[0]!)

      startRecoverPassword({username: 'testuser'})
      await flush()
      expect(response.result).toHaveBeenCalledWith(false)

      nav.setRootState(makeRootState())
      expect(nav.pushes()).toEqual([])
    })

    // Declining logs Go out, so a slow mount must not decline it: only the run, a restart, the user or a
    // logout does.
    test('a logged-in root that mounts late still shows the warning, and nothing is declined', async () => {
      const {first} = await startAttempt()
      jest.useFakeTimers()
      try {
        const response = promptEarly(first)
        jest.advanceTimersByTime(60_000)
        expect(response.result).not.toHaveBeenCalled()

        useConfigState.getState().dispatch.setLoggedIn(true)
        nav.setRootState(makeRootState())
        expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
        expect(response.result).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })

    // A logout then a recovery for another user remounts the navigation container under a new key, and the
    // old container's listeners go with it.
    test('a navigation container remounting with the logged-in root still shows the warning', async () => {
      const {first} = await startAttempt()
      const response = promptEarly(first)

      useConfigState.getState().dispatch.setLoggedIn(true)
      nav.remount(makeRootState())
      expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
      expect(response.result).not.toHaveBeenCalled()
    })
  })

  // Leaving the logged-in app unmounts the modals without a beforeRemove on the warning.
  describe('leaving the logged-in app', () => {
    test('a logout declines the pending prompt once', async () => {
      const {first} = await startAttempt()
      const {id, response} = prompt(first)

      useConfigState.getState().dispatch.setLoggedIn(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
      useConfigState.getState().dispatch.setLoggedIn(false)

      expect(response.result).toHaveBeenCalledTimes(1)
      expect(response.result).toHaveBeenCalledWith(false)
      answerRecoverPasswordPgp(id, true)
      expect(response.result).toHaveBeenCalledTimes(1)
    })

    // Declining makes Go log out, which could race the switched-to account's login. The switch's own logout
    // declines it.
    test('an account switch starting declines nothing', async () => {
      const {first} = await startAttempt()
      const {response} = prompt(first)

      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')

      expect(response.result).not.toHaveBeenCalled()
      expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
    })

    test('the run ending under a switch answers Go nothing but takes the warning away', async () => {
      const {first} = await startAttempt()
      const {id, response} = prompt(first)

      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
      first.reject(new RPCError('canceled', T.RPCGen.StatusCode.sccanceled))
      await flush()

      expect(response.result).not.toHaveBeenCalled()
      expect(rootRouteNames()).toEqual(['loggedIn'])
      answerRecoverPasswordPgp(id, false, 'screenRemoving')
      expect(response.result).not.toHaveBeenCalled()
    })

    test('after the run, a logout answers nothing', async () => {
      const {first} = await startAttempt()
      const {id, response} = prompt(first)
      answerRecoverPasswordPgp(id, true)
      first.resolve()
      await flush()

      useConfigState.getState().dispatch.setLoggedIn(false)
      expect(response.result).toHaveBeenCalledTimes(1)
    })
  })
})
