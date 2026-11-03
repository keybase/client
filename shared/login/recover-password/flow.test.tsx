/** @jest-environment jsdom */
/// <reference types="jest" />
import {setImmediate} from 'node:timers'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installNavigation, makeRootState, type InstalledNavigation} from '@/test/navigation'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {
  startRecoverPassword,
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordReset,
} from './flow'

let nav: InstalledNavigation

// The logged-out stack's screens, bottom to top.
const loggedOutStack = () => nav.getRootState()?.routes?.[0]?.state?.routes.map(r => r.name)

// Recovery starts from the login screen.
beforeEach(() => {
  nav = installNavigation({rootState: makeRootState({loggedIn: false})})
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

// What crosses to or from the service arrives a turn later (Electron IPC), then the flow's own timers run
const flush = async () => {
  await new Promise<void>(resolve => setImmediate(resolve))
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

const makeRpcDevice = (name: string, deviceID: string, type: 'mobile' | 'desktop' | 'backup') =>
  ({
    deviceID,
    deviceNumberOfType: 1,
    name,
    type,
  }) as any

test('startRecoverPassword exposes device selection handlers', async () => {
  let chooserResponse: {error: jest.Mock; result: jest.Mock} | undefined
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    chooserResponse = {error: jest.fn(), result: jest.fn()}
    const chooseDevice = listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']
    if (!chooseDevice) {
      throw new Error('chooseDeviceToRecoverWith handler missing')
    }
    chooseDevice(
      {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]} as any,
      chooserResponse as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    startRecoverPassword({username: 'alice'})
    await flush()

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordDeviceSelector'])
    expect(nav.visibleScreen()).toMatchObject({
      name: 'recoverPasswordDeviceSelector',
      params: {
        devices: [
          expect.objectContaining({
            id: T.Devices.stringToDeviceID('device-1'),
            name: 'phone',
            type: 'mobile',
          }),
        ],
      },
    })

    submitRecoverPasswordDeviceSelect(T.Devices.stringToDeviceID('device-1'))
    submitRecoverPasswordDeviceSelect(T.Devices.stringToDeviceID('device-1'))

    expect(chooserResponse?.result).toHaveBeenCalledTimes(1)
    expect(chooserResponse?.result).toHaveBeenCalledWith(T.Devices.stringToDeviceID('device-1'))
  } finally {
    finishListener()
    await flush()
  }
})

test('resetAllStores clears pending recover-password handlers', async () => {
  let chooserResponse: {error: jest.Mock; result: jest.Mock} | undefined
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    chooserResponse = {error: jest.fn(), result: jest.fn()}
    const chooseDevice = listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']
    if (!chooseDevice) {
      throw new Error('chooseDeviceToRecoverWith handler missing')
    }
    chooseDevice(
      {devices: [makeRpcDevice('tablet', 'device-2', 'desktop')]} as any,
      chooserResponse as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    startRecoverPassword({username: 'alice'})
    await flush()

    resetAllStores()
    submitRecoverPasswordDeviceSelect(T.Devices.stringToDeviceID('device-2'))

    expect(chooserResponse?.result).not.toHaveBeenCalled()
  } finally {
    finishListener()
    await flush()
  }
})

test('reset-password prompt resolves callback and local banner handler', async () => {
  let promptResponse: {result: jest.Mock} | undefined
  let finishListener = () => {}
  const onResetEmailSent = jest.fn()

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    promptResponse = {result: jest.fn()}
    const promptReset = listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']
    if (!promptReset) {
      throw new Error('promptResetAccount handler missing')
    }
    promptReset(
      {prompt: {t: T.RPCGen.ResetPromptType.enterResetPw}} as any,
      promptResponse as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    startRecoverPassword({onResetEmailSent, username: 'alice'})
    await flush()

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordPromptResetPassword'])
    expect(nav.visibleScreen()).toMatchObject({
      name: 'recoverPasswordPromptResetPassword',
      params: {username: 'alice'},
    })

    submitRecoverPasswordReset(T.RPCGen.ResetPromptResponse.confirmReset)
    submitRecoverPasswordReset(T.RPCGen.ResetPromptResponse.confirmReset)

    expect(promptResponse?.result).toHaveBeenCalledTimes(1)
    expect(promptResponse?.result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.confirmReset)
    expect(onResetEmailSent).toHaveBeenCalledTimes(1)
    expect(nav.types().filter(t => t === 'GO_BACK')).toHaveLength(1)
    expect(loggedOutStack()).toEqual(['login'])
  } finally {
    finishListener()
    await flush()
  }
})

describe('through the engine listener', () => {
  const failRecovery = async (code: T.RPCGen.StatusCode, desc: string) => {
    const fake = installFakeEngine()
    const held = fake.hold('keybase.1.login.recoverPassphrase')
    startRecoverPassword({username: 'testuser'})
    await flush()
    held[0]!.reply(fakeError(code, desc))
    await flush()
  }

  // Logged out, recovery runs from a screen of the logged-out stack above login.
  const startLoggedOut = () => {
    nav = installNavigation({
      rootState: makeRootState({above: [{name: 'recoverPasswordExplainDevice'}], loggedIn: false}),
    })
  }

  // Logged in, recovery runs from a modal, which an error replaces and nothing else clears.
  const startLoggedIn = () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    nav = installNavigation({rootState: makeRootState({above: [{name: 'recoverPasswordSetPassword'}]})})
  }
  const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)

  test('a service error replaces the screen with the recovery error', async () => {
    startLoggedOut()
    await failRecovery(T.RPCGen.StatusCode.scnotfound, 'no such user')

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordError'])
    expect((nav.visibleScreen()?.params as {error: string}).error).toContain('no such user')
  })

  test('logged in, a service error replaces the modal with the error modal and leaves it up', async () => {
    startLoggedIn()
    await failRecovery(T.RPCGen.StatusCode.scnotfound, 'no such user')

    expect(rootNames()).toEqual(['loggedIn', 'recoverPasswordErrorModal'])
    expect((nav.visibleScreen()?.params as {error: string}).error).toContain('no such user')
  })

  test('a cancelled recovery shows no error and leaves the screens where they were', async () => {
    startLoggedOut()
    await failRecovery(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled')

    expect(loggedOutStack()).toEqual(['login', 'recoverPasswordExplainDevice'])
  })

  test('logged in, a cancelled recovery shows no error and leaves the modals', async () => {
    startLoggedIn()
    await failRecovery(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled')

    expect(rootNames()).toEqual(['loggedIn', 'recoverPasswordSetPassword'])
  })
})
