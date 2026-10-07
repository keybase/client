/// <reference types="jest" />
// Calls made while the app switches accounts wait for the switch to end, and calls that outlive an
// account never wait.
import * as T from '@/constants/types'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {installFakeNavigator, restoreNavigator} from '@/test/fake-navigator'
import {openDialog} from './dialog'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'
import {settle} from '@/test/flush'
import {testWaitingKey} from '@/test/waiting-key'
import logger from '@/logger'
import {RPCError} from '@/util/errors'

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  // The store reset keeps an in-progress switch, and a later test's switch would not start
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

const settings = 'keybase.1.user.loadMySettings'
const blocks = 'keybase.1.user.getUserBlocks'
const waitingKey = testWaitingKey('account-gate-test')
const byAccountChange = {reason: 'accountChange', type: 'cancelled'}
const byCaller = {reason: 'caller', type: 'cancelled'}

const methodsSent = (fake: FakeEngine) => fake.calls.map(c => c.method)
const count = (fake: FakeEngine) => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKey) ?? 0
}
const outcome = async (p: Promise<unknown>) =>
  p.then(
    r => ({r}),
    (e: unknown) => ({e})
  )

// A switch away from a logged-in account, as switchToAccount starts it
const startSwitch = () => {
  const {dispatch} = useConfigState.getState()
  dispatch.setLoggedIn(true)
  dispatch.setUserSwitching(true, 'testuser2')
}
const endSwitch = () => useConfigState.getState().dispatch.setUserSwitching(false)

describe('a call made during a switch', () => {
  test('K6: reaches the service only once the switch ends', async () => {
    const fake = installFakeEngine()
    fake.answer(settings, () => ({}))
    startSwitch()
    const p = T.RPCGen.userLoadMySettingsRpcPromise()
    await settle()
    expect(methodsSent(fake)).not.toContain(settings)
    endSwitch()
    await expect(p).resolves.toEqual({})
    uninstallFakeEngine()
  })

  test('shows waiting on its key while it waits, and until its reply', async () => {
    const fake = installFakeEngine()
    const held = fake.hold(blocks)
    startSwitch()
    const p = T.RPCGen.userGetUserBlocksRpcPromise({usernames: []}, waitingKey)
    await settle()
    expect(count(fake)).toBe(1)
    endSwitch()
    await settle()
    expect(count(fake)).toBe(1)
    held[0]!.reply([])
    await p
    expect(count(fake)).toBe(0)
    uninstallFakeEngine()
  })

  test('goes out in the order it was made', async () => {
    const fake = installFakeEngine()
    fake.answer(settings, () => ({}))
    fake.answer(blocks, () => [])
    startSwitch()
    const first = T.RPCGen.userGetUserBlocksRpcPromise({usernames: []})
    const second = T.RPCGen.userLoadMySettingsRpcPromise()
    endSwitch()
    await Promise.all([first, second])
    expect(methodsSent(fake)).toEqual([blocks, settings])
    uninstallFakeEngine()
  })

  test('that survives an account change goes out at once', async () => {
    const fake = installFakeEngine()
    fake.answer('keybase.1.login.getConfiguredAccounts', () => [])
    startSwitch()
    await expect(T.RPCGen.loginGetConfiguredAccountsRpcPromise()).resolves.toEqual([])
    uninstallFakeEngine()
  })

  test('from a listener waits too', async () => {
    const fake = installFakeEngine()
    fake.answer('keybase.1.device.deviceAdd', () => undefined)
    startSwitch()
    const p = T.RPCGen.deviceDeviceAddRpcListener({customResponseIncomingCallMap: {}, incomingCallMap: {}, params: undefined})
    await settle()
    expect(methodsSent(fake)).toEqual([])
    endSwitch()
    await expect(p).resolves.toBeUndefined()
    uninstallFakeEngine()
  })

  test('from a dialog waits too', async () => {
    const fake = installFakeEngine()
    fake.answer('keybase.1.pgp.pgpKeyGenDefault', () => undefined)
    startSwitch()
    const dialog = openDialog(
      'keybase.1.pgp.pgpKeyGenDefault',
      {createUids: {useDefault: true}},
      {prompts: ['keybase.1.pgpUi.shouldPushPrivate']}
    )
    await settle()
    expect(methodsSent(fake)).toEqual([])
    endSwitch()
    await expect(dialog.done).resolves.toBeUndefined()
    uninstallFakeEngine()
  })

  test('starting from logged out goes out when it ends', async () => {
    const fake = installFakeEngine()
    fake.answer(settings, () => ({}))
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    const p = T.RPCGen.userLoadMySettingsRpcPromise()
    await settle()
    expect(methodsSent(fake)).toEqual([])
    endSwitch()
    await expect(p).resolves.toEqual({})
    uninstallFakeEngine()
  })

  test('is rejected as the account change, and never sent, if the next account logs out meanwhile', async () => {
    const fake = installFakeEngine()
    fake.answer(settings, () => ({}))
    startSwitch()
    // the next account's session landed before the switch ended
    useConfigState.getState().dispatch.setLoggedIn(true)
    const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise(undefined, waitingKey))
    useConfigState.getState().dispatch.setLoggedIn(false)
    expect(await p).toEqual({e: expect.objectContaining({kind: byAccountChange})})
    expect(count(fake)).toBe(0)
    endSwitch()
    await settle()
    expect(methodsSent(fake)).toEqual([])
    uninstallFakeEngine()
  })

  test('cancelled by its caller is rejected and never sent', async () => {
    const fake = installFakeEngine()
    fake.answer('keybase.1.device.deviceAdd', () => undefined)
    startSwitch()
    let cancel = () => {}
    const p = outcome(
      T.RPCGen.deviceDeviceAddRpcListener({
        params: undefined,
        customResponseIncomingCallMap: {},
        incomingCallMap: {},
        onSessionCreated: c => {
          cancel = c
        },
        waitingKey,
      })
    )
    cancel()
    expect(await p).toEqual({e: expect.objectContaining({kind: byCaller})})
    expect(count(fake)).toBe(0)
    endSwitch()
    await settle()
    expect(methodsSent(fake)).toEqual([])
    uninstallFakeEngine()
  })

  test('outlives a lost link, since it was never sent', async () => {
    const fake = installFakeEngine()
    fake.answer(settings, () => ({}))
    startSwitch()
    const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise())
    fake.drop()
    fake.restart()
    endSwitch()
    expect(await p).toEqual({r: {}})
    uninstallFakeEngine()
  })

  test('warns once it has waited 10s, and still goes out when the switch ends', async () => {
    jest.useFakeTimers({doNotFake: ['queueMicrotask']})
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const fake = installFakeEngine()
    fake.answer(settings, () => ({}))
    startSwitch()
    const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise())
    await jest.advanceTimersByTimeAsync(9_999)
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('held'))
    await jest.advanceTimersByTimeAsync(60_000)
    expect(warn.mock.calls.filter(c => String(c[0]).includes('held'))).toEqual([
      [`Engine: ${settings} held 10s during an account switch`],
    ])
    expect(methodsSent(fake)).toEqual([])
    endSwitch()
    expect(await p).toEqual({r: {}})
    uninstallFakeEngine()
  })
})

describe('every way a switch ends lets its calls out', () => {
  // Makes a call after `begin` starts the switch, and checks it goes out once `end` ends it
  const heldThenEnded = async (
    begin: (fake: FakeEngine) => Promise<void>,
    end: (fake: FakeEngine) => Promise<void>
  ) => {
    useDaemonState.setState(s => ({dispatch: {...s.dispatch, refreshSessionFromDaemon: () => {}}}))
    const fake = installFakeEngine()
    fake.answer(settings, () => ({}))
    await begin(fake)
    expect(useConfigState.getState().userSwitching).toBe(true)
    const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise())
    await settle()
    expect(methodsSent(fake)).not.toContain(settings)
    await end(fake)
    expect(useConfigState.getState().userSwitching).toBe(false)
    expect(await p).toEqual({r: {}})
    uninstallFakeEngine()
  }
  const plainSwitch = async () => {
    startSwitch()
    return Promise.resolve()
  }
  // switchToAccount's login, held at the service; resolves with its session
  const switchLogin = (fake: FakeEngine) => {
    const held = fake.hold('keybase.1.login.login')
    const begin = async () => {
      useConfigState.getState().dispatch.switchToAccount('testuser2')
      await settle()
    }
    const sessionID = () => fake.calls.find(c => c.method === 'keybase.1.login.login')!.params.sessionID as number
    return {begin, held, sessionID}
  }

  test('the new account landing', async () => {
    await heldThenEnded(plainSwitch, async () => {
      useConfigState.getState().dispatch.endUserSwitchLandedOn('testuser2')
      return Promise.resolve()
    })
  })

  test('a login error', async () => {
    await heldThenEnded(plainSwitch, async () => {
      useConfigState.getState().dispatch.setLoginError(new RPCError('bad', T.RPCGen.StatusCode.scgeneric))
      return Promise.resolve()
    })
  })

  test("the switch's login failing with our own refusal", async () => {
    let login: ReturnType<typeof switchLogin> | undefined
    await heldThenEnded(
      async fake => {
        login = switchLogin(fake)
        await login.begin()
      },
      async fake => {
        const refusal = {code: T.RPCGen.StatusCode.scgeneric, desc: 'Canceling RPC'}
        const pushed = fake.push(
          'keybase.1.provisionUi.chooseDevice',
          {canSelectNoDevice: false, devices: []},
          {sessionID: login!.sessionID()}
        )
        await settle()
        expect(await pushed).toEqual({error: refusal})
        login!.held[0]!.reply(fakeError(refusal.code, refusal.desc))
        await settle()
      }
    )
  })

  test('the account needing provisioning', async () => {
    installFakeNavigator()
    let login: ReturnType<typeof switchLogin> | undefined
    try {
      await heldThenEnded(
        async fake => {
          login = switchLogin(fake)
          await login.begin()
        },
        async fake => {
          await fake.push(
            'keybase.1.provisionUi.PromptNewDeviceName',
            {errorMessage: '', existingDevices: []},
            {sessionID: login!.sessionID()}
          )
          await settle()
          login!.held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'Canceling RPC'))
          await settle()
        }
      )
    } finally {
      restoreNavigator()
    }
  })
})
